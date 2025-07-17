#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting ZK-KYC Development Environment');
console.log('==========================================');

// Start proof server
console.log('📡 Starting ZK Proof Server...');
const proofServer = spawn('node', ['scripts/proof-server.js'], {
  stdio: 'inherit',
  cwd: process.cwd()
});

// Wait a bit for proof server to start
setTimeout(() => {
  console.log('\n💻 Starting Frontend Development Server...');
  const frontendServer = spawn('npm', ['start'], {
    stdio: 'inherit',
    cwd: path.join(process.cwd(), 'frontend')
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down servers...');
    proofServer.kill();
    frontendServer.kill();
    process.exit(0);
  });

  proofServer.on('error', (err) => {
    console.error('❌ Proof server error:', err);
  });

  frontendServer.on('error', (err) => {
    console.error('❌ Frontend server error:', err);
  });

}, 2000);

console.log('\n📋 Development Environment:');
console.log('  🔧 Proof Server: http://localhost:3001');
console.log('  🌐 Frontend: http://localhost:3000');
console.log('\n⚡ Press Ctrl+C to stop both servers');