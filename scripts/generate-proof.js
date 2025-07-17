const snarkjs = require("snarkjs");
const circomlibjs = require("circomlibjs");
const fs = require("fs");
const path = require("path");

class MerkleTree {
  constructor(levels) {
    this.levels = levels;
    this.zeroValue = "21663839004416932945382355908790599225266501822907911457504978515578255421292";
    this.zeros = [];
    this.filledSubtrees = [];
    this.nextIndex = 0;
    this.poseidon = null;
  }

  async initialize() {
    if (!this.poseidon) {
      this.poseidon = await circomlibjs.buildPoseidon();
    }
    
    // Calculate zero values for each level
    let currentZero = this.zeroValue;
    this.zeros = [currentZero];
    
    for (let i = 1; i < this.levels; i++) {
      currentZero = this.poseidon.F.toString(this.poseidon([currentZero, currentZero]));
      this.zeros.push(currentZero);
    }
    
    // Initialize filled subtrees with zeros
    this.filledSubtrees = [...this.zeros];
  }

  async insert(leaf) {
    await this.initialize();
    
    const index = this.nextIndex;
    if (index >= 2 ** this.levels) {
      throw new Error("Merkle tree is full");
    }

    let currentIndex = index;
    let currentLevelHash = leaf.toString();
    
    for (let i = 0; i < this.levels; i++) {
      if (currentIndex % 2 === 0) {
        // Left node
        this.filledSubtrees[i] = currentLevelHash;
        currentLevelHash = this.poseidon.F.toString(this.poseidon([currentLevelHash, this.zeros[i]]));
      } else {
        // Right node
        currentLevelHash = this.poseidon.F.toString(this.poseidon([this.filledSubtrees[i], currentLevelHash]));
      }
      currentIndex = Math.floor(currentIndex / 2);
    }
    
    this.nextIndex++;
    this.root = currentLevelHash;
    return index;
  }

  async getProof(index) {
    await this.initialize();
    
    if (index >= this.nextIndex) {
      throw new Error("Index out of bounds");
    }

    const pathElements = [];
    const pathIndices = [];
    
    let currentIndex = index;
    
    for (let i = 0; i < this.levels; i++) {
      const isLeft = currentIndex % 2 === 0;
      
      if (isLeft) {
        pathElements.push(this.zeros[i]);
        pathIndices.push(0);
      } else {
        pathElements.push(this.filledSubtrees[i]);
        pathIndices.push(1);
      }
      
      currentIndex = Math.floor(currentIndex / 2);
    }
    
    return {
      pathElements,
      pathIndices,
      root: this.root
    };
  }
}

class ProofGenerator {
  constructor() {
    this.circuitWasm = path.join(__dirname, "../circuits/zkkyc_js/zkkyc.wasm");
    this.circuitZkey = path.join(__dirname, "../circuits/zkkyc_0001.zkey");
    this.verificationKey = path.join(__dirname, "../circuits/verification_key.json");
    this.poseidon = null;
    this.merkleTree = new MerkleTree(20);
  }

  async initialize() {
    if (!this.poseidon) {
      this.poseidon = await circomlibjs.buildPoseidon();
    }
    await this.merkleTree.initialize();
  }

