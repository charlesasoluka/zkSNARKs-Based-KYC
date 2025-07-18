const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZK-KYC System", function () {
  let kycRegistry, didIssuer, zkVoting, verifier;
  let hasher;
  let owner, issuer, user1, user2;

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
    
    // Deploy verifier
    const Verifier = await ethers.getContractFactory("Verifier");
    verifier = await Verifier.deploy();
    await verifier.waitForDeployment();
    
    // Deploy DID Issuer
    const DIDIssuer = await ethers.getContractFactory("DIDIssuer");
    didIssuer = await DIDIssuer.deploy();
    await didIssuer.waitForDeployment();
    
    // Deploy ZK Voting
    const ZKVoting = await ethers.getContractFactory("ZKVoting");
    zkVoting = await ZKVoting.deploy(kycRegistry.target, verifier.target);
    await zkVoting.waitForDeployment();
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
      
      expect(await kycRegistry.commitments(commitment)).to.be.true;
      expect(await kycRegistry.nextIndex()).to.equal(1);
    });

    it("Should prevent duplicate commitments", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-commitment"));
      
      await kycRegistry.connect(user1).depositCommitment(commitment);
      
      await expect(kycRegistry.connect(user1).depositCommitment(commitment))
        .to.be.revertedWith("Commitment already exists");
    });

    it("Should manage trusted issuers", async function () {
      expect(await kycRegistry.trustedIssuers(issuer.address)).to.be.true;
      expect(await kycRegistry.trustedIssuers(user1.address)).to.be.false;
      
      await kycRegistry.connect(owner).addTrustedIssuer(user1.address);
      expect(await kycRegistry.trustedIssuers(user1.address)).to.be.true;
      
      await kycRegistry.connect(owner).removeTrustedIssuer(user1.address);
      expect(await kycRegistry.trustedIssuers(user1.address)).to.be.false;
    });

    it("Should track nullifier usage", async function () {
      const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("test-nullifier"));
      
      expect(await kycRegistry.nullifierHashes(nullifierHash)).to.be.false;
      expect(await kycRegistry.isSpent(nullifierHash)).to.be.false;
      
      // Nullifier spending happens internally, so we just test the view functions
      expect(await kycRegistry.isSpent(nullifierHash)).to.be.false;
    });

    it("Should maintain correct root history", async function () {
      const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("commitment1"));
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("commitment2"));
      
      const initialRoot = await kycRegistry.getLastRoot();
      
      await kycRegistry.connect(user1).depositCommitment(commitment1);
      const root1 = await kycRegistry.getLastRoot();
      expect(root1).to.not.equal(initialRoot);
      
      await kycRegistry.connect(user1).depositCommitment(commitment2);
      const root2 = await kycRegistry.getLastRoot();
      expect(root2).to.not.equal(root1);
      
      // Both roots should be known
      expect(await kycRegistry.isKnownRoot(root1)).to.be.true;
      expect(await kycRegistry.isKnownRoot(root2)).to.be.true;
    });
  });

  describe("DID Issuer", function () {
    it("Should issue DIDs correctly", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-commitment"));
      
      await expect(didIssuer.connect(owner).issueDID(user1.address, commitment))
        .to.emit(didIssuer, "DIDIssued");
      
      const holderDIDs = await didIssuer.getHolderDIDs(user1.address);
      expect(holderDIDs.length).to.equal(1);
      
      const did = holderDIDs[0];
      expect(await didIssuer.isDIDValid(did)).to.be.true;
    });

    it("Should allow DID revocation", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-commitment"));
      
      const tx = await didIssuer.connect(owner).issueDID(user1.address, commitment);
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.topics[0] === ethers.id("DIDIssued(bytes32,address,uint256)"));
      const did = event.topics[1];
      
      expect(await didIssuer.isDIDValid(did)).to.be.true;
      
      await expect(didIssuer.connect(owner).revokeDID(did))
        .to.emit(didIssuer, "DIDRevoked");
      
      expect(await didIssuer.isDIDValid(did)).to.be.false;
    });

    it("Should reject non-owner operations", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-commitment"));
      
      await expect(didIssuer.connect(user1).issueDID(user1.address, commitment))
        .to.be.revertedWithCustomError(didIssuer, "OwnableUnauthorizedAccount");
    });
  });

  describe("ZK Voting", function () {
    let mockProof;
    
    beforeEach(async function () {
      // Mock proof data
      mockProof = {
        pA: [1, 2],
        pB: [[1, 2], [3, 4]],
        pC: [5, 6]
      };
    });

    it("Should configure voting correctly", async function () {
      expect(await zkVoting.votingOpen()).to.be.true;
      expect(await zkVoting.getTotalVotes()).to.equal(0);
      
      const results = await zkVoting.getResults();
      expect(results.length).to.equal(10);
      for (let i = 0; i < 10; i++) {
        expect(results[i]).to.equal(0);
      }
    });

    it("Should reject votes with invalid roots", async function () {
      const fakeRoot = ethers.keccak256(ethers.toUtf8Bytes("fake-root"));
      const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("nullifier"));
      
      await expect(
        zkVoting.connect(user1).vote(
          mockProof.pA,
          mockProof.pB,
          mockProof.pC,
          fakeRoot,
          nullifierHash,
          1
        )
      ).to.be.revertedWith("Invalid root");
    });

    it("Should allow owner to close voting", async function () {
      expect(await zkVoting.votingOpen()).to.be.true;
      
      await expect(zkVoting.connect(owner).closeVoting())
        .to.emit(zkVoting, "VotingClosed");
      
      expect(await zkVoting.votingOpen()).to.be.false;
    });

    it("Should reject votes after closing", async function () {
      await zkVoting.connect(owner).closeVoting();
      
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-commitment"));
      await kycRegistry.connect(user1).depositCommitment(commitment);
      const root = await kycRegistry.getLastRoot();
      const nullifierHash = ethers.keccak256(ethers.toUtf8Bytes("nullifier"));
      
      await expect(
        zkVoting.connect(user1).vote(
          mockProof.pA,
          mockProof.pB,
          mockProof.pC,
          root,
          nullifierHash,
          1
        )
      ).to.be.revertedWith("Voting is closed");
    });
  });

  describe("Integration Tests", function () {
    it("Should complete basic workflow", async function () {
      // 1. Issue DID
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-commitment"));
      await didIssuer.connect(owner).issueDID(user1.address, commitment);
      
      // 2. Deposit commitment
      await kycRegistry.connect(user1).depositCommitment(commitment);
      
      // 3. Verify root exists
      const root = await kycRegistry.getLastRoot();
      expect(await kycRegistry.isKnownRoot(root)).to.be.true;
      
      // 4. Verify DID is valid
      const holderDIDs = await didIssuer.getHolderDIDs(user1.address);
      expect(holderDIDs.length).to.equal(1);
      expect(await didIssuer.isDIDValid(holderDIDs[0])).to.be.true;
      
      console.log("✅ Complete workflow test passed");
    });
  });
});