# ZK-KYC Three-Party Architecture

## 🏛️ System Architecture

### **1. Trusted Issuer (Government/Authority)**
- **Role**: Issues verified identity credentials
- **Responsibilities**:
  - Verify user's real identity (age, name, nationality)
  - Generate DID = hash(age, name, nationality, randomID)
  - Commit DID to merkle tree
  - Maintain merkle tree state

### **2. User (Identity Holder)**
- **Role**: Holds identity and generates proofs
- **Responsibilities**:
  - Receive DID from trusted issuer
  - Store identity data securely
  - Generate ZK proofs when needed
  - Submit proofs to verifier

### **3. Verifier (Service Provider)**
- **Role**: Validates proofs without seeing identity
- **Responsibilities**:
  - Receive proof submissions
  - Verify ZK proofs against merkle root
  - Grant/deny access based on proof validity
  - Never see actual identity data

## 🔄 Workflow

```
[Trusted Issuer] → [User] → [Verifier]
       |              |         |
   Issues DID    Generates    Validates
   Commits to     Proofs      Proofs
   Merkle Tree                
```

## 🔐 DID Structure

```
DID = hash(age, name, nationality, randomID)
where:
- age: User's age in years
- name: Full legal name
- nationality: Country code
- randomID: 12-digit random number
```

## 🌳 Merkle Tree

- **Root**: Public on blockchain
- **Leaves**: Individual DIDs
- **Proof**: User proves inclusion without revealing DID
- **Privacy**: Verifier never sees actual identity data