// scripts/test-flow.js
const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const circomlib = require("circomlib");

async function main() {
  console.log("🧪 Testing ZK-KYC Complete Flow...");

  // Load deployed contracts
  const deployments = require('../deployments.json');
  const [user, issuer, service] = await ethers.getSigners();

  // Connect to contracts
  const kycRegistry = await ethers.getContractAt("KYCRegistry", deployments.kycRegistry);
  const accessController = await ethers.getContractAt("ZKAccessController", deployments.accessController);
  const kycIssuer = await ethers.getContractAt("KYCIssuer", deployments.kycIssuer);

  console.log("👤 User address:", user.address);
  console.log("🏦 Issuer address:", issuer.address);
  console.log("🏢 Service address:", service.address);

  // Step 1: Generate user DID and secrets
  const userDID = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`did:ethr:${user.address}`));
  const nullifier = ethers.utils.randomBytes(32);
  const secret = ethers.utils.randomBytes(32);

  console.log("🔐 Generated user secrets");

  // Step 2: Issue KYC credential
  const credentialId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("cred_001"));
  const expirationDate = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year
  const kycClaim = ethers.utils.defaultAbiCoder.encode(
    ["bool", "uint256", "uint256"],
    [true, 2, 18] // verified, level 2, min age 18
  );
  const signature = "0x00"; // Placeholder signature

  await kycIssuer.connect(issuer).issueCredential(
    credentialId,
    userDID,
    expirationDate,
    ethers.utils.keccak256(kycClaim),
    signature
  );
  console.log("✅ KYC credential issued");

  // Step 3: Generate and deposit commitment
  const commitment = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32"],
      [nullifier, secret, userDID]
    )
  );

  await kycRegistry.connect(user).depositCommitment(commitment);
  console.log("✅ Commitment deposited to registry");

  // Step 4: Generate ZK proof (simplified for testing)
  const merkleRoot = await kycRegistry.getLastRoot();
  const externalNullifier = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("test-service")
  );
  const nullifierHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32"],
      [nullifier, externalNullifier]
    )
  );

  // In real implementation, this would use snarkjs to generate actual proof
  const mockProof = [0, 0, 0, 0, 0, 0, 0, 0]; // Placeholder
  const proofData = {
    root: merkleRoot,
    nullifierHash: nullifierHash,
    recipient: user.address,
    externalNullifier: externalNullifier,
    proof: mockProof
  };

  console.log("🔍 Generated ZK proof (mock)");

  // Step 5: Test access control (would fail with mock proof)
  try {
    await accessController.connect(user).verifyKYCAndGrantAccess(
      proofData,
      "test-service"
    );
    console.log("✅ Access granted successfully");
  } catch (error) {
    console.log("❌ Access denied (expected with mock proof):", error.message);
  }

  console.log("\n🎉 Test flow completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });