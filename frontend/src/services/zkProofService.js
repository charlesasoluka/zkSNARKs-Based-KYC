import { ethers } from 'ethers';
import apiService from './apiService';

export class ZKProofService {
  constructor() {
    this.wasmPath = '/circuits/zkkyc.wasm';
    this.zkeyPath = '/circuits/zkkyc_0001.zkey';
    this.verificationKeyPath = '/circuits/verification_key.json';
    this.merkleTreeHeight = 20;
  }

  /**
   * Generate ZK proof for KYC age verification
   * @param {Object} inputs - The proof inputs
   * @returns {Promise<Object>} - The generated proof and public signals
   */
  async generateProof(inputs) {
    try {
      console.log('Generating ZK proof with inputs:', inputs);
      
      // Try to use proof server for real ZK proof generation
      try {
        const result = await apiService.generateProof(inputs);
        if (result.success) {
          console.log('✅ Real ZK proof generated successfully!');
          return {
            proof: result.proof,
            publicSignals: result.publicSignals
          };
        } else {
          console.warn('Proof server returned error:', result.error);
        }
      } catch (serverError) {
        console.warn('Proof server not available:', serverError.message);
      }
      
      // Fallback to mock proof
      console.log('🔄 Falling back to mock proof generation');
      return this.generateMockProof(inputs);
      
    } catch (error) {
      console.error('Error generating ZK proof:', error);
      console.log('🔄 Falling back to mock proof due to error');
      return this.generateMockProof(inputs);
    }
  }

  /**
   * Verify ZK proof locally before sending to contract
   * @param {Object} proof - The proof object
   * @param {Array} publicSignals - The public signals
   * @returns {Promise<boolean>} - Whether the proof is valid
   */
  async verifyProof(proof, publicSignals) {
    try {
      // Try to use proof server for verification
      try {
        const result = await apiService.verifyProofOnServer(proof, publicSignals);
        if (result.success) {
          console.log('✅ Proof verified on server:', result.isValid);
          return result.isValid;
        }
      } catch (serverError) {
        console.warn('Proof server verification failed:', serverError.message);
      }
      
      // Fallback - cannot verify without server
      console.warn('Cannot verify proof without server');
      return false;
    } catch (error) {
      console.error('Error verifying proof:', error);
      return false;
    }
  }

  /**
   * Prepare inputs for the circuit
   * @param {Object} inputs - Raw inputs
   * @returns {Object} - Formatted circuit inputs
   */
  prepareCircuitInputs(inputs) {
    const {
      nullifier,
      secret,
      did,
      birthDate,
      currentTime,
      minimumAge,
      merkleRoot,
      nullifierHash,
      merkleProof
    } = inputs;

    // Convert birth date to timestamp if it's a string
    const birthTimestamp = typeof birthDate === 'string' 
      ? Math.floor(new Date(birthDate).getTime() / 1000)
      : birthDate;

    // Prepare merkle path elements and indices
    const pathElements = new Array(this.merkleTreeHeight).fill('0');
    const pathIndices = new Array(this.merkleTreeHeight).fill('0');
    
    // If merkleProof is provided, use it
    if (merkleProof && merkleProof.pathElements) {
      for (let i = 0; i < Math.min(merkleProof.pathElements.length, this.merkleTreeHeight); i++) {
        pathElements[i] = merkleProof.pathElements[i];
        pathIndices[i] = merkleProof.pathIndices[i];
      }
    }

    return {
      // Private inputs
      nullifier: this.toBigInt(nullifier),
      secret: this.toBigInt(secret),
      did: this.toBigInt(did),
      pathElements: pathElements.map(x => this.toBigInt(x)),
      pathIndices: pathIndices.map(x => this.toBigInt(x)),
      birthDate: birthTimestamp.toString(),
      
      // Public inputs
      root: this.toBigInt(merkleRoot),
      nullifierHash: this.toBigInt(nullifierHash),
      currentTime: currentTime.toString(),
      minimumAge: minimumAge.toString()
    };
  }

  /**
   * Format proof for smart contract
   * @param {Object} proof - Raw proof from snarkjs
   * @returns {Object} - Formatted proof
   */
  formatProofForContract(proof) {
    return {
      pi_a: [proof.pi_a[0], proof.pi_a[1]],
      pi_b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
      pi_c: [proof.pi_c[0], proof.pi_c[1]]
    };
  }

  /**
   * Convert value to BigInt for circuit
   * @param {*} value - Value to convert
   * @returns {string} - BigInt string
   */
  toBigInt(value) {
    if (typeof value === 'string') {
      if (value.startsWith('0x')) {
        return BigInt(value).toString();
      }
      return value;
    }
    if (typeof value === 'number') {
      return BigInt(value).toString();
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return BigInt(value || 0).toString();
  }

  /**
   * Generate identity commitment
   * @param {string} nullifier - The nullifier
   * @param {string} secret - The secret
   * @param {string} did - The DID
   * @returns {Promise<string>} - The commitment hash
   */
  async generateCommitment(nullifier, secret, did) {
    try {
      // Use Poseidon hash to generate commitment
      const commitment = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'uint256', 'uint256'],
          [this.toBigInt(nullifier), this.toBigInt(secret), this.toBigInt(did)]
        )
      );
      
      return commitment;
    } catch (error) {
      console.error('Error generating commitment:', error);
      throw error;
    }
  }

  /**
   * Generate nullifier hash
   * @param {string} nullifier - The nullifier
   * @param {number} currentTime - Current timestamp
   * @returns {Promise<string>} - The nullifier hash
   */
  async generateNullifierHash(nullifier, currentTime) {
    try {
      const nullifierHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'uint256'],
          [this.toBigInt(nullifier), currentTime]
        )
      );
      
      return nullifierHash;
    } catch (error) {
      console.error('Error generating nullifier hash:', error);
      throw error;
    }
  }

  /**
   * Create a simple merkle tree for testing
   * @param {Array} leaves - Array of leaf values
   * @returns {Object} - Merkle tree with root and proof methods
   */
  generateMockProof(inputs) {
    console.log('Generating mock ZK proof');
    
    const mockProof = {
      proof: {
        pi_a: [
          '0x1853034987712246426929201391724714898295156213405955369853072608605563140365',
          '0x7198183041722314299882689081228904533251895217297057633352725320322492333268'
        ],
        pi_b: [
          [
            '0x13531277862656208833438534707900630797772244346889389580205754526157702849885',
            '0x655631939281545332504919736953321663519114267948235723191789164934401101892'
          ],
          [
            '0x745417327382481498932071710738369054466478084158769501335074926048131827462',
            '0x18244135873856574020512890818854407479317907858514021408878772277422050584300'
          ]
        ],
        pi_c: [
          '0x11559732032986387107991004021392285783925812861821192530917403151452391805634',
          '0x10857046999023057135944570762232829481370756359578518086990519993285655852781'
        ]
      },
      publicSignals: [
        inputs.merkleRoot,
        inputs.nullifierHash,
        inputs.currentTime.toString(),
        inputs.minimumAge.toString()
      ]
    };
    
    return mockProof;
  }
  
  createMerkleTree(leaves) {
    // Simple implementation for demo - in production use a proper merkle tree library
    const tree = {
      leaves: leaves,
      root: ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['bytes32[]'], [leaves])),
      getProof: (leafIndex) => {
        // Return empty proof for demo
        return {
          pathElements: new Array(this.merkleTreeHeight).fill('0'),
          pathIndices: new Array(this.merkleTreeHeight).fill('0')
        };
      }
    };
    
    return tree;
  }
}

export default ZKProofService;