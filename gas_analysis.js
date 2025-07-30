#!/usr/bin/env node

const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const { poseidon2, poseidon3 } = require("poseidon-lite");
const path = require("path");
const crypto = require("crypto");

async function analyzeGasAndProofSize() {
    console.log("⛽ Analyzing Gas Costs and Proof Sizes...\n");
    
    // Deploy contracts with gas tracking
    const [deployer, issuer1, user1] = await ethers.getSigners();
    
    console.log("📦 Contract Deployment Gas Costs:");
    
    // Deploy SimpleHasher
    const SimpleHasher = await ethers.getContractFactory("SimpleHasher");
    const hasher = await SimpleHasher.deploy();
    const hasherReceipt = await hasher.deploymentTransaction().wait();
    console.log(`   SimpleHasher: ${hasherReceipt.gasUsed.toString()} gas`);
    
    // Deploy KYC Registry
    const KYCRegistry = await ethers.getContractFactory("KYCRegistry");
    const kycRegistry = await KYCRegistry.deploy(
        await hasher.getAddress(),
        20,
        [issuer1.address]
    );
    const registryReceipt = await kycRegistry.deploymentTransaction().wait();
    console.log(`   KYCRegistry: ${registryReceipt.gasUsed.toString()} gas`);
    
    // Deploy Verifier
    const Verifier = await ethers.getContractFactory("Verifier");
    const verifier = await Verifier.deploy();
    const verifierReceipt = await verifier.deploymentTransaction().wait();
    console.log(`   Verifier: ${verifierReceipt.gasUsed.toString()} gas`);
    
    // Deploy Access Controller
    const ZKAccessController = await ethers.getContractFactory("ZKAccessController");
    const accessController = await ZKAccessController.deploy(
        await kycRegistry.getAddress(),
        await verifier.getAddress()
    );
    const controllerReceipt = await accessController.deploymentTransaction().wait();
    console.log(`   ZKAccessController: ${controllerReceipt.gasUsed.toString()} gas`);
    
    const totalDeploymentGas = hasherReceipt.gasUsed + registryReceipt.gasUsed + 
                               verifierReceipt.gasUsed + controllerReceipt.gasUsed;
    console.log(`   📊 Total Deployment: ${totalDeploymentGas.toString()} gas\n`);
    
    console.log("💰 Transaction Gas Costs:");
    
    // Test commitment deposit
    const commitment = ethers.zeroPadValue(ethers.toBeHex(BigInt("12345678901234567890")), 32);
    const depositTx = await kycRegistry.connect(user1).depositCommitment(commitment);
    const depositReceipt = await depositTx.wait();
    console.log(`   Deposit Commitment: ${depositReceipt.gasUsed.toString()} gas`);
    
    // Generate a real proof and measure its size
    console.log("\n🔍 Generating ZK Proof for Size Analysis...");
    
    const FIELD_SIZE = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    
    function toFieldElement(input) {
        if (typeof input === 'bigint') {
            return input % FIELD_SIZE;
        }
        return BigInt(input) % FIELD_SIZE;
    }
    
    const poseidon = (inputs) => {
        if (inputs.length === 2) {
            return poseidon2(inputs);
        } else if (inputs.length === 3) {
            return poseidon3(inputs);
        }
        throw new Error(`Unsupported input length: ${inputs.length}`);
    };
    
    // Generate test values
    const nullifier = toFieldElement(BigInt("0x" + crypto.randomBytes(32).toString("hex")));
    const secret = toFieldElement(BigInt("0x" + crypto.randomBytes(32).toString("hex")));
    const did = toFieldElement(BigInt("0x" + crypto.randomBytes(32).toString("hex")));
    const recipient = toFieldElement(BigInt(user1.address));
    
    const testCommitment = toFieldElement(poseidon([nullifier, secret, did]));
    const nullifierHash = toFieldElement(poseidon([nullifier, recipient]));
    
    const circuitInputs = {
        nullifier: nullifier.toString(),
        secret: secret.toString(),
        did: did.toString(),
        commitment: testCommitment.toString(),
        nullifierHash: nullifierHash.toString(),
        recipient: recipient.toString()
    };
    
    const circuitWasm = path.join(__dirname, "circuits/zkkyc_final_js/zkkyc_final.wasm");
    const circuitZkey = path.join(__dirname, "circuits/zkkyc_final_0000.zkey");
    
    try {
        const startTime = Date.now();
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            circuitInputs,
            circuitWasm,
            circuitZkey
        );
        const proofTime = Date.now() - startTime;
        
        console.log(`   ⏱️  Proof Generation Time: ${proofTime}ms`);
        
        // Analyze proof size
        const proofJson = JSON.stringify(proof);
        const proofSize = Buffer.byteLength(proofJson, 'utf8');
        console.log(`   📏 Proof JSON Size: ${proofSize} bytes`);
        
        // Solidity-formatted proof components
        const solidityProofData = {
            pA: [proof.pi_a[0], proof.pi_a[1]],
            pB: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
            pC: [proof.pi_c[0], proof.pi_c[1]]
        };
        
        // Calculate calldata size for on-chain verification
        const calldataSize = {
            pA: 2 * 32,      // 2 field elements, 32 bytes each
            pB: 4 * 32,      // 4 field elements, 32 bytes each  
            pC: 2 * 32,      // 2 field elements, 32 bytes each
            publicSignals: publicSignals.length * 32, // public signals
            other: 4 * 32    // function selector + other params
        };
        
        const totalCalldata = Object.values(calldataSize).reduce((a, b) => a + b, 0);
        console.log(`   📤 Calldata Size: ${totalCalldata} bytes`);
        
        console.log(`   🔢 Public Signals: ${publicSignals.length} values`);
        console.log(`   🔐 Proof Components:`);
        console.log(`      - pA: 2 x 32 bytes = 64 bytes`);
        console.log(`      - pB: 4 x 32 bytes = 128 bytes`);
        console.log(`      - pC: 2 x 32 bytes = 64 bytes`);
        console.log(`      - Total Core Proof: 256 bytes`);
        
        // Estimate verification gas (based on typical zk-SNARK verifiers)
        console.log(`\n⛽ Estimated Gas Costs:`);
        console.log(`   📤 Calldata: ~${Math.ceil(totalCalldata * 16)} gas (16 gas per byte)`);
        console.log(`   🔍 Proof Verification: ~280,000-350,000 gas (typical for Groth16)`);
        console.log(`   💾 Storage Updates: ~20,000-40,000 gas (nullifier tracking)`);
        console.log(`   📊 Total Per Verification: ~320,000-410,000 gas`);
        
        // Cost estimates
        const gasPrice = 20; // 20 gwei
        const ethPrice = 2000; // $2000 per ETH
        const costPerVerification = (350000 * gasPrice * ethPrice) / 1e18;
        console.log(`   💵 Cost at 20 gwei, $2000 ETH: ~$${costPerVerification.toFixed(2)} per verification`);
        
    } catch (error) {
        console.log(`   ❌ Proof generation failed: ${error.message}`);
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   🏗️  Total deployment cost: ~${Math.ceil(Number(totalDeploymentGas) * 1.2)} gas`);
    console.log(`   💰 Per commitment deposit: ~${depositReceipt.gasUsed.toString()} gas`);
    console.log(`   🔍 Per proof verification: ~350,000 gas (estimated)`);
    console.log(`   📏 Proof size: ~256 bytes core + calldata overhead`);
    console.log(`   ⏱️  Proof generation: ~200-600ms client-side`);
}

analyzeGasAndProofSize().catch(console.error);