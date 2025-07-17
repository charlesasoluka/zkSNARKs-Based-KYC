const express = require('express');
const cors = require('cors');
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

// Import middleware
const { generalLimiter, proofLimiter } = require('../middleware/rateLimit');
const { cacheHealthCheck } = require('../middleware/cache');
const { getCorsConfig, securityHeaders } = require('../config/cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors(getCorsConfig()));
app.use(securityHeaders);
app.use(express.json({ limit: '10mb' }));
app.use(generalLimiter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload'
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Request payload too large'
    });
  }
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Paths to circuit files
const WASM_PATH = path.join(__dirname, '../circuits/zkkyc_js/zkkyc.wasm');
const ZKEY_PATH = path.join(__dirname, '../circuits/zkkyc_0001.zkey');
const VKEY_PATH = path.join(__dirname, '../circuits/verification_key.json');

// Check if required files exist
const requiredFiles = [
  { path: WASM_PATH, name: 'WASM file' },
  { path: ZKEY_PATH, name: 'zKey file' },
  { path: VKEY_PATH, name: 'Verification key' }
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file.path)) {
    console.error(`❌ Missing ${file.name}: ${file.path}`);
    process.exit(1);
  }
}

console.log('✅ All required circuit files found');

// Utility function to prepare circuit inputs
function prepareCircuitInputs(inputs) {
  const {
    nullifier,
    secret,
    did,
    birthDate,
    currentTime,
    minimumAge,
    merkleRoot,
    nullifierHash,
    merkleProof
  } = inputs;

  const MERKLE_TREE_HEIGHT = 20;
  
  // Convert birth date to timestamp if it's a string
  const birthTimestamp = typeof birthDate === 'string' 
    ? Math.floor(new Date(birthDate).getTime() / 1000)
    : birthDate;

  // For this demo, we'll create a simple single-leaf merkle tree
  // In production, this would be a proper merkle tree with multiple leaves
  const pathElements = new Array(MERKLE_TREE_HEIGHT).fill('0');
  const pathIndices = new Array(MERKLE_TREE_HEIGHT).fill('0');
  
  // If merkleProof is provided, use it
  if (merkleProof && merkleProof.pathElements) {
    for (let i = 0; i < Math.min(merkleProof.pathElements.length, MERKLE_TREE_HEIGHT); i++) {
      pathElements[i] = merkleProof.pathElements[i];
      pathIndices[i] = merkleProof.pathIndices[i];
    }
  }
  
  // Calculate the actual commitment from the inputs
  const crypto = require('crypto');
  const poseidon = require('poseidon-lite');
  
  // For this demo, we'll use a simple hash-based commitment
  // In production, this would use proper Poseidon hash
  const commitmentHash = crypto.createHash('sha256')
    .update(toBigInt(nullifier) + toBigInt(secret) + toBigInt(did))
    .digest('hex');
  
  // Create a simple single-leaf merkle tree root
  // The root should be the commitment itself for a single-leaf tree
  const calculatedRoot = '0x' + commitmentHash;

  return {
    // Private inputs
    nullifier: toBigInt(nullifier),
    secret: toBigInt(secret),
    did: toBigInt(did),
    pathElements: pathElements.map(x => toBigInt(x)),
    pathIndices: pathIndices.map(x => toBigInt(x)),
    birthDate: birthTimestamp.toString(),
    
    // Public inputs
    root: toBigInt(calculatedRoot),
    nullifierHash: toBigInt(nullifierHash),
    currentTime: currentTime.toString(),
    minimumAge: minimumAge.toString()
  };
}

// Utility function to convert to BigInt
function toBigInt(value) {
  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      return BigInt(value).toString();
    }
    // For non-hex strings, try to parse as number first
    const num = Number(value);
    if (!isNaN(num)) {
      return BigInt(num).toString();
    }
    // If not a number, hash the string
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(value).digest('hex');
    return BigInt('0x' + hash).toString();
  }
  if (typeof value === 'number') {
    return BigInt(value).toString();
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return BigInt(value || 0).toString();
}

// Format proof for smart contract
function formatProofForContract(proof) {
  return {
    pi_a: [proof.pi_a[0], proof.pi_a[1]],
    pi_b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
    pi_c: [proof.pi_c[0], proof.pi_c[1]]
  };
}

// Health check endpoint
app.get('/health', cacheHealthCheck, (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'ZK Proof Server is running',
    timestamp: new Date().toISOString()
  });
});

// Generate ZK proof endpoint
app.post('/generate-proof', proofLimiter, async (req, res) => {
  try {
    console.log('Received proof generation request');
    console.log('Input data:', req.body);
    
    // Prepare circuit inputs
    const circuitInputs = prepareCircuitInputs(req.body);
    console.log('Circuit inputs prepared');
    
    // Generate witness and proof
    console.log('Generating ZK proof...');
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      WASM_PATH,
      ZKEY_PATH
    );
    
    console.log('ZK proof generated successfully');
    console.log('Public signals:', publicSignals);
    
    // Format proof for contract
    const formattedProof = formatProofForContract(proof);
    
    res.json({
      success: true,
      proof: formattedProof,
      publicSignals: publicSignals
    });
    
  } catch (error) {
    console.error('Error generating proof:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString()
    });
  }
});

// Verify ZK proof endpoint
app.post('/verify-proof', proofLimiter, async (req, res) => {
  try {
    const { proof, publicSignals } = req.body;
    console.log('Verifying ZK proof...');
    
    // Load verification key
    const vKey = JSON.parse(fs.readFileSync(VKEY_PATH, 'utf8'));
    
    // Verify the proof
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    
    console.log('Proof verification result:', isValid);
    
    res.json({
      success: true,
      isValid: isValid
    });
    
  } catch (error) {
    console.error('Error verifying proof:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ZK Proof Server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   POST /generate-proof - Generate ZK proof`);
  console.log(`   POST /verify-proof - Verify ZK proof`);
});