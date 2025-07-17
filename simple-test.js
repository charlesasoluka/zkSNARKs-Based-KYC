// Simple test to check if the basic proof generation works
const fs = require('fs');
const path = require('path');

// Test if we can load the circuit files
const WASM_PATH = path.join(__dirname, 'circuits/zkkyc_js/zkkyc.wasm');
const ZKEY_PATH = path.join(__dirname, 'circuits/zkkyc_0001.zkey');

console.log('🔍 Testing Circuit File Access');
console.log('==============================');

console.log('WASM file exists:', fs.existsSync(WASM_PATH));
console.log('ZKEY file exists:', fs.existsSync(ZKEY_PATH));

if (fs.existsSync(WASM_PATH)) {
  const wasmStat = fs.statSync(WASM_PATH);
  console.log('WASM file size:', wasmStat.size, 'bytes');
}

if (fs.existsSync(ZKEY_PATH)) {
  const zkeyStat = fs.statSync(ZKEY_PATH);
  console.log('ZKEY file size:', zkeyStat.size, 'bytes');
}

// Test basic snarkjs functionality
try {
  const snarkjs = require('snarkjs');
  console.log('✅ snarkjs loaded successfully');
  
  // Test if we can load the wasm file
  console.log('\n🔧 Testing WASM loading...');
  
  // Simple test inputs that should work with the circuit
  const testInputs = {
    nullifier: "1",
    secret: "2", 
    did: "3",
    pathElements: new Array(20).fill("0"),
    pathIndices: new Array(20).fill("0"),
    birthDate: "631152000", // 1990-01-01
    root: "1", // Simple root
    nullifierHash: "123", 
    currentTime: "1700000000",
    minimumAge: "18"
  };
  
  console.log('Test inputs:', testInputs);
  
  // Try to generate witness
  snarkjs.groth16.fullProve(testInputs, WASM_PATH, ZKEY_PATH)
    .then(result => {
      console.log('✅ Proof generation successful!');
      console.log('Proof:', result.proof);
      console.log('Public signals:', result.publicSignals);
    })
    .catch(error => {
      console.error('❌ Proof generation failed:', error.message);
    });
    
} catch (error) {
  console.error('❌ Error loading snarkjs:', error.message);
}