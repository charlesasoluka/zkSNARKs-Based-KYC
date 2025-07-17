const { ethers } = require('hardhat');
const contractAddresses = require('../frontend/src/config/contracts.json');

async function main() {
  console.log('Configuring voting service...');
  
  // Get the contract
  const AccessController = await ethers.getContractFactory('ZKAccessController');
  const accessController = AccessController.attach(contractAddresses.contracts.accessController);
  
  // Check current configuration
  try {
    const config = await accessController.getServiceConfig('voting');
    console.log('Current voting service config:', {
      enabled: config.enabled,
      minimumAge: config.minimumAge.toString(),
      validityPeriod: config.validityPeriod.toString()
    });
    
    if (!config.enabled) {
      console.log('Voting service is not enabled. Configuring...');
      
      // Configure voting service
      const tx = await accessController.configureService(
        'voting',
        true,          // enabled
        18,            // minimum age (18 years)
        86400          // validity period (24 hours in seconds)
      );
      
      await tx.wait();
      console.log('Voting service configured successfully!');
      
      // Verify configuration
      const newConfig = await accessController.getServiceConfig('voting');
      console.log('New voting service config:', {
        enabled: newConfig.enabled,
        minimumAge: newConfig.minimumAge.toString(),
        validityPeriod: newConfig.validityPeriod.toString()
      });
    } else {
      console.log('Voting service is already enabled');
    }
  } catch (error) {
    console.error('Error:', error.message);
    
    if (error.message.includes('Ownable: caller is not the owner')) {
      console.log('❌ You are not the owner of this contract. Only the owner can configure services.');
    } else if (error.message.includes('call revert exception')) {
      console.log('❌ Contract call failed. Make sure you are on the correct network (Sepolia).');
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});