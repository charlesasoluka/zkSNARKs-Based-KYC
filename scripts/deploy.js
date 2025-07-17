const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("🚀 Deploying ZK-KYC System with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
  
  const deployments = {};
  
  try {
    // 1. Deploy Mock Hasher (for testing) or real Poseidon hasher
    console.log("\n📦 Deploying Hasher...");
    const HasherFactory = await ethers.getContractFactory("MockHasher");
    const hasher = await HasherFactory.deploy();
    await hasher.waitForDeployment();
    
    deployments.hasher = await hasher.getAddress();
    console.log("✅ Hasher deployed to:", deployments.hasher);
    
    // 2. Deploy Verifier (this should be generated from circuit)
    console.log("\n📦 Deploying Verifier...");
    let verifier;
    try {
      const VerifierFactory = await ethers.getContractFactory("Verifier");
      verifier = await VerifierFactory.deploy();
      await verifier.waitForDeployment();
    } catch (error) {
      console.log("⚠️  Verifier contract not found, using MockVerifier for testing");
      const MockVerifierFactory = await ethers.getContractFactory("MockVerifier");
      verifier = await MockVerifierFactory.deploy();
      await verifier.waitForDeployment();
    }
    
    deployments.verifier = await verifier.getAddress();
    console.log("✅ Verifier deployed to:", deployments.verifier);
    
    // 3. Deploy KYC Registry
    console.log("\n📦 Deploying KYC Registry...");
    const merkleTreeHeight = 20;
    const trustedIssuers = [deployer.address]; // Add actual trusted issuers
    
    const KYCRegistryFactory = await ethers.getContractFactory("KYCRegistry");
    const kycRegistry = await KYCRegistryFactory.deploy(
      await hasher.getAddress(),
      merkleTreeHeight,
      trustedIssuers
    );
    await kycRegistry.waitForDeployment();
    
    deployments.kycRegistry = await kycRegistry.getAddress();
    console.log("✅ KYC Registry deployed to:", deployments.kycRegistry);
    
    // 4. Deploy Access Controller
    console.log("\n📦 Deploying Access Controller...");
    const AccessControllerFactory = await ethers.getContractFactory("ZKAccessController");
    const accessController = await AccessControllerFactory.deploy(
      await kycRegistry.getAddress(),
      await verifier.getAddress()
    );
    await accessController.waitForDeployment();
    
    deployments.accessController = await accessController.getAddress();
    console.log("✅ Access Controller deployed to:", deployments.accessController);
    
    // 5. Configure initial services
    console.log("\n⚙️  Configuring initial services...");
    
    // Configure example services
    await accessController.configureService("dex", true, 18, 86400); // 1 day validity
    await accessController.configureService("lending", true, 21, 3600); // 1 hour validity
    await accessController.configureService("voting", true, 16, 604800); // 1 week validity
    
    console.log("✅ Initial services configured");
    
    // 6. Save deployment addresses
    const deploymentPath = path.join(__dirname, "../deployments.json");
    const deploymentData = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deployments,
      config: {
        merkleTreeHeight,
        trustedIssuers
      }
    };
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));
    console.log("✅ Deployment addresses saved to:", deploymentPath);
    
    // 7. Verify contracts (if on a supported network)
    if (process.env.ETHERSCAN_API_KEY) {
      console.log("\n🔍 Verifying contracts on Etherscan...");
      await verifyContracts(deployments, {
        hasher: [],
        verifier: [],
        kycRegistry: [await hasher.getAddress(), merkleTreeHeight, trustedIssuers],
        accessController: [await kycRegistry.getAddress(), await verifier.getAddress()]
      });
    }
    
    console.log("\n🎉 Deployment completed successfully!");
    console.log("📋 Summary:");
    console.log("- Hasher:", deployments.hasher);
    console.log("- Verifier:", deployments.verifier);
    console.log("- KYC Registry:", deployments.kycRegistry);
    console.log("- Access Controller:", deployments.accessController);
    
    // 8. Create frontend config
    const frontendConfig = {
      contracts: deployments,
      network: (await ethers.provider.getNetwork()).name,
      rpcUrl: ethers.provider._getConnection().url
    };
    
    const frontendConfigPath = path.join(__dirname, "../frontend/src/config/contracts.json");
    fs.mkdirSync(path.dirname(frontendConfigPath), { recursive: true });
    fs.writeFileSync(frontendConfigPath, JSON.stringify(frontendConfig, null, 2));
    console.log("✅ Frontend config saved to:", frontendConfigPath);
    
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exitCode = 1;
  }
}

async function verifyContracts(deployments, constructorArgs) {
  const { run } = require("hardhat");
  
  try {
    for (const [contractName, address] of Object.entries(deployments)) {
      console.log(`Verifying ${contractName}...`);
      
      await run("verify:verify", {
        address: address,
        constructorArguments: constructorArgs[contractName] || [],
      });
      
      console.log(`✅ ${contractName} verified`);
    }
  } catch (error) {
    console.error("❌ Verification failed:", error);
  }
}

// Additional deployment functions for different networks
async function deployToLocalNetwork() {
  console.log("🏠 Deploying to local network (Hardhat)...");
  await main();
}

async function deployToTestnet() {
  console.log("🧪 Deploying to testnet...");
  await main();
}

async function deployToMainnet() {
  console.log("🌐 Deploying to mainnet...");
  
  // Additional confirmations for mainnet
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const confirm = await new Promise((resolve) => {
    readline.question("Are you sure you want to deploy to mainnet? (yes/no): ", resolve);
  });
  
  readline.close();
  
  if (confirm.toLowerCase() === "yes") {
    await main();
  } else {
    console.log("❌ Deployment cancelled");
    process.exit(0);
  }
}

if (require.main === module) {
  const network = process.env.HARDHAT_NETWORK || "localhost";
  
  switch (network) {
    case "localhost":
    case "hardhat":
      deployToLocalNetwork();
      break;
    case "sepolia":
    case "goerli":
      deployToTestnet();
      break;
    case "mainnet":
      deployToMainnet();
      break;
    default:
      main();
  }
}

module.exports = { main, verifyContracts };