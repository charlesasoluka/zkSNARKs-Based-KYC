# ZK KYC System - Tornado Cash Architecture

A privacy-preserving identity verification system demonstrating how a **trusted issuer** can issue a **DID (verified credential + wallet ID)** to a **user**, who can then access resources (like voting) by generating a **zero-knowledge proof** that can be verified without revealing identity details.

## 🏗️ Architecture

Built around **Tornado Cash** principles with:
- **Nullifier schemes** for preventing double-spending/voting
- **Merkle trees** for efficient batch verification
- **Circom circuits** for zero-knowledge proof generation
- **Smart contracts** for on-chain verification

## 🔄 Core Flow

1. **Trusted Issuer** issues a DID credential to a user
2. **User** generates a commitment and deposits it to the Merkle tree registry
3. **User** generates a ZK proof to access voting without revealing identity
4. **Verifier** validates the proof and grants access

## 📦 Essential Components

### Smart Contracts
- `KYCRegistry.sol` - Merkle tree registry for identity commitments
- `DIDIssuer.sol` - Simple DID credential issuance
- `ZKVoting.sol` - Voting system requiring ZK proofs
- `Verifier.sol` - ZK proof verification
- `MockHasher.sol` - Poseidon hash implementation

### Circuits
- `zkkyc.circom` - Main ZK circuit for identity and age verification
- `circomlib/` - Circuit libraries for cryptographic primitives

### Scripts
- `demo.js` - Complete end-to-end demonstration
- `generate-proof.js` - ZK proof generation utilities
- `deploy-simple.js` - Contract deployment

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Compile contracts and circuits
npm run compile

# Run the complete demo
npm run demo

# Or run individual components
npm test                    # Run contract tests
npm run generate-proof      # Test ZK proof generation
```

## 🔍 Demo Script

The `demo.js` script demonstrates the complete flow:

```bash
node demo.js
```

This will:
1. Deploy all contracts
2. Generate user secrets (nullifier + secret)
3. Issue a DID credential
4. Deposit commitment to Merkle tree
5. Generate ZK proof for voting
6. Attempt to cast a vote
7. Show privacy preservation and security features

## 🧪 Testing

```bash
# Run all tests
npm test

# Test proof generation
npm run generate-proof
```

## 🔐 Privacy Features

- **Zero-Knowledge Proofs**: Prove eligibility without revealing identity
- **Nullifier Schemes**: Prevent double-voting while maintaining privacy
- **Merkle Tree Privacy**: Batch verification without exposing individual commitments
- **Tornado Cash Security**: Battle-tested privacy architecture

## 📂 Project Structure

```
zk_kyc_system/
├── contracts/               # Smart contracts
│   ├── KYCRegistry.sol     # Merkle tree registry
│   ├── DIDIssuer.sol       # DID credential issuer
│   ├── ZKVoting.sol        # Voting with ZK proofs
│   └── Verifier.sol        # ZK proof verifier
├── circuits/               # ZK circuits
│   ├── zkkyc.circom        # Main circuit
│   └── circomlib/          # Circuit libraries
├── scripts/                # Utilities
│   ├── deploy-simple.js    # Contract deployment
│   ├── generate-proof.js   # Proof generation
│   └── merkle-utils.js     # Merkle tree utilities
├── test/                   # Test files
├── demo.js                 # Complete demo
└── README.md              # This file
```

## 🎯 Key Demonstration

This system demonstrates:
- **Privacy-preserving identity verification**
- **Secure voting without identity revelation**
- **Nullifier-based double-spending prevention**
- **Efficient batch verification using Merkle trees**
- **Zero-knowledge proof generation and verification**

The architecture ensures that:
- Users can prove eligibility without revealing identity
- Verifiers can validate proofs without accessing personal data
- The system prevents double-voting while maintaining privacy
- All operations are cryptographically secure and verifiable

## 🔧 Requirements

- Node.js 16+
- Hardhat
- Circom & snarkjs
- Modern terminal for demo output

## 🎉 Usage

Simply run `npm run demo` to see the complete ZK KYC system in action without any frontend dependencies.