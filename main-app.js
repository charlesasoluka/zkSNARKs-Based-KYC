const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('public'));

// Main application routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Service health checks
app.get('/health', async (req, res) => {
    try {
        const healthChecks = await Promise.all([
            fetch('http://localhost:3002/health').then(r => r.json()).catch(() => ({ status: 'DOWN', service: 'Trusted Issuer' })),
            fetch('http://localhost:3003/health').then(r => r.json()).catch(() => ({ status: 'DOWN', service: 'Verifier Service' }))
        ]);

        res.json({
            mainApp: 'OK',
            services: healthChecks
        });
    } catch (error) {
        res.status(500).json({
            mainApp: 'ERROR',
            error: error.message
        });
    }
});

// Start all services
function startServices() {
    console.log('🚀 Starting ZK-KYC System Services...\n');

    // Start Trusted Issuer
    const trustedIssuer = spawn('node', ['trusted-issuer/server.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: __dirname
    });

    // Start Verifier Service
    const verifierService = spawn('node', ['verifier-service/server.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: __dirname
    });

    // Handle Trusted Issuer output
    trustedIssuer.stdout.on('data', (data) => {
        console.log(`[Trusted Issuer] ${data}`);
    });

    trustedIssuer.stderr.on('data', (data) => {
        console.error(`[Trusted Issuer Error] ${data}`);
    });

    // Handle Verifier Service output
    verifierService.stdout.on('data', (data) => {
        console.log(`[Verifier Service] ${data}`);
    });

    verifierService.stderr.on('data', (data) => {
        console.error(`[Verifier Service Error] ${data}`);
    });

    // Handle process exits
    trustedIssuer.on('exit', (code, signal) => {
        console.log(`\n❌ Trusted Issuer exited with code ${code} and signal ${signal}`);
        if (code !== 0 && code !== null) {
            console.log('Restarting Trusted Issuer...');
            setTimeout(() => startServices(), 2000);
        }
    });

    verifierService.on('exit', (code, signal) => {
        console.log(`\n❌ Verifier Service exited with code ${code} and signal ${signal}`);
        if (code !== 0 && code !== null) {
            console.log('Restarting Verifier Service...');
            setTimeout(() => startServices(), 2000);
        }
    });

    // Handle main app shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down ZK-KYC System...');
        trustedIssuer.kill('SIGTERM');
        verifierService.kill('SIGTERM');
        setTimeout(() => {
            trustedIssuer.kill('SIGKILL');
            verifierService.kill('SIGKILL');
            process.exit(0);
        }, 3000);
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
    
    startServices();
});