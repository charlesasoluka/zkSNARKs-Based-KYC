const ethers = require('ethers');

// Test proof generation debugging
async function testProofGeneration() {
  console.log('🔍 Debugging ZK Proof Generation');
  console.log('=================================');
  
  // Test 1: Check if proof server is running
  try {
    const response = await fetch('http://localhost:3001/health');
    if (response.ok) {
      const health = await response.json();
      console.log('✅ Proof server health:', health);
    } else {
      console.log('❌ Proof server not responding');
      return;
    }
  } catch (error) {
    console.log('❌ Cannot connect to proof server:', error.message);
    return;
  }
  
  // Test 2: Generate sample identity data
  console.log('\n🔢 Generating sample identity data...');
  
  const account = '0x1234567890123456789012345678901234567890';
  const did = `did:zkkyc:${account}`;
  const nullifier = ethers.hexlify(ethers.randomBytes(32));
  const secret = ethers.hexlify(ethers.randomBytes(32));
  const commitment = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'bytes32', 'bytes32'], [nullifier, secret, ethers.keccak256(ethers.toUtf8Bytes(did))])
  );
  
  console.log('DID:', did);
  console.log('Nullifier:', nullifier);
  console.log('Secret:', secret);
  console.log('Commitment:', commitment);
  
  // Test 3: Generate nullifier hash
  const currentTime = Math.floor(Date.now() / 1000);
  const nullifierHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'uint256'], [nullifier, currentTime])
  );
  
  console.log('Current time:', currentTime);
  console.log('Nullifier hash:', nullifierHash);
  
  // Test 4: Create merkle tree
  const merkleRoot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(['bytes32[]'], [[commitment]])
  );
  
  console.log('Merkle root:', merkleRoot);
  
  // Test 5: Prepare proof inputs
  const birthDate = '1990-01-01';
  const birthTimestamp = Math.floor(new Date(birthDate).getTime() / 1000);
  const minimumAge = 18;
  
  const proofInputs = {
    nullifier: nullifier,
    secret: secret,
    did: did,
    birthDate: birthTimestamp,
    currentTime: currentTime,
    minimumAge: minimumAge,
    merkleRoot: merkleRoot,
    nullifierHash: nullifierHash
  };
  
  console.log('\n📋 Proof inputs:');
  console.log(JSON.stringify(proofInputs, null, 2));
  
  // Test 6: Send to proof server
  try {
    console.log('\n🚀 Sending to proof server...');
    const response = await fetch('http://localhost:3001/generate-proof', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(proofInputs)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Proof generation successful!');
      console.log('Proof:', result.proof);
      console.log('Public signals:', result.publicSignals);
    } else {
      console.log('❌ Proof generation failed:', result.error);
      console.log('Details:', result.details);
    }
  } catch (error) {
    console.log('❌ Error calling proof server:', error.message);
  }
}

// Run the test
testProofGeneration().catch(console.error);