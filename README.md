# ZK-KYC System - Three-Party Architecture

A privacy-preserving identity verification system based on Zero-Knowledge proofs and the Tornado Cash architecture. This system implements a three-party model where a Trusted Issuer generates DIDs, Users receive DIDs and generate proofs, and a Verifier validates proofs without seeing identity data.

## 🏛️ System Architecture

### Three-Party Model

1. **Trusted Issuer (Government/Authority)**
   - Issues verified identity credentials
   - Generates DID = hash(age, name, nationality, randomID)
   - Maintains merkle tree state
   - Port: 3002

2. **User (Identity Holder)**
   - Receives DID from trusted issuer
   - Generates zero-knowledge proofs
   - Submits proofs to verifier
   - Integrated in main app

3. **Verifier (Service Provider)**
   - Validates proofs without seeing identity
   - Grants/denies access based on proof validity
   - Never sees actual identity data
   - Port: 3003

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm
- Modern web browser with MetaMask (for user interface)

### Installation & Setup

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd zk_kyc_system
npm install
```

2. **Start the complete system:**
```bash
npm start
```

This will start:
- Main application at http://localhost:3000
- Trusted Issuer service at http://localhost:3002
- Verifier service at http://localhost:3003

3. **Access the interfaces:**
- Main Dashboard: http://localhost:3000
- Trusted Issuer: http://localhost:3000 → "Open Issuer Dashboard"
- User Interface: http://localhost:3000 → "Open User Dashboard"
- Verifier Dashboard: http://localhost:3000 → "Open Verifier Dashboard"

## 🔄 Complete Workflow

### Step 1: DID Issuance (Trusted Issuer)
1. Open Trusted Issuer Dashboard
2. Fill in user details (age, name, nationality, wallet address)
3. Click "Issue DID"
4. DID is generated and added to merkle tree

### Step 2: Proof Generation (User)
1. Open User Dashboard
2. Connect MetaMask wallet
3. Request DID from trusted issuer
4. Generate zero-knowledge proof
5. Submit proof to verifier

### Step 3: Proof Verification (Verifier)
1. Verifier automatically validates submitted proofs
2. Checks merkle root against trusted issuer
3. Verifies nullifier hasn't been used
4. Grants access without seeing identity

## 🔐 Privacy Features

- **Zero-Knowledge Proofs**: Prove age without revealing personal information
- **Merkle Tree Privacy**: Identity commitment without exposure
- **Nullifier Protection**: Prevents double-spending and replay attacks
- **Decentralized Verification**: No central authority sees user data
- **Time-based Expiry**: Proofs expire after 1 hour, access after 24 hours

## 📁 Project Structure

```
zk_kyc_system/
├── main-app.js              # Main application server
├── index.html               # Main dashboard
├── trusted-issuer/
│   ├── server.js            # Trusted issuer service
│   └── frontend/
│       └── index.html       # Issuer dashboard
├── user-interface/
│   ├── index.html           # User dashboard
│   └── src/
│       └── components/
│           └── UserDashboard.js
├── verifier-service/
│   ├── server.js            # Verifier service
│   └── frontend/
│       └── index.html       # Verifier dashboard
├── frontend/                # Original frontend (legacy)
├── contracts/               # Smart contracts
├── circuits/                # ZK circuits
└── scripts/                 # Deployment scripts
```

## 🔐 System Architecture

### Circuit Layer
- **zkkyc.circom**: Main circuit proving identity membership and age
- **MerkleTreeInclusionProof**: Proves commitment exists in registry
- **AgeVerification**: Proves age without revealing birthdate
- **ZKKYCAge**: Combined circuit for KYC and age verification

### Contract Layer
- **KYCRegistry**: Stores identity commitments in Merkle tree
- **ZKAccessController**: Manages service access based on proofs
- **IdentityIssuer**: Issues and manages credentials
- **MerkleTreeWithHistory**: Efficient Merkle tree with history

### Frontend Layer
- **ZKKYCWallet**: Main user interface component
- **Web3Context**: Ethereum wallet integration
- **ZKKYCContext**: ZK-KYC system state management

## 🎯 Usage Examples

### 1. Creating an Identity
```javascript
const { IdentityManager } = require('./scripts/merkle-utils');

