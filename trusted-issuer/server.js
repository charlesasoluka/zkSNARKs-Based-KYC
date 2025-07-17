const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Import middleware
const { validateIssueDidRequest, validateUserAddress } = require('../middleware/validation');
const { generalLimiter, didLimiter } = require('../middleware/rateLimit');
const { cacheMerkleRoot, cacheHealthCheck } = require('../middleware/cache');
const { getCorsConfig, securityHeaders } = require('../config/cors');

const app = express();
const PORT = 3002;

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

// In-memory storage (in production, use proper database)
let issuedDIDs = new Map();
let merkleTree = {
    leaves: [],
    root: null,
    height: 20
};

// Helper function to generate random 12-digit ID
function generateRandomID() {
    return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

// Helper function to hash identity data
function hashIdentity(age, name, nationality, randomID) {
    const data = `${age}|${name}|${nationality}|${randomID}`;
    return ethers.keccak256(ethers.toUtf8Bytes(data));
}

// Helper function to calculate merkle root
function calculateMerkleRoot(leaves) {
    if (leaves.length === 0) return ethers.ZeroHash;
    
    let level = [...leaves];
    
    while (level.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = i + 1 < level.length ? level[i + 1] : ethers.ZeroHash;
            nextLevel.push(ethers.keccak256(ethers.concat([left, right])));
        }
        level = nextLevel;
    }
    
    return level[0];
}

// Helper function to generate merkle proof
function generateMerkleProof(leaves, targetLeaf) {
    const targetIndex = leaves.indexOf(targetLeaf);
    if (targetIndex === -1) return null;
    
    const proof = {
        pathElements: [],
        pathIndices: []
    };
    
    let level = [...leaves];
    let index = targetIndex;
    
    while (level.length > 1) {
        const isLeft = index % 2 === 0;
        const siblingIndex = isLeft ? index + 1 : index - 1;
        const sibling = siblingIndex < level.length ? level[siblingIndex] : ethers.ZeroHash;
        
        proof.pathElements.push(sibling);
        proof.pathIndices.push(isLeft ? 0 : 1);
        
        // Move to next level
        const nextLevel = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = i + 1 < level.length ? level[i + 1] : ethers.ZeroHash;
            nextLevel.push(ethers.keccak256(ethers.concat([left, right])));
        }
        
        level = nextLevel;
        index = Math.floor(index / 2);
    }
    
    // Pad to fixed height
    while (proof.pathElements.length < merkleTree.height) {
        proof.pathElements.push(ethers.ZeroHash);
        proof.pathIndices.push(0);
    }
    
    return proof;
}

// Health check
app.get('/health', cacheHealthCheck, (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Trusted Issuer',
        issuedDIDs: issuedDIDs.size,
        merkleRoot: merkleTree.root,
        timestamp: new Date().toISOString()
    });
});

// Issue new DID
app.post('/issue-did', didLimiter, validateIssueDidRequest, async (req, res) => {
    try {
        const { age, name, nationality, userAddress } = req.body;
        
        // Validate input
        if (!age || !name || !nationality || !userAddress) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: age, name, nationality, userAddress'
            });
        }
        
        // Validate age
        if (age < 0 || age > 120) {
            return res.status(400).json({
                success: false,
                error: 'Invalid age'
            });
        }
        
        // Check if user already has a DID
        if (issuedDIDs.has(userAddress)) {
            return res.status(400).json({
                success: false,
                error: 'User already has an issued DID'
            });
        }
        
        // Generate random 12-digit ID
        const randomID = generateRandomID();
        
        // Generate DID
        const did = hashIdentity(age, name, nationality, randomID);
        
        // Store DID info
        const didInfo = {
            userAddress,
            age,
            name,
            nationality,
            randomID,
            did,
            issuedAt: new Date().toISOString(),
            leafIndex: merkleTree.leaves.length
        };
        
        issuedDIDs.set(userAddress, didInfo);
        
        // Add to merkle tree
        merkleTree.leaves.push(did);
        merkleTree.root = calculateMerkleRoot(merkleTree.leaves);
        
        console.log(`✅ DID issued for ${userAddress}`);
        console.log(`   Age: ${age}, Name: ${name}, Nationality: ${nationality}`);
        console.log(`   DID: ${did}`);
        console.log(`   New merkle root: ${merkleTree.root}`);
        
        res.json({
            success: true,
            data: {
                did,
                randomID,
                leafIndex: didInfo.leafIndex,
                merkleRoot: merkleTree.root,
                issuedAt: didInfo.issuedAt
            }
        });
        
    } catch (error) {
        console.error('Error issuing DID:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get merkle proof for a user
app.get('/merkle-proof/:userAddress', validateUserAddress, (req, res) => {
    try {
        const { userAddress } = req.params;
        
        const didInfo = issuedDIDs.get(userAddress);
        if (!didInfo) {
            return res.status(404).json({
                success: false,
                error: 'No DID found for this user'
            });
        }
        
        const proof = generateMerkleProof(merkleTree.leaves, didInfo.did);
        
        res.json({
            success: true,
            data: {
                proof,
                merkleRoot: merkleTree.root,
                leafIndex: didInfo.leafIndex
            }
        });
        
    } catch (error) {
        console.error('Error generating merkle proof:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get current merkle root
app.get('/merkle-root', cacheMerkleRoot, (req, res) => {
    res.json({
        success: true,
        data: {
            merkleRoot: merkleTree.root,
            totalLeaves: merkleTree.leaves.length,
            timestamp: new Date().toISOString()
        }
    });
});

// Get all issued DIDs (for admin purposes)
app.get('/admin/issued-dids', (req, res) => {
    const dids = Array.from(issuedDIDs.values()).map(info => ({
        userAddress: info.userAddress,
        did: info.did,
        leafIndex: info.leafIndex,
        issuedAt: info.issuedAt
    }));
    
    res.json({
        success: true,
        data: dids
    });
});

// Update merkle tree on blockchain (placeholder)
app.post('/update-blockchain', async (req, res) => {
    try {
        // In production, this would update the smart contract with new merkle root
        console.log('📡 Updating blockchain with new merkle root:', merkleTree.root);
        
        // Placeholder for blockchain update
        res.json({
            success: true,
            message: 'Merkle root updated on blockchain',
            merkleRoot: merkleTree.root
        });
        
    } catch (error) {
        console.error('Error updating blockchain:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🏛️  Trusted Issuer Service running on http://localhost:${PORT}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   POST /issue-did - Issue new DID`);
    console.log(`   GET  /merkle-proof/:userAddress - Get merkle proof`);
    console.log(`   GET  /merkle-root - Get current merkle root`);
    console.log(`   GET  /admin/issued-dids - Get all issued DIDs`);
    console.log(`   POST /update-blockchain - Update blockchain`);
    console.log(`   GET  /health - Health check`);
});

// Initialize with empty merkle root
merkleTree.root = ethers.ZeroHash;
console.log('🌳 Merkle tree initialized with empty root:', merkleTree.root);