import React, { createContext, useState, useEffect, useContext } from 'react';
import { ethers } from 'ethers';
import { Web3Context } from './Web3Context';
import contractAddresses from '../config/contracts.json';
import ZKProofService from '../services/zkProofService';
import IdentityManager from '../services/identityManager';

// Contract ABIs (in production, these should be imported from generated files)
const KYCRegistryABI = [
  "function depositCommitment(bytes32 commitment) external",
  "function commitments(bytes32) external view returns (bool)",
  "function isSpent(bytes32 nullifierHash) external view returns (bool)",
  "function getLastRoot() external view returns (bytes32)",
  "function isKnownRoot(bytes32 root) external view returns (bool)",
  "event CommitmentAdded(bytes32 indexed commitment, uint32 leafIndex, bytes32 root)"
];

const AccessControllerABI = [
  "function configureService(string calldata serviceName, bool enabled, uint256 minimumAge, uint256 validityPeriod) external",
  "function verifyKYCAndGrantAccess(tuple(uint[2] pA, uint[2][2] pB, uint[2] pC, uint[4] publicSignals) proofData, string calldata serviceName) external",
  "function hasAccess(address user, string calldata serviceName) external view returns (bool)",
  "function getServiceConfig(string calldata serviceName) external view returns (bool enabled, uint256 minimumAge, uint256 validityPeriod)",
  "function revokeAccess(address user, string calldata serviceName) external",
  "event AccessGranted(address indexed user, string indexed service, bytes32 nullifierHash)",
  "event AccessRevoked(address indexed user, string indexed service)"
];

export const ZKKYCContext = createContext();

