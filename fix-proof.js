// Fix the proof generation by properly calculating the merkle root
const snarkjs = require('snarkjs');
const crypto = require('crypto');
const path = require('path');

const WASM_PATH = path.join(__dirname, 'circuits/zkkyc_js/zkkyc.wasm');
const ZKEY_PATH = path.join(__dirname, 'circuits/zkkyc_0001.zkey');

// Helper function to hash two values (simulating Poseidon)
function hash2(left, right) {
  return BigInt('0x' + crypto.createHash('sha256').update(left + right).digest('hex')).toString();
}

// Calculate proper merkle root for single leaf
function calculateMerkleRoot(leaf, pathElements, pathIndices) {
  let current = leaf;
  
  for (let i = 0; i < pathElements.length; i++) {
    const pathElement = pathElements[i];
    const isLeft = pathIndices[i] === '0';
    
    if (isLeft) {
      current = hash2(current, pathElement);
    } else {
      current = hash2(pathElement, current);
    }
  }
  
  return current;
}

async function testProofGeneration() {
  console.log('🔧 Testing Fixed Proof Generation');
  console.log('==================================');
  
  // Test inputs
  const nullifier = "12345";
  const secret = "67890";
  const did = "98765";
  const birthDate = "631152000"; // 1990-01-01
  const currentTime = "1700000000";
  const minimumAge = "18";
  
  // Calculate commitment (simulating Poseidon hash)
  const commitmentInput = nullifier + secret + did;
  const commitment = BigInt('0x' + crypto.createHash('sha256').update(commitmentInput).digest('hex')).toString();
  
  console.log('Commitment:', commitment);
  
  // Create merkle tree path (all zeros for single leaf at position 0)
  const pathElements = new Array(20).fill('0');
  const pathIndices = new Array(20).fill('0');
  
  // Calculate what the root should be
  const calculatedRoot = calculateMerkleRoot(commitment, pathElements, pathIndices);
  console.log('Calculated root:', calculatedRoot);
  
  // Calculate nullifier hash
  const nullifierHashInput = nullifier + currentTime;
  const nullifierHash = BigInt('0x' + crypto.createHash('sha256').update(nullifierHashInput).digest('hex')).toString();
  
  console.log('Nullifier hash:', nullifierHash);
  
  // Prepare circuit inputs
  const inputs = {
    nullifier: nullifier,
    secret: secret,
    did: did,
    pathElements: pathElements,
    pathIndices: pathIndices,
    birthDate: birthDate,
    root: calculatedRoot,
    nullifierHash: nullifierHash,
    currentTime: currentTime,
    minimumAge: minimumAge
  };
  
  console.log('\\n📋 Circuit inputs:');
  console.log(JSON.stringify(inputs, null, 2));
  
  try {
    console.log('\\n🚀 Generating proof...');
    const result = await snarkjs.groth16.fullProve(inputs, WASM_PATH, ZKEY_PATH);
    console.log('✅ Proof generation successful!');
    console.log('Public signals:', result.publicSignals);
    return result;
  } catch (error) {
    console.error('❌ Proof generation failed:', error.message);
    return null;
  }
}

testProofGeneration().then(result => {
  if (result) {
    console.log('\\n🎉 Success! Real ZK proof generated');
  } else {
    console.log('\\n❌ Failed to generate proof');
  }
}).catch(console.error);