  validateInput(input) {
    const required = ['nullifier', 'secret', 'did', 'pathElements', 'pathIndices', 'root', 'nullifierHash', 'currentTime'];
    
    for (const field of required) {
      if (input[field] === undefined || input[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (input.pathElements.length !== input.pathIndices.length) {
      throw new Error("pathElements and pathIndices must have the same length");
    }

    if (input.pathElements.length !== 20) {
      throw new Error("Path elements must be length 20 for this circuit");
    }
  }

  async generateProof(input) {
    try {
      await this.initialize();
      this.validateInput(input);

      console.log("Generating ZK proof...");
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        this.circuitWasm,
        this.circuitZkey
      );

      console.log("Proof generated successfully");
      return { proof, publicSignals };
    } catch (error) {
      console.error("Error generating proof:", error);
      throw error;
    }
  }

  async verifyProof(proof, publicSignals) {
    try {
      const vKey = JSON.parse(fs.readFileSync(this.verificationKey));
      const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      console.log("Verification result:", res);
      return res;
    } catch (error) {
      console.error("Error verifying proof:", error);
      throw error;
    }
  }

  async generateCommitment(nullifier, secret, did) {
    await this.initialize();
    // Convert DID string to field element using a simple hash approach
    const crypto = require('crypto');
    const didHash = crypto.createHash('sha256').update(did).digest('hex');
    const didFieldElement = BigInt("0x" + didHash) % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    
    const result = this.poseidon([nullifier, secret, didFieldElement.toString()]);
    return this.poseidon.F.toString(result);
  }

  async generateNullifierHash(nullifier, currentTime) {
    await this.initialize();
    const result = this.poseidon([nullifier, currentTime]);
    return this.poseidon.F.toString(result);
  }

  generateRandomFieldElement() {
    const fieldSize = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    const randomBytes = Array.from({length: 32}, () => Math.floor(Math.random() * 256));
    const randomBigInt = BigInt("0x" + randomBytes.map(b => b.toString(16).padStart(2, '0')).join(''));
    return randomBigInt % fieldSize;
  }
}

async function generateProofExample() {
  const generator = new ProofGenerator();
  await generator.initialize();
  
  // Generate random field elements for nullifier and secret
  const nullifier = generator.generateRandomFieldElement().toString();
  const secret = generator.generateRandomFieldElement().toString();
  const did = "did:example:123456789abcdef";
  const currentTime = Math.floor(Date.now() / 1000);
  
  console.log("Generating commitment...");
  const commitment = await generator.generateCommitment(nullifier, secret, did);
  console.log("Commitment:", commitment);
  
  console.log("Inserting commitment into merkle tree...");
  const leafIndex = await generator.merkleTree.insert(commitment);
  console.log("Leaf inserted at index:", leafIndex);
  
  console.log("Generating merkle proof...");
  const merkleProof = await generator.merkleTree.getProof(leafIndex);
  console.log("Merkle proof generated");
  
  console.log("Generating nullifier hash...");
  const nullifierHash = await generator.generateNullifierHash(nullifier, currentTime);
  console.log("Nullifier hash:", nullifierHash);
  
  const birthDate = currentTime - (25 * 365 * 24 * 60 * 60); // 25 years old
  const minimumAge = 18;
  
  // Convert DID to field element for the circuit
  const crypto = require('crypto');
  const didHash = crypto.createHash('sha256').update(did).digest('hex');
  const didFieldElement = BigInt("0x" + didHash) % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
  
  const input = {
    nullifier,
    secret,
    did: didFieldElement.toString(),
    pathElements: merkleProof.pathElements,
    pathIndices: merkleProof.pathIndices,
    root: merkleProof.root,
    nullifierHash,
    currentTime: currentTime.toString(),
    minimumAge: minimumAge.toString(),
    birthDate: birthDate.toString()
  };

  console.log("Input prepared:", {
    nullifier: nullifier.substring(0, 20) + "...",
    secret: secret.substring(0, 20) + "...",
    did,
    pathElementsLength: input.pathElements.length,
    pathIndicesLength: input.pathIndices.length,
    root: input.root.substring(0, 20) + "...",
    nullifierHash: nullifierHash.substring(0, 20) + "...",
    currentTime: input.currentTime,
    minimumAge: input.minimumAge,
    birthDate: input.birthDate
  });

  try {
    const { proof, publicSignals } = await generator.generateProof(input);
    const isValid = await generator.verifyProof(proof, publicSignals);
    
    console.log("Proof generation successful!");
    console.log("Public signals:", publicSignals);
    console.log("Proof verified:", isValid);
    
    // Format proof for contract interaction
    const contractProof = {
      pA: [proof.pi_a[0], proof.pi_a[1]],
      pB: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
      pC: [proof.pi_c[0], proof.pi_c[1]],
      publicSignals: publicSignals
    };
    
    console.log("Contract-formatted proof ready for use");
    
    return {
      proof,
      publicSignals,
      isValid,
      input,
      contractProof
    };
  } catch (error) {
    console.error("Failed to generate proof:", error);
    throw error;
  }
}

module.exports = { ProofGenerator, generateProofExample };

if (require.main === module) {
  generateProofExample().catch(console.error);
}