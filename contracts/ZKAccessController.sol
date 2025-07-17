// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./KYCRegistry.sol";
import "./Verifier.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ZKAccessController
 * @dev Controls access to services using ZK-KYC proofs with age verification
 */
contract ZKAccessController is Ownable, ReentrancyGuard {
    KYCRegistry public immutable kycRegistry;
    Verifier public immutable verifier;
    
    struct ServiceConfig {
        bool enabled;
        uint256 minimumAge;
        uint256 validityPeriod;
        mapping(bytes32 => uint256) lastUsed;
    }
    
    mapping(string => ServiceConfig) public services;
    mapping(address => mapping(string => bool)) public userAccess;
    mapping(bytes32 => bool) public usedNullifiers;
    
    event AccessGranted(address indexed user, string indexed service, bytes32 nullifierHash);
    event AccessRevoked(address indexed user, string indexed service);
    event ServiceConfigured(string indexed service, bool enabled, uint256 minimumAge, uint256 validityPeriod);
    event KYCVerified(address indexed user, bytes32 nullifierHash, uint256 age);
    
    struct ProofData {
        uint[2] pA;
        uint[2][2] pB;
        uint[2] pC;
        uint[4] publicSignals; // [root, nullifierHash, currentTime, minimumAge]
    }
    
    constructor(address _kycRegistry, address _verifier) Ownable(msg.sender) {
        kycRegistry = KYCRegistry(_kycRegistry);
        verifier = Verifier(_verifier);
    }
    
    /**
     * @dev Configure a service with specific requirements
     */
    function configureService(
        string calldata serviceName,
        bool enabled,
        uint256 minimumAge,
        uint256 validityPeriod
    ) external onlyOwner {
        services[serviceName].enabled = enabled;
        services[serviceName].minimumAge = minimumAge;
        services[serviceName].validityPeriod = validityPeriod;
        
        emit ServiceConfigured(serviceName, enabled, minimumAge, validityPeriod);
    }
    
    /**
     * @dev Verify KYC proof and grant access to service
     */
    function verifyKYCAndGrantAccess(
        ProofData calldata proofData,
        string calldata serviceName
    ) external nonReentrant {
        require(services[serviceName].enabled, "Service not enabled");
        
        bytes32 root = bytes32(proofData.publicSignals[0]);
        bytes32 nullifierHash = bytes32(proofData.publicSignals[1]);
        uint256 currentTime = proofData.publicSignals[2];
        uint256 verifiedAge = proofData.publicSignals[3];
        
        // Verify the proof
        require(verifier.verifyProof(proofData.pA, proofData.pB, proofData.pC, [proofData.publicSignals[0]]), "Invalid proof");
        
        // Check if nullifier hash has been used
        require(!usedNullifiers[nullifierHash], "Nullifier already used");
        
        // Check if the root is valid
        require(kycRegistry.isKnownRoot(root), "Invalid Merkle root");
        
        // Check minimum age requirement
        require(verifiedAge >= services[serviceName].minimumAge, "Age requirement not met");
        
        // Check if enough time has passed since last use
        require(
            block.timestamp >= services[serviceName].lastUsed[nullifierHash] + services[serviceName].validityPeriod,
            "Service used too recently"
        );
        
        // Mark nullifier as used
        usedNullifiers[nullifierHash] = true;
        
        // Update last used time
        services[serviceName].lastUsed[nullifierHash] = block.timestamp;
        
        // Grant access
        userAccess[msg.sender][serviceName] = true;
        
        emit KYCVerified(msg.sender, nullifierHash, verifiedAge);
        emit AccessGranted(msg.sender, serviceName, nullifierHash);
    }
    
    /**
     * @dev Batch verify multiple proofs
     */
    function batchVerifyAndGrantAccess(
        ProofData[] calldata proofs,
        string[] calldata serviceNames
    ) external nonReentrant {
        require(proofs.length == serviceNames.length, "Array length mismatch");
        
        for (uint i = 0; i < proofs.length; i++) {
            // Individual verification logic (simplified for batch)
            require(services[serviceNames[i]].enabled, "Service not enabled");
            
            bytes32 nullifierHash = bytes32(proofs[i].publicSignals[1]);
            require(!usedNullifiers[nullifierHash], "Nullifier already used");
            
            require(verifier.verifyProof(proofs[i].pA, proofs[i].pB, proofs[i].pC, [proofs[i].publicSignals[0]]), "Invalid proof");
            
            usedNullifiers[nullifierHash] = true;
            userAccess[msg.sender][serviceNames[i]] = true;
            
            emit AccessGranted(msg.sender, serviceNames[i], nullifierHash);
        }
    }
    
    /**
     * @dev Revoke access to a service
     */
    function revokeAccess(address user, string calldata serviceName) external onlyOwner {
        userAccess[user][serviceName] = false;
        emit AccessRevoked(user, serviceName);
    }
    
    /**
     * @dev Check if user has access to a service
     */
    function hasAccess(address user, string calldata serviceName) external view returns (bool) {
        return userAccess[user][serviceName];
    }
    
    /**
     * @dev Get service configuration
     */
    function getServiceConfig(string calldata serviceName) external view returns (
        bool enabled,
        uint256 minimumAge,
        uint256 validityPeriod
    ) {
        ServiceConfig storage config = services[serviceName];
        return (config.enabled, config.minimumAge, config.validityPeriod);
    }
    
    /**
     * @dev Service-specific access control modifier
     */
    modifier onlyKYCVerified(string calldata serviceName) {
        require(userAccess[msg.sender][serviceName], "KYC verification required for this service");
        _;
    }
    
    /**
     * @dev Example service function
     */
    function accessRestrictedService(string calldata serviceName) external onlyKYCVerified(serviceName) {
        // Service logic here
        emit AccessGranted(msg.sender, serviceName, bytes32(0));
    }
}