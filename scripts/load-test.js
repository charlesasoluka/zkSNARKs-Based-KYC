// scripts/load-test.js
async function loadTest() {
  const numUsers = 100;
  const commitments = [];
  
  console.log(`Testing with ${numUsers} users...`);
  
  for (let i = 0; i < numUsers; i++) {
    const commitment = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(`commitment-${i}`)
    );
    commitments.push(commitment);
  }
  
  const startTime = Date.now();
  
  // Batch deposit commitments
  for (const commitment of commitments) {
    await kycRegistry.depositCommitment(commitment);
  }
  
  const endTime = Date.now();
  console.log(`✅ Processed ${numUsers} commitments in ${endTime - startTime}ms`);
}