const identityManager = new IdentityManager();
const identity = identityManager.createIdentity('did:zkkyc:user123');
console.log('Identity created:', identity);
```

### 2. Registering a Commitment
```javascript
const tx = await kycRegistry.depositCommitment(identity.commitment);
await tx.wait();
console.log('Commitment registered');
```

### 3. Generating a Proof
```javascript
const { ProofGenerator } = require('./scripts/generate-proof');

const proofGenerator = new ProofGenerator();
const inputs = {
  nullifier: identity.nullifier,
  secret: identity.secret,
  did: identity.did,
  // ... other inputs
};

const { proof, publicSignals } = await proofGenerator.generateProof(inputs);
```

### 4. Verifying Access
```javascript
const proofData = {
  pA: proof.pi_a.slice(0, 2),
  pB: [proof.pi_b[0].slice(0, 2), proof.pi_b[1].slice(0, 2)],
  pC: proof.pi_c.slice(0, 2),
  publicSignals: publicSignals.slice(0, 4)
};

const tx = await accessController.verifyKYCAndGrantAccess(proofData, "service-name");
await tx.wait();
```

## 📊 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Compile smart contracts |
| `npm run test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage |
| `npm run deploy` | Deploy to configured network |
| `npm run deploy:localhost` | Deploy to local network |
| `npm run node` | Start local Hardhat node |
| `npm run setup-circuits` | Compile and setup circuits |
| `npm run generate-proof` | Generate example proof |
| `npm run full-setup` | Complete setup and deployment |

## 🧪 Testing

The system includes comprehensive tests covering:

- **Contract Tests**: All smart contract functionality
- **Circuit Tests**: ZK circuit verification
- **Integration Tests**: End-to-end workflows
- **Utility Tests**: Merkle tree and identity operations

Run tests with:
```bash
npm run test
```

## 🌐 Network Configuration

### Supported Networks
- **Localhost**: Development and testing
- **Sepolia**: Ethereum testnet
- **Mainnet**: Ethereum mainnet (production)

### Configuration
Update `hardhat.config.js` with your network settings:

```javascript
module.exports = {
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [PRIVATE_KEY]
    }
  }
};
```

## 🔒 Security Considerations

### Circuit Security
- **Trusted Setup**: Use production-ready powers of tau
- **Constraint Verification**: All circuits properly constrained
- **Input Validation**: Comprehensive input validation

### Contract Security
- **Access Control**: Proper role-based permissions
- **Reentrancy Protection**: All state-changing functions protected
- **Input Sanitization**: All inputs validated

### Frontend Security
- **Secure Storage**: Sensitive data encrypted
- **Network Validation**: All transactions validated
- **Error Handling**: Comprehensive error handling

## 🏗️ Deployment

### Local Deployment
```bash
npm run node
npm run deploy:localhost
```

### Testnet Deployment
```bash
npm run deploy:sepolia
```

### Mainnet Deployment
```bash
npm run deploy:mainnet
```

## 📝 API Reference

### KYCRegistry
- `depositCommitment(bytes32 commitment)`: Register identity commitment
- `isSpent(bytes32 nullifierHash)`: Check if nullifier is used
- `isKnownRoot(bytes32 root)`: Verify Merkle root validity

### ZKAccessController
- `configureService(string name, bool enabled, uint256 minAge, uint256 validity)`: Configure service requirements
- `verifyKYCAndGrantAccess(ProofData proof, string service)`: Verify proof and grant access
- `hasAccess(address user, string service)`: Check user access status

### IdentityIssuer
- `createCredentialSchema(...)`: Create new credential type
- `issueCredential(...)`: Issue credential to user
- `verifyCredential(bytes32 credentialId)`: Verify credential validity

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Circom**: Zero-knowledge circuit framework
- **Tornado Cash**: Merkle tree implementation inspiration
- **OpenZeppelin**: Secure smart contract patterns
- **Hardhat**: Ethereum development environment

## 📞 Support

For questions and support:
- Create an issue in the repository
- Join our Discord community
- Email: support@zkkyc.example.com

## 🔄 Roadmap

- [ ] Mobile app integration
- [ ] Cross-chain compatibility
- [ ] Advanced biometric verification
- [ ] Enterprise API
- [ ] Compliance reporting tools
- [ ] Integration with major DeFi protocols

---

**Built with ❤️ for privacy-preserving identity verification**