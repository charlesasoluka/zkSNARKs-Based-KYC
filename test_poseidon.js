#!/usr/bin/env node

const circomlibjs = require("circomlibjs");
const snarkjs = require("snarkjs");
const path = require("path");

async function testPoseidonConsistency() {
    console.log("🧪 Testing Poseidon hash consistency...");
    
    // Initialize Poseidon
    const poseidon = await circomlibjs.buildPoseidon();
    const FIELD_SIZE = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    
    // Convert to field element
    function toFieldElement(input) {
        if (typeof input === 'bigint') {
            return input % FIELD_SIZE;
        } else if (typeof input === 'string') {
            return BigInt(input) % FIELD_SIZE;
        } else if (input && input.length) {
            return BigInt("0x" + Buffer.from(input).toString('hex')) % FIELD_SIZE;
        } else {
            return BigInt(input) % FIELD_SIZE;
        }
    }
    
    // Test values matching the circuit
    const nullifier = BigInt("12345678901234567890");
    const secret = BigInt("98765432109876543210");
    const did = BigInt("11111111111111111111");
    
    console.log("Input values:");
    console.log("  nullifier:", nullifier.toString());
    console.log("  secret:", secret.toString());
    console.log("  did:", did.toString());
    
    // Compute hash using JavaScript
    const jsHash = toFieldElement(poseidon([nullifier, secret, did]));
    console.log("JS Poseidon result:", jsHash.toString());
    
    // Test with simple circuit
    const circuitInputs = {
        nullifier: nullifier.toString(),
        secret: secret.toString(),
        did: did.toString(),
        commitment: jsHash.toString(),
        nullifierHash: "0",  // dummy
        recipient: "0"       // dummy  
    };
    
    try {
        console.log("🔬 Testing with circuit...");
        const circuitWasm = path.join(__dirname, "circuits/zkkyc_final_js/zkkyc_final.wasm");
        const circuitZkey = path.join(__dirname, "circuits/zkkyc_final_0000.zkey");
        
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            circuitInputs,
            circuitWasm,
            circuitZkey
        );
        
        console.log("✅ Circuit proof succeeded!");
        console.log("Public signals:", publicSignals);
        
    } catch (error) {
        console.log("❌ Circuit failed:", error.message);
        
        // Try to generate witness only to see intermediate values
        try {
            const witness = await snarkjs.wtns.calculate(circuitInputs, circuitWasm);
            console.log("Witness calculated, circuit hash should be witness[1]");
            console.log("Circuit commitment output:", witness[1]);
            console.log("Matches JS:", witness[1] === jsHash.toString());
        } catch (witnessError) {
            console.log("Witness calculation failed:", witnessError.message);
        }
    }
}

testPoseidonConsistency().catch(console.error);