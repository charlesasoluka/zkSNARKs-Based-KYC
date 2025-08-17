const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * @title Gas Analysis for ZK KYC System
 * @dev Comprehensive gas cost analysis for all contract operations
 */
class GasAnalyzer {
    constructor() {
        this.results = {
            deployment: {},
            operations: {},
            summary: {}
        };
    }

    async analyzeAll() {
        console.log("🔍 Starting comprehensive gas analysis...\n");
        
        // Deploy contracts and analyze deployment costs
        const contracts = await this.deployContracts();
        
        // Analyze individual operations
        await this.analyzeOperations(contracts);
        
        // Generate summary report
        this.generateReport();
        
        return this.results;
    }

    async deployContracts() {
        console.log("📦 Analyzing deployment costs...");
        
        const [deployer, issuer1, issuer2, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy SimpleHasher
        const SimpleHasher = await ethers.getContractFactory("SimpleHasher");
        const hasher = await SimpleHasher.deploy();
        const hasherReceipt = await hasher.deploymentTransaction().wait();
        this.results.deployment.hasher = hasherReceipt.gasUsed;
        
        // Deploy KYCRegistry
        const KYCRegistry = await ethers.getContractFactory("KYCRegistry");
        const kycRegistry = await KYCRegistry.deploy(
            await hasher.getAddress(),
            20, // merkle tree height
            [issuer1.address, issuer2.address]
        );
        const registryReceipt = await kycRegistry.deploymentTransaction().wait();
        this.results.deployment.kycRegistry = registryReceipt.gasUsed;
        
        // Deploy Verifier
        const Verifier = await ethers.getContractFactory("contracts/VerifierFinal.sol:Groth16Verifier");
        const verifier = await Verifier.deploy();
        const verifierReceipt = await verifier.deploymentTransaction().wait();
        this.results.deployment.verifier = verifierReceipt.gasUsed;
        
        // Deploy ZKAccessController
        const ZKAccessController = await ethers.getContractFactory("ZKAccessController");
        const accessController = await ZKAccessController.deploy(
            await kycRegistry.getAddress(),
            await verifier.getAddress()
        );
        const controllerReceipt = await accessController.deploymentTransaction().wait();
        this.results.deployment.accessController = controllerReceipt.gasUsed;
        
        console.log(`✅ Deployment analysis complete\n`);
        
        return {
            hasher,
            kycRegistry,
            verifier,
            accessController,
            accounts: { deployer, issuer1, issuer2, user1, user2, user3 }
        };
    }

    async analyzeOperations(contracts) {
        console.log("⚡ Analyzing operation costs...");
        
        const { hasher, kycRegistry, verifier, accessController, accounts } = contracts;
        const { issuer1, user1, user2 } = accounts;
        
        // Analyze commitment deposit
        const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("test_commitment_1"));
        const depositTx = await kycRegistry.connect(user1).depositCommitment(commitment1);
        const depositReceipt = await depositTx.wait();
        this.results.operations.depositCommitment = depositReceipt.gasUsed;
        
        // Analyze second commitment (tree update)
        const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("test_commitment_2"));
        const deposit2Tx = await kycRegistry.connect(user2).depositCommitment(commitment2);
        const deposit2Receipt = await deposit2Tx.wait();
        this.results.operations.depositCommitmentSecond = deposit2Receipt.gasUsed;
        
        // Analyze trusted issuer management
        const addIssuerTx = await kycRegistry.addTrustedIssuer(accounts.user3.address);
        const addIssuerReceipt = await addIssuerTx.wait();
        this.results.operations.addTrustedIssuer = addIssuerReceipt.gasUsed;
        
        const removeIssuerTx = await kycRegistry.removeTrustedIssuer(accounts.user3.address);
        const removeIssuerReceipt = await removeIssuerTx.wait();
        this.results.operations.removeTrustedIssuer = removeIssuerReceipt.gasUsed;
        
        // Analyze nullifier marking
        const nullifier = ethers.keccak256(ethers.toUtf8Bytes("test_nullifier"));
        const markNullifierTx = await kycRegistry.markNullifierSpent(nullifier);
        const markNullifierReceipt = await markNullifierTx.wait();
        this.results.operations.markNullifierSpent = markNullifierReceipt.gasUsed;
        
        // Analyze mock ZK proof verification (we'll simulate the gas cost)
        // Note: Real ZK proof verification would be analyzed with actual proofs
        try {
            // Mock proof data for gas estimation
            const mockProof = {
                pA: [1, 2],
                pB: [[3, 4], [5, 6]],
                pC: [7, 8]
            };
            const mockNullifier = ethers.keccak256(ethers.toUtf8Bytes("mock_nullifier"));
            const mockRecipient = user1.address;
            
            // Estimate gas for access verification
            const gasEstimate = await accessController.verifyAndGrantAccess.estimateGas(
                mockProof.pA,
                mockProof.pB,
                mockProof.pC,
                mockNullifier,
                mockRecipient,
                issuer1.address
            );
            this.results.operations.zkProofVerification = gasEstimate;
        } catch (error) {
            // If estimation fails, provide typical range
            this.results.operations.zkProofVerification = BigInt(280000); // Typical Groth16 verification cost
            console.log("   📊 Using estimated ZK verification cost (actual proof needed for precise measurement)");
        }
        
