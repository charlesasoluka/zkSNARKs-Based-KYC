const { spawn } = require('child_process');
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from the root directory
app.use(express.static(__dirname));

// Main application routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Specific routes for each service frontend
app.get('/trusted-issuer/frontend/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'trusted-issuer/frontend/index.html'));
});

app.get('/user-interface/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'user-interface/index.html'));
});

app.get('/verifier-service/frontend/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'verifier-service/frontend/index.html'));
});

// Service health checks
app.get('/health', (req, res) => {
    res.json({
        mainApp: 'OK',
        message: 'ZK-KYC Main Application is running'
    });
});

let trustedIssuer, verifierService;

// Start all services
function startServices() {
    console.log('🚀 Starting ZK-KYC System Services...\n');

    // Start Trusted Issuer
    trustedIssuer = spawn('node', ['trusted-issuer/server.js'], {
        stdio: 'inherit',
        cwd: __dirname
    });

    // Start Verifier Service  
    verifierService = spawn('node', ['verifier-service/server.js'], {
        stdio: 'inherit',
        cwd: __dirname
    });

    // Handle process exits
    trustedIssuer.on('exit', (code) => {
        if (code !== 0) {
            console.log(`\n❌ Trusted Issuer exited with code ${code}`);
        }
    });

    verifierService.on('exit', (code) => {
        if (code !== 0) {
            console.log(`\n❌ Verifier Service exited with code ${code}`);
        }
    });

    // Handle main app shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down ZK-KYC System...');
        if (trustedIssuer) trustedIssuer.kill();
        if (verifierService) verifierService.kill();
        process.exit(0);
    });
}

// Start main application
app.listen(PORT, () => {
    console.log(`🏠 ZK-KYC Main Application running on http://localhost:${PORT}`);
    console.log(`📋 Available services:`);
    console.log(`   🏛️  Trusted Issuer: http://localhost:3002`);
    console.log(`   🔍 Verifier Service: http://localhost:3003`);
    console.log(`   👤 User Interface: Integrated in main app`);
    console.log(`\n🔐 Three-party architecture active:`);
    console.log(`   1. Trusted Issuer generates DIDs`);
    console.log(`   2. Users receive DIDs and generate proofs`);
    console.log(`   3. Verifier validates proofs without seeing identity`);
    console.log(`\nStarting backend services...`);
    
    // Give the main app a moment to start, then start the services
    setTimeout(startServices, 1000);
});