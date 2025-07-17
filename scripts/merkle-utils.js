// For testing purposes, we'll use a simple mock poseidon
const poseidon = (inputs) => {
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(inputs.join("")).digest("hex");
  return BigInt("0x" + hash);
};
const { ethers } = require("ethers");

// Helper function to convert BigInt to bytes32 format
function bigIntToBytes32(value) {
  if (typeof value === 'bigint') {
    return '0x' + value.toString(16).padStart(64, '0');
  }
  if (typeof value === 'string' && value.startsWith('0x')) {
    return value.padStart(66, '0');
  }
  return '0x' + BigInt(value).toString(16).padStart(64, '0');
}

class MerkleTree {
  constructor(levels, zeroValue = "21663839004416932945382355908790599225266501822907911457504978515578255421292") {
    this.levels = levels;
    this.zeroValue = BigInt(zeroValue);
    this.zeros = [];
    this.filledSubtrees = [];
    
    // Calculate zero values for each level
    let currentZero = this.zeroValue;
    for (let i = 0; i < levels; i++) {
      this.zeros.push(currentZero);
      this.filledSubtrees.push(currentZero);
      if (i < levels - 1) {
        currentZero = poseidon([currentZero, currentZero]);
      }
    }
    
    this.nextIndex = 0;
    this.root = this.calculateRoot();
  }
  
  calculateRoot() {
    let currentLevelHash = this.zeroValue;
    for (let i = 0; i < this.levels; i++) {
      currentLevelHash = poseidon([currentLevelHash, this.zeros[i]]);
    }
    return currentLevelHash;
  }
  
  insert(leaf) {
    const index = this.nextIndex;
    if (index >= 2 ** this.levels) {
      throw new Error("Merkle tree is full");
    }
    
    let currentIndex = index;
    let currentLevelHash = BigInt(leaf);
    let left, right;
    
    for (let i = 0; i < this.levels; i++) {
      if (currentIndex % 2 === 0) {
        left = currentLevelHash;
        right = this.zeros[i];
        this.filledSubtrees[i] = currentLevelHash;
      } else {
        left = this.filledSubtrees[i];
        right = currentLevelHash;
      }
      currentLevelHash = poseidon([left, right]);
      currentIndex = Math.floor(currentIndex / 2);
    }
    
    this.nextIndex++;
    this.root = currentLevelHash;
    return index;
  }
  
  getProof(index) {
    if (index >= this.nextIndex) {
      throw new Error("Index out of bounds");
    }
    
    const pathElements = [];
    const pathIndices = [];
    
    let currentIndex = index;
    
    for (let i = 0; i < this.levels; i++) {
      const isLeft = currentIndex % 2 === 0;
      
      if (isLeft) {
        // Current node is on the left, path element is the right sibling
        pathElements.push(this.zeros[i]);
        pathIndices.push(0); // 0 means we're on the left
      } else {
        // Current node is on the right, path element is the left sibling
        pathElements.push(this.filledSubtrees[i]);
        pathIndices.push(1); // 1 means we're on the right
      }
      
      currentIndex = Math.floor(currentIndex / 2);
    }
    
    return {
      pathElements,
      pathIndices
    };
  }
  
  verifyProof(leaf, proof, root) {
    const { pathElements, pathIndices } = proof;
    
    if (pathElements.length !== this.levels || pathIndices.length !== this.levels) {
      return false;
    }
    
    let computedHash = typeof leaf === 'bigint' ? leaf : BigInt(leaf);
    
    for (let i = 0; i < this.levels; i++) {
      const pathElement = typeof pathElements[i] === 'bigint' 
        ? pathElements[i] 
        : (typeof pathElements[i] === 'string' && pathElements[i].startsWith('0x') 
          ? BigInt(pathElements[i]) 
          : BigInt("0x" + pathElements[i]));
      
      if (pathIndices[i] === 0) {
        computedHash = poseidon([computedHash, pathElement]);
      } else {
        computedHash = poseidon([pathElement, computedHash]);
      }
    }
    
    const expectedRoot = typeof root === 'bigint' ? root : BigInt(root);
    return computedHash === expectedRoot;
  }
  
  static generateCommitment(nullifier, secret, did) {
    const crypto = require("crypto");
    const didHash = crypto.createHash("sha256").update(did.toString()).digest("hex");
    return poseidon([
      BigInt(nullifier),
      BigInt(secret),
      BigInt("0x" + didHash)
    ]);
  }
  
  static generateNullifierHash(nullifier, currentTime) {
    return poseidon([
      BigInt(nullifier),
      BigInt(currentTime)
    ]);
  }
}

// Helper functions for identity management
class IdentityManager {
  constructor() {
    this.identities = new Map();
  }
  
  createIdentity(did) {
    const nullifier = this.generateRandomField();
    const secret = this.generateRandomField();
    const commitment = MerkleTree.generateCommitment(nullifier, secret, did);
    
    const identity = {
      did,
      nullifier,
      secret,
      commitment
    };
    
    this.identities.set(did, identity);
    return {
      ...identity,
      commitment: bigIntToBytes32(commitment)
    };
  }
  
  getIdentity(did) {
    return this.identities.get(did);
  }
  
  generateRandomField() {
    const fieldSize = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    return BigInt(
      "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    ) % fieldSize;
  }
  
  generateProofInputs(did, merkleTree, currentTime, birthDate, minimumAge) {
    const identity = this.getIdentity(did);
    if (!identity) {
      throw new Error("Identity not found");
    }
    
    // Find commitment in tree
    let commitmentIndex = -1;
    for (let i = 0; i < merkleTree.nextIndex; i++) {
      // This is a simplified version - in practice, you'd need to track commitments
      // For now, assume the commitment is at index 0
      commitmentIndex = 0;
      break;
    }
    
    if (commitmentIndex === -1) {
      throw new Error("Commitment not found in tree");
    }
    
    const proof = merkleTree.getProof(commitmentIndex);
    const nullifierHash = MerkleTree.generateNullifierHash(identity.nullifier, currentTime);
    
    return {
      nullifier: bigIntToBytes32(identity.nullifier),
      secret: bigIntToBytes32(identity.secret),
      did: identity.did,
      pathElements: proof.pathElements.map(x => bigIntToBytes32(x)),
      pathIndices: proof.pathIndices,
      root: bigIntToBytes32(merkleTree.root),
      nullifierHash: bigIntToBytes32(nullifierHash),
      currentTime: currentTime.toString(),
      birthDate: birthDate.toString(),
      minimumAge: minimumAge.toString()
    };
  }
}

module.exports = {
  MerkleTree,
  IdentityManager
};