        console.log(`✅ Operation analysis complete\n`);
    }

    generateReport() {
        console.log("📊 GAS ANALYSIS REPORT");
        console.log("=" .repeat(60));
        
        // Deployment costs
        console.log("\n🏗️  DEPLOYMENT COSTS:");
        console.log(`   SimpleHasher:         ${this.formatGas(this.results.deployment.hasher)}`);
        console.log(`   KYCRegistry:          ${this.formatGas(this.results.deployment.kycRegistry)}`);
        console.log(`   Groth16Verifier:      ${this.formatGas(this.results.deployment.verifier)}`);
        console.log(`   ZKAccessController:   ${this.formatGas(this.results.deployment.accessController)}`);
        
        const totalDeployment = Object.values(this.results.deployment).reduce((a, b) => a + b, BigInt(0));
        console.log(`   📈 Total Deployment:   ${this.formatGas(totalDeployment)}`);
        
        // Operation costs
        console.log("\n⚡ OPERATION COSTS:");
        console.log(`   Deposit Commitment (1st): ${this.formatGas(this.results.operations.depositCommitment)}`);
        console.log(`   Deposit Commitment (2nd): ${this.formatGas(this.results.operations.depositCommitmentSecond)}`);
        console.log(`   Add Trusted Issuer:       ${this.formatGas(this.results.operations.addTrustedIssuer)}`);
        console.log(`   Remove Trusted Issuer:    ${this.formatGas(this.results.operations.removeTrustedIssuer)}`);
        console.log(`   Mark Nullifier Spent:     ${this.formatGas(this.results.operations.markNullifierSpent)}`);
        console.log(`   ZK Proof Verification:    ${this.formatGas(this.results.operations.zkProofVerification)}`);
        
        // Cost analysis at different gas prices
        console.log("\n💰 COST ANALYSIS (USD estimates):");
        this.analyzeCosts();
        
        // Recommendations
        console.log("\n🎯 OPTIMIZATION RECOMMENDATIONS:");
        this.generateRecommendations();
        
        console.log("\n" + "=" .repeat(60));
    }

    analyzeCosts() {
        const ethPrice = 2000; // USD per ETH (adjustable)
        const gasPrices = [10, 20, 50, 100]; // gwei
        
        console.log(`   (Assuming ETH = $${ethPrice})`);
        console.log(`   Operation                    10 gwei     20 gwei     50 gwei    100 gwei`);
        console.log(`   ${"-".repeat(75)}`);
        
        const operations = [
            ['Deposit Commitment', this.results.operations.depositCommitment],
            ['ZK Proof Verification', this.results.operations.zkProofVerification],
            ['Add Trusted Issuer', this.results.operations.addTrustedIssuer]
        ];
        
        operations.forEach(([name, gas]) => {
            const costs = gasPrices.map(gwei => {
                const ethCost = Number(gas) * gwei * 1e-9; // Convert to ETH
                const usdCost = ethCost * ethPrice;
                return `$${usdCost.toFixed(3)}`;
            });
            
            console.log(`   ${name.padEnd(25)} ${costs.map(c => c.padStart(10)).join(' ')}`);
        });
    }

    generateRecommendations() {
        const verificationCost = Number(this.results.operations.zkProofVerification);
        const deploymentCost = Object.values(this.results.deployment).reduce((a, b) => a + b, BigInt(0));
        
        console.log(`   🔹 ZK Proof verification (~${this.formatGas(BigInt(verificationCost))}) is the most expensive operation`);
        
        if (verificationCost > 250000) {
            console.log(`   🔹 Consider batch verification to amortize costs across multiple proofs`);
        }
        
        if (Number(deploymentCost) > 3000000) {
            console.log(`   🔹 Deployment cost is high - consider factory patterns for multiple instances`);
        }
        
        console.log(`   🔹 For production: Deploy on L2 (Polygon, Arbitrum) for 10-100x lower costs`);
        console.log(`   🔹 Implement proof caching to avoid repeated verifications`);
        console.log(`   🔹 Consider using meta-transactions to subsidize user costs`);
    }

    formatGas(gasAmount) {
        const gas = Number(gasAmount);
        return `${gas.toLocaleString()} gas`;
    }
}

// Main execution
async function main() {
    const analyzer = new GasAnalyzer();
    await analyzer.analyzeAll();
}

// Export for use in other modules
module.exports = { GasAnalyzer };

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error("❌ Gas analysis failed:", error);
        process.exitCode = 1;
    });
}