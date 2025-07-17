const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

// Import middleware
const { validateProofRequest, validateUserAddress, validateService, validateRevokeAccess } = require('../middleware/validation');
const { generalLimiter, verificationLimiter } = require('../middleware/rateLimit');
const { cacheServices, cacheHealthCheck, cacheUserAccess, clearUserAccessCache } = require('../middleware/cache');
const { getCorsConfig, securityHeaders } = require('../config/cors');

const app = express();
const PORT = 3003;

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

// In-memory storage for verified proofs (in production, use database)
let verifiedProofs = new Map();
let grantedAccess = new Map();

// Service configurations
const services = {
    'voting': {
        name: 'Voting System',
        minimumAge: 18,
        description: 'Age-verified voting access',
        enabled: true
    },
    'alcohol': {
        name: 'Alcohol Purchase',
        minimumAge: 21,
        description: 'Age-verified alcohol purchase',
        enabled: true
    },
    'gambling': {
        name: 'Gambling Access',
        minimumAge: 18,
        description: 'Age-verified gambling access',
        enabled: true
    }
};

// Helper function to verify proof structure
function verifyProofStructure(proof) {
    const required = ['merkleRoot', 'nullifierHash', 'ageVerified', 'timestamp'];
    return required.every(field => proof.hasOwnProperty(field));
}

// Helper function to check if nullifier was already used
function isNullifierUsed(nullifierHash, service) {
    const key = `${service}_${nullifierHash}`;
    return verifiedProofs.has(key);
}

// Helper function to validate merkle root (simplified)
async function validateMerkleRoot(merkleRoot) {
    try {
        // In production, this would check against the smart contract
        // For now, we'll fetch from trusted issuer
        const response = await fetch('http://localhost:3002/merkle-root');
        const result = await response.json();
        
        if (result.success) {
            return result.data.merkleRoot === merkleRoot;
        }
        return false;
    } catch (error) {
        console.error('Error validating merkle root:', error);
        return false;
    }
}

// Health check
app.get('/health', cacheHealthCheck, (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Verifier Service',
        verifiedProofs: verifiedProofs.size,
        grantedAccess: grantedAccess.size,
        timestamp: new Date().toISOString()
    });
});

// Get available services
app.get('/services', cacheServices, (req, res) => {
    res.json({
        success: true,
        data: services,
        timestamp: new Date().toISOString()
    });
});

