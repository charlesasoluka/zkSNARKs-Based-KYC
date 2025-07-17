const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

// Serve all static files from the root directory
app.use(express.static(__dirname));

// Main routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Main app running' });
});

// Start the main app
app.listen(PORT, () => {
    console.log(`🏠 ZK-KYC Main Application running on http://localhost:${PORT}`);
    console.log(`\n📋 Available interfaces:`);
    console.log(`   🏛️  Trusted Issuer: http://localhost:${PORT}/trusted-issuer/frontend/index.html`);
    console.log(`   🔍 Verifier Service: http://localhost:${PORT}/verifier-service/frontend/index.html`);
    console.log(`   👤 User Interface: http://localhost:${PORT}/user-interface/index.html`);
    console.log(`\n🔐 Backend services need to be started separately:`);
    console.log(`   Run: node trusted-issuer/server.js`);
    console.log(`   Run: node verifier-service/server.js`);
});