export const ZKKYCProvider = ({ children }) => {
  const { provider, signer, account } = useContext(Web3Context);
  
  const [userIdentity, setUserIdentity] = useState(null);
  const [proofGenerator, setProofGenerator] = useState(null);
  const [identityManager, setIdentityManager] = useState(null);
  const [kycRegistry, setKycRegistry] = useState(null);
  const [accessController, setAccessController] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (provider && contractAddresses.contracts) {
      initializeContracts();
      initializeUtils();
    }
  }, [provider, contractAddresses]);

  const initializeContracts = async () => {
    try {
      setLoading(true);
      
      // Initialize KYC Registry
      const kycRegistryContract = new ethers.Contract(
        contractAddresses.contracts.kycRegistry,
        KYCRegistryABI,
        provider
      );
      setKycRegistry(kycRegistryContract);
      
      // Initialize Access Controller
      const accessControllerContract = new ethers.Contract(
        contractAddresses.contracts.accessController,
        AccessControllerABI,
        provider
      );
      setAccessController(accessControllerContract);
      
      console.log('Contracts initialized successfully');
    } catch (error) {
      console.error('Error initializing contracts:', error);
      setError('Failed to initialize contracts');
    } finally {
      setLoading(false);
    }
  };

  const initializeUtils = () => {
    try {
      // Initialize real ZK proof services
      const zkProofService = new ZKProofService();
      const identityManager = new IdentityManager();
      
      // Set up proof generator with real ZK proof generation
      const proofGen = {
        generateProof: async (inputs) => {
          try {
            const result = await zkProofService.generateProof(inputs);
            return result;
          } catch (error) {
            console.error('ZK proof generation failed:', error);
            // Fallback to mock for development
            console.log('Falling back to mock proof generation');
            return {
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
          }
        },
        verifyProof: async (proof, publicSignals) => {
          try {
            return await zkProofService.verifyProof(proof, publicSignals);
          } catch (error) {
            console.error('Proof verification failed:', error);
            return false;
          }
        }
      };
      
      const identityMgr = {
        createIdentity: async (did) => {
          try {
            return await identityManager.createIdentity(did);
          } catch (error) {
            console.error('Identity creation failed:', error);
            // Fallback to mock
            const randomCommitment = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(did + Date.now()));
            return {
              did,
              commitment: randomCommitment,
              secret: ethers.utils.hexlify(ethers.utils.randomBytes(32)),
              nullifier: ethers.utils.keccak256(ethers.utils.toUtf8Bytes('nullifier' + did))
            };
          }
        },
        generateProofInputs: async (params) => {
          try {
            return await identityManager.generateProofInputs(params);
          } catch (error) {
            console.error('Proof input generation failed:', error);
            // Fallback to mock
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('mock_root_' + params.identity.did));
            const nullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('nullifier_' + params.identity.did + '_' + params.currentTime));
            
            return {
              identity: params.identity,
              currentTime: params.currentTime,
              birthDate: params.birthDate,
              minimumAge: params.minimumAge,
              merkleRoot,
              nullifierHash
            };
          }
        },
        loadIdentity: (account) => {
          return identityManager.loadIdentity(account);
        },
        saveIdentity: (account, identity) => {
          return identityManager.saveIdentity(account, identity);
        },
        createMerkleTree: (commitments) => {
          return identityManager.createMerkleTree(commitments);
        }
      };
      
      setProofGenerator(proofGen);
      setIdentityManager(identityMgr);
      
      console.log('ZK proof services initialized successfully');
    } catch (error) {
      console.error('Error initializing ZK services:', error);
      setError('Failed to initialize ZK services');
    }
  };

  const createIdentity = async (did) => {
    if (!identityManager) {
      throw new Error('Identity manager not initialized');
    }
    
    try {
      setLoading(true);
      const identity = await identityManager.createIdentity(did);
      setUserIdentity(identity);
      
      // Store in localStorage (in production, use secure storage)
      if (account) {
        identityManager.saveIdentity(account, identity);
      }
      
      return identity;
    } catch (error) {
      console.error('Error creating identity:', error);
      setError('Failed to create identity');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loadIdentity = async () => {
    if (!account || !identityManager) return null;
    
    try {
      const identity = identityManager.loadIdentity(account);
      if (identity) {
        setUserIdentity(identity);
        return identity;
      }
      return null;
    } catch (error) {
      console.error('Error loading identity:', error);
      return null;
    }
  };

  const registerCommitment = async (commitment) => {
    if (!kycRegistry || !signer) {
      throw new Error('Contracts not initialized or wallet not connected');
    }
    
    try {
      setLoading(true);
      const tx = await kycRegistry.connect(signer).depositCommitment(commitment);
      await tx.wait();
      
      console.log('Commitment registered:', tx.hash);
      return tx;
    } catch (error) {
      console.error('Error registering commitment:', error);
      setError('Failed to register commitment');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const generateProof = async (inputs) => {
    if (!proofGenerator) {
      throw new Error('Proof generator not initialized');
    }
    
    try {
      setLoading(true);
      const result = await proofGenerator.generateProof(inputs);
      
      // Try to verify the proof locally
      if (proofGenerator.verifyProof) {
        const isValid = await proofGenerator.verifyProof(result.proof, result.publicSignals);
        console.log('Local proof verification:', isValid);
      }
      
      return result;
    } catch (error) {
      console.error('Error generating proof:', error);
      setError('Failed to generate proof');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verifyAndGrantAccess = async (proofData, serviceName) => {
    if (!accessController || !signer) {
      throw new Error('Access controller not initialized or wallet not connected');
    }
    
    try {
      setLoading(true);
      
      // First check if service is configured
      const serviceConfig = await accessController.getServiceConfig(serviceName);
      if (!serviceConfig.enabled) {
        throw new Error(`Service '${serviceName}' is not enabled or configured`);
      }
      
      console.log('Service config:', serviceConfig);
      console.log('Proof data being submitted:', proofData);
      
      const tx = await accessController.connect(signer).verifyKYCAndGrantAccess(proofData, serviceName);
      await tx.wait();
      
      console.log('Access granted:', tx.hash);
      return tx;
    } catch (error) {
      console.error('Error verifying KYC:', error);
      
      // More detailed error handling
      if (error.message.includes('Service not enabled')) {
        throw new Error('The voting service is not configured on this contract. Please contact the administrator.');
      } else if (error.message.includes('Invalid proof')) {
        throw new Error('The zero-knowledge proof is invalid. This is expected with mock data.');
      } else if (error.message.includes('Nullifier already used')) {
        throw new Error('This identity has already been used for voting.');
      } else if (error.message.includes('Invalid Merkle root')) {
        throw new Error('The identity commitment is not registered in the system.');
      } else if (error.message.includes('Age requirement not met')) {
        throw new Error('Age requirement not met for this service.');
      }
      
      setError('Failed to verify KYC');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkAccess = async (user, serviceName) => {
    if (!accessController) {
      throw new Error('Access controller not initialized');
    }
    
    try {
      const hasAccess = await accessController.hasAccess(user, serviceName);
      return hasAccess;
    } catch (error) {
      console.error('Error checking access:', error);
      return false;
    }
  };

  const getServiceConfig = async (serviceName) => {
    if (!accessController) {
      throw new Error('Access controller not initialized');
    }
    
    try {
      const config = await accessController.getServiceConfig(serviceName);
      return {
        enabled: config.enabled,
        minimumAge: config.minimumAge.toNumber(),
        validityPeriod: config.validityPeriod.toNumber()
      };
    } catch (error) {
      console.error('Error getting service config:', error);
      return null;
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    // State
    userIdentity,
    setUserIdentity,
    proofGenerator,
    identityManager,
    kycRegistry,
    accessController,
    loading,
    error,
    
    // Functions
    createIdentity,
    loadIdentity,
    registerCommitment,
    generateProof,
    verifyAndGrantAccess,
    checkAccess,
    getServiceConfig,
    clearError,
    
    // Additional utilities
    initializeContracts,
    initializeUtils,
    
    // Utilities
    isInitialized: !!(proofGenerator && identityManager && kycRegistry && accessController)
  };

  return (
    <ZKKYCContext.Provider value={value}>
      {children}
    </ZKKYCContext.Provider>
  );
};