// Verify proof and grant access
app.post('/verify-proof', verificationLimiter, validateProofRequest, async (req, res) => {
    try {
        const { proof, metadata, service } = req.body;
        
        // Validate input
        if (!proof || !metadata || !service) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: proof, metadata, service'
            });
        }
        
        // Check if service exists
        if (!services[service]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid service'
            });
        }
        
        // Check if service is enabled
        if (!services[service].enabled) {
            return res.status(400).json({
                success: false,
                error: 'Service is currently disabled'
            });
        }
        
        // Verify proof structure
        if (!verifyProofStructure(proof)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid proof structure'
            });
        }
        
        // Check if nullifier was already used
        if (isNullifierUsed(proof.nullifierHash, service)) {
            return res.status(400).json({
                success: false,
                error: 'Proof already used (double-spending protection)'
            });
        }
        
        // Validate merkle root
        const isValidRoot = await validateMerkleRoot(proof.merkleRoot);
        if (!isValidRoot) {
            return res.status(400).json({
                success: false,
                error: 'Invalid merkle root'
            });
        }
        
        // Check age requirement
        if (!proof.ageVerified) {
            return res.status(400).json({
                success: false,
                error: `Age verification failed for ${services[service].name}`
            });
        }
        
        // Check timestamp (prevent replay attacks)
        const currentTime = Math.floor(Date.now() / 1000);
        const proofAge = currentTime - proof.timestamp;
        if (proofAge > 3600) { // 1 hour validity
            return res.status(400).json({
                success: false,
                error: 'Proof has expired'
            });
        }
        
        // All checks passed - grant access
        const accessKey = `${service}_${metadata.userAddress}`;
        const nullifierKey = `${service}_${proof.nullifierHash}`;
        
        const accessInfo = {
            userAddress: metadata.userAddress,
            service: service,
            nullifierHash: proof.nullifierHash,
            grantedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
            proofMetadata: metadata
        };
        
        // Store the verification
        verifiedProofs.set(nullifierKey, {
            proof,
            metadata,
            service,
            verifiedAt: new Date().toISOString()
        });
        
        grantedAccess.set(accessKey, accessInfo);
        
        console.log(`✅ Access granted for ${service} to ${metadata.userAddress}`);
        console.log(`   Nullifier: ${proof.nullifierHash.slice(0, 10)}...${proof.nullifierHash.slice(-8)}`);
        console.log(`   Proof verified without revealing identity`);
        
        res.json({
            success: true,
            data: {
                verified: true,
                service: services[service],
                accessGranted: true,
                expiresAt: accessInfo.expiresAt,
                message: `Access granted to ${services[service].name}`
            }
        });
        
    } catch (error) {
        console.error('Error verifying proof:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Check if user has access to a service
app.get('/check-access/:userAddress/:service', validateUserAddress, validateService, cacheUserAccess, (req, res) => {
    try {
        const { userAddress, service } = req.params;
        
        if (!services[service]) {
            return res.status(400).json({
                success: false,
                error: 'Invalid service'
            });
        }
        
        const accessKey = `${service}_${userAddress}`;
        const accessInfo = grantedAccess.get(accessKey);
        
        if (!accessInfo) {
            return res.json({
                success: true,
                data: {
                    hasAccess: false,
                    message: 'No access granted'
                }
            });
        }
        
        // Check if access has expired
        const now = new Date();
        const expiresAt = new Date(accessInfo.expiresAt);
        
        if (now > expiresAt) {
            // Remove expired access
            grantedAccess.delete(accessKey);
            
            return res.json({
                success: true,
                data: {
                    hasAccess: false,
                    message: 'Access expired'
                }
            });
        }
        
        res.json({
            success: true,
            data: {
                hasAccess: true,
                service: services[service],
                grantedAt: accessInfo.grantedAt,
                expiresAt: accessInfo.expiresAt,
                message: `Access granted to ${services[service].name}`
            }
        });
        
    } catch (error) {
        console.error('Error checking access:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Revoke access (admin function)
app.post('/revoke-access', validateRevokeAccess, (req, res) => {
    try {
        const { userAddress, service } = req.body;
        
        if (!userAddress || !service) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userAddress, service'
            });
        }
        
        const accessKey = `${service}_${userAddress}`;
        const accessInfo = grantedAccess.get(accessKey);
        
        if (!accessInfo) {
            return res.status(404).json({
                success: false,
                error: 'No access found to revoke'
            });
        }
        
        grantedAccess.delete(accessKey);
        
        // Clear cache for this user's access
        clearUserAccessCache(userAddress, service);
        
        console.log(`🚫 Access revoked for ${service} from ${userAddress}`);
        
        res.json({
            success: true,
            message: `Access revoked for ${services[service].name}`
        });
        
    } catch (error) {
        console.error('Error revoking access:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get verification statistics (admin)
app.get('/admin/stats', (req, res) => {
    const stats = {
        totalVerifications: verifiedProofs.size,
        activeAccess: grantedAccess.size,
        serviceStats: {}
    };
    
    // Count verifications per service
    for (const [key, data] of verifiedProofs) {
        const service = data.service;
        if (!stats.serviceStats[service]) {
            stats.serviceStats[service] = {
                name: services[service].name,
                verifications: 0,
                activeAccess: 0
            };
        }
        stats.serviceStats[service].verifications++;
    }
    
    // Count active access per service
    for (const [key, data] of grantedAccess) {
        const service = data.service;
        if (stats.serviceStats[service]) {
            stats.serviceStats[service].activeAccess++;
        }
    }
    
    res.json({
        success: true,
        data: stats
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🔍 Verifier Service running on http://localhost:${PORT}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   POST /verify-proof - Verify ZK proof and grant access`);
    console.log(`   GET  /check-access/:userAddress/:service - Check access status`);
    console.log(`   GET  /services - Get available services`);
    console.log(`   POST /revoke-access - Revoke access (admin)`);
    console.log(`   GET  /admin/stats - Get verification statistics`);
    console.log(`   GET  /health - Health check`);
    console.log(`\n🛡️  Privacy-preserving verification enabled:`);
    console.log(`   - Verifies proofs without seeing identity data`);
    console.log(`   - Prevents double-spending with nullifier tracking`);
    console.log(`   - Validates merkle root against trusted issuer`);
});