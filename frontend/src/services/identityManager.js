import { ethers } from 'ethers';
import ZKProofService from './zkProofService';

export class IdentityManager {
  constructor() {
    this.zkProofService = new ZKProofService();
  }

  /**
   * Create a new identity
   * @param {string} did - Decentralized identifier
   * @returns {Promise<Object>} - The created identity
   */
  async createIdentity(did) {
    try {
      // Generate random values for the identity
      const nullifier = this.generateRandomBigInt();
      const secret = this.generateRandomBigInt();
      const didBigInt = this.stringToBigInt(did);

      // Generate commitment
      const commitment = await this.zkProofService.generateCommitment(nullifier, secret, didBigInt);

      const identity = {
        did,
        nullifier: nullifier.toString(),
        secret: secret.toString(),
        didBigInt: didBigInt.toString(),
        commitment,
        createdAt: Date.now()
      };

      console.log('Created identity:', identity);
      return identity;
    } catch (error) {
      console.error('Error creating identity:', error);
      throw error;
    }
  }

  /**
   * Generate proof inputs for ZK circuit
   * @param {Object} params - Parameters for proof generation
   * @returns {Object} - Formatted proof inputs
   */
  async generateProofInputs(params) {
    const {
      identity,
      birthDate,
      currentTime,
      minimumAge,
      merkleTree
    } = params;

    try {
      // Generate nullifier hash
      const nullifierHash = await this.zkProofService.generateNullifierHash(
        identity.nullifier,
        currentTime
      );

      // Get merkle proof (simplified for demo)
      const merkleProof = merkleTree ? merkleTree.getProof(0) : null;

      const proofInputs = {
        // Private inputs
        nullifier: identity.nullifier,
        secret: identity.secret,
        did: identity.didBigInt,
        birthDate: birthDate,
        
        // Public inputs
        currentTime: currentTime,
        minimumAge: minimumAge,
        merkleRoot: merkleTree ? merkleTree.root : ethers.utils.keccak256(ethers.utils.toUtf8Bytes('default_root')),
        nullifierHash: nullifierHash,
        
        // Merkle proof
        merkleProof: merkleProof
      };

      console.log('Generated proof inputs:', proofInputs);
      return proofInputs;
    } catch (error) {
      console.error('Error generating proof inputs:', error);
      throw error;
    }
  }

  /**
   * Generate a ZK proof for age verification
   * @param {Object} proofInputs - The proof inputs
   * @returns {Promise<Object>} - The generated proof
   */
  async generateZKProof(proofInputs) {
    try {
      const result = await this.zkProofService.generateProof(proofInputs);
      
      // Verify the proof locally before returning
      const isValid = await this.zkProofService.verifyProof(result.proof, result.publicSignals);
      
      if (!isValid) {
        throw new Error('Generated proof is invalid');
      }

      return result;
    } catch (error) {
      console.error('Error generating ZK proof:', error);
      throw error;
    }
  }

  /**
   * Verify a ZK proof locally
   * @param {Object} proof - The proof object
   * @param {Array} publicSignals - The public signals
   * @returns {Promise<boolean>} - Whether the proof is valid
   */
  async verifyProof(proof, publicSignals) {
    return await this.zkProofService.verifyProof(proof, publicSignals);
  }

  /**
   * Generate a random BigInt
   * @returns {BigInt} - Random BigInt
   */
  generateRandomBigInt() {
    const bytes = ethers.utils.randomBytes(32);
    return BigInt(ethers.utils.hexlify(bytes));
  }

  /**
   * Convert string to BigInt
   * @param {string} str - String to convert
   * @returns {BigInt} - BigInt representation
   */
  stringToBigInt(str) {
    const bytes = ethers.utils.toUtf8Bytes(str);
    const hash = ethers.utils.keccak256(bytes);
    return BigInt(hash);
  }

  /**
   * Create a simple merkle tree for testing
   * @param {Array} commitments - Array of commitment values
   * @returns {Object} - Merkle tree object
   */
  createMerkleTree(commitments) {
    return this.zkProofService.createMerkleTree(commitments);
  }

  /**
   * Load identity from storage
   * @param {string} account - Ethereum account address
   * @returns {Object|null} - The loaded identity or null
   */
  loadIdentity(account) {
    try {
      const stored = localStorage.getItem(`zkkyc_identity_${account}`);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Error loading identity:', error);
      return null;
    }
  }

  /**
   * Save identity to storage
   * @param {string} account - Ethereum account address
   * @param {Object} identity - The identity to save
   */
  saveIdentity(account, identity) {
    try {
      localStorage.setItem(`zkkyc_identity_${account}`, JSON.stringify(identity));
    } catch (error) {
      console.error('Error saving identity:', error);
      throw error;
    }
  }
}

export default IdentityManager;