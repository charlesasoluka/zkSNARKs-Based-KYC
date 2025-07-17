const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree, IdentityManager } = require("../scripts/merkle-utils");
const { ProofGenerator } = require("../scripts/generate-proof");

describe("ZK-KYC System", function () {
  let kycRegistry, accessController, verifier;
  let hasher;
  let owner, issuer, user1, user2;
  let tree, identityManager, proofGenerator;

  beforeEach(async function () {
    [owner, issuer, user1, user2] = await ethers.getSigners();
    
    // Deploy mock hasher for testing
    const MockHasher = await ethers.getContractFactory("MockHasher");
    hasher = await MockHasher.deploy();
    await hasher.waitForDeployment();
    
    // Deploy KYC Registry
    const KYCRegistry = await ethers.getContractFactory("KYCRegistry");
    kycRegistry = await KYCRegistry.deploy(hasher.target, 20, [issuer.address]);
    await kycRegistry.waitForDeployment();
    
    // Deploy mock verifier for testing
    const MockVerifier = await ethers.getContractFactory("MockVerifier");
    verifier = await MockVerifier.deploy();
    await verifier.waitForDeployment();
    
    // Deploy Access Controller
    const ZKAccessController = await ethers.getContractFactory("ZKAccessController");
    accessController = await ZKAccessController.deploy(kycRegistry.target, verifier.target);
    await accessController.waitForDeployment();
    
    // Initialize utilities
    tree = new MerkleTree(20);
    identityManager = new IdentityManager();
    proofGenerator = new ProofGenerator();
  });

  describe("KYC Registry", function () {
    it("Should deploy with correct initial state", async function () {
      expect(await kycRegistry.levels()).to.equal(20);
      expect(await kycRegistry.trustedIssuers(issuer.address)).to.be.true;
      expect(await kycRegistry.nextIndex()).to.equal(0);
    });

    it("Should allow commitment deposits", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-commitment"));
      
      await expect(kycRegistry.connect(user1).depositCommitment(commitment))
        .to.emit(kycRegistry, "CommitmentAdded");
      
      // Check that the commitment was added correctly
      const events = await kycRegistry.queryFilter(kycRegistry.filters.CommitmentAdded());
      const latestEvent = events[events.length - 1];
      expect(latestEvent.args[0]).to.equal(commitment);
      expect(latestEvent.args[1]).to.equal(0);
      
      expect(await kycRegistry.commitments(commitment)).to.be.true;
      expect(await kycRegistry.nextIndex()).to.equal(1);
    });

    it("Should prevent duplicate commitments", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-commitment"));
      
      await kycRegistry.connect(user1).depositCommitment(commitment);
      
      await expect(
        kycRegistry.connect(user1).depositCommitment(commitment)
      ).to.be.revertedWith("Commitment already exists");
    });

    it("Should manage trusted issuers", async function () {
      expect(await kycRegistry.trustedIssuers(issuer.address)).to.be.true;
      
      await kycRegistry.removeTrustedIssuer(issuer.address);
      expect(await kycRegistry.trustedIssuers(issuer.address)).to.be.false;
      
      await kycRegistry.addTrustedIssuer(issuer.address);
      expect(await kycRegistry.trustedIssuers(issuer.address)).to.be.true;
    });

    it("Should track nullifier usage", async function () {
      const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-nullifier"));
      
      expect(await kycRegistry.isSpent(nullifierHash)).to.be.false;
      
      await kycRegistry.connect(issuer).markNullifierSpent(nullifierHash);
      
      expect(await kycRegistry.isSpent(nullifierHash)).to.be.true;
    });

    it("Should maintain correct root history", async function () {
      const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("commitment1"));
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("commitment2"));
      
      const root1 = await kycRegistry.getLastRoot();
      await kycRegistry.depositCommitment(commitment1);
      const root2 = await kycRegistry.getLastRoot();
      await kycRegistry.depositCommitment(commitment2);
      const root3 = await kycRegistry.getLastRoot();
      
      expect(await kycRegistry.isKnownRoot(root1)).to.be.true;
      expect(await kycRegistry.isKnownRoot(root2)).to.be.true;
      expect(await kycRegistry.isKnownRoot(root3)).to.be.true;
    });
  });

  describe("Access Controller", function () {
    beforeEach(async function () {
      await accessController.configureService("test-service", true, 18, 3600);
    });

    it("Should configure services correctly", async function () {
      const config = await accessController.getServiceConfig("test-service");
      expect(config.enabled).to.be.true;
      expect(config.minimumAge).to.equal(18);
      expect(config.validityPeriod).to.equal(3600);
    });

    it("Should grant access with valid proof", async function () {
      const identity = identityManager.createIdentity("did:example:123");
      await kycRegistry.connect(user1).depositCommitment(identity.commitment);
      
      const currentTime = Math.floor(Date.now() / 1000);
      const proofData = {
        pA: [1, 2],
        pB: [[1, 2], [3, 4]],
        pC: [5, 6],
        publicSignals: [
          await kycRegistry.getLastRoot(),
          ethers.keccak256(ethers.toUtf8Bytes("nullifier")),
          currentTime,
          25
        ]
      };
      
      await verifier.setVerificationResult(true);
      
      await expect(
        accessController.connect(user1).verifyKYCAndGrantAccess(proofData, "test-service")
      ).to.emit(accessController, "AccessGranted");
      
      expect(await accessController.hasAccess(user1.address, "test-service")).to.be.true;
    });

    it("Should reject invalid proofs", async function () {
      const proofData = {
        pA: [1, 2],
        pB: [[1, 2], [3, 4]],
        pC: [5, 6],
        publicSignals: [0, 0, 0, 0]
      };
      
      await verifier.setVerificationResult(false);
      
      await expect(
        accessController.connect(user1).verifyKYCAndGrantAccess(proofData, "test-service")
      ).to.be.revertedWith("Invalid proof");
    });

    it("Should enforce minimum age requirements", async function () {
      const identity = identityManager.createIdentity("did:example:123");
      await kycRegistry.connect(user1).depositCommitment(identity.commitment);
      
      const proofData = {
        pA: [1, 2],
        pB: [[1, 2], [3, 4]],
        pC: [5, 6],
        publicSignals: [
          await kycRegistry.getLastRoot(),
          ethers.keccak256(ethers.toUtf8Bytes("nullifier")),
          Math.floor(Date.now() / 1000),
          16
        ]
      };
      
      await verifier.setVerificationResult(true);
      
      await expect(
        accessController.connect(user1).verifyKYCAndGrantAccess(proofData, "test-service")
      ).to.be.revertedWith("Age requirement not met");
    });

    it("Should support batch verification", async function () {
      const identity1 = identityManager.createIdentity("did:example:123");
      const identity2 = identityManager.createIdentity("did:example:456");
      
      await kycRegistry.connect(user1).depositCommitment(identity1.commitment);
      await kycRegistry.connect(user1).depositCommitment(identity2.commitment);
      
      await accessController.configureService("test-service-2", true, 21, 3600);
      
      const proofData = [
        {
          pA: [1, 2],
          pB: [[1, 2], [3, 4]],
          pC: [5, 6],
          publicSignals: [
            await kycRegistry.getLastRoot(),
            ethers.keccak256(ethers.toUtf8Bytes("nullifier1")),
            Math.floor(Date.now() / 1000),
            25
          ]
        },
        {
          pA: [1, 2],
          pB: [[1, 2], [3, 4]],
          pC: [5, 6],
          publicSignals: [
            await kycRegistry.getLastRoot(),
            ethers.keccak256(ethers.toUtf8Bytes("nullifier2")),
            Math.floor(Date.now() / 1000),
            22
          ]
        }
      ];
      
      await verifier.setVerificationResult(true);
      
      await accessController.connect(user1).batchVerifyAndGrantAccess(
        proofData,
        ["test-service", "test-service-2"]
      );
      
      expect(await accessController.hasAccess(user1.address, "test-service")).to.be.true;
      expect(await accessController.hasAccess(user1.address, "test-service-2")).to.be.true;
    });

    it("Should allow owner to revoke access", async function () {
      const identity = identityManager.createIdentity("did:example:123");
      await kycRegistry.connect(user1).depositCommitment(identity.commitment);
      
      const proofData = {
        pA: [1, 2],
        pB: [[1, 2], [3, 4]],
        pC: [5, 6],
        publicSignals: [
          await kycRegistry.getLastRoot(),
          ethers.keccak256(ethers.toUtf8Bytes("nullifier")),
          Math.floor(Date.now() / 1000),
          25
        ]
      };
      
      await verifier.setVerificationResult(true);
      await accessController.connect(user1).verifyKYCAndGrantAccess(proofData, "test-service");
      
      expect(await accessController.hasAccess(user1.address, "test-service")).to.be.true;
      
      await accessController.revokeAccess(user1.address, "test-service");
      
      expect(await accessController.hasAccess(user1.address, "test-service")).to.be.false;
    });
  });

  describe("Merkle Tree Utilities", function () {
    it("Should create correct merkle tree", async function () {
      const testTree = new MerkleTree(10);
      expect(testTree.levels).to.equal(10);
      expect(testTree.nextIndex).to.equal(0);
    });

    it("Should insert leaves and generate proofs", async function () {
      const testTree = new MerkleTree(10);
      const leaf = BigInt("12345");
      
      const index = testTree.insert(leaf);
      expect(index).to.equal(0);
      
      const proof = testTree.getProof(index);
      expect(proof.pathElements).to.have.length(10);
      expect(proof.pathIndices).to.have.length(10);
      
      const isValid = testTree.verifyProof(leaf, proof, testTree.root);
      expect(isValid).to.be.true;
    });

    it("Should handle identity management", async function () {
      const manager = new IdentityManager();
      const did = "did:example:123";
      
      const identity = manager.createIdentity(did);
      
      expect(identity.did).to.equal(did);
      expect(identity.nullifier).to.exist;
      expect(identity.secret).to.exist;
      expect(identity.commitment).to.exist;
      
      const retrieved = manager.getIdentity(did);
      expect(retrieved).to.deep.equal(identity);
    });
  });

  describe("Integration Tests", function () {
    it("Should complete full KYC workflow", async function () {
      const identity = identityManager.createIdentity("did:example:123");
      
      await kycRegistry.connect(user1).depositCommitment(identity.commitment);
      
      await accessController.configureService("full-workflow", true, 18, 3600);
      
      const currentTime = Math.floor(Date.now() / 1000);
      const actualRoot = await kycRegistry.getLastRoot();
      
      await verifier.setVerificationResult(true);
      
      const proofData = {
        pA: [1, 2],
        pB: [[1, 2], [3, 4]],
        pC: [5, 6],
        publicSignals: [
          actualRoot,
          ethers.keccak256(ethers.toUtf8Bytes("nullifier")),
          currentTime,
          25
        ]
      };
      
      await accessController.connect(user1).verifyKYCAndGrantAccess(proofData, "full-workflow");
      
      expect(await accessController.hasAccess(user1.address, "full-workflow")).to.be.true;
    });
  });
});

// Mock contracts for testing need to be deployed separately
// These are contract definitions that should be in separate files for deployment