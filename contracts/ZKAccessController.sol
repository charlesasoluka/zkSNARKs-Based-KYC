// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./KYCRegistry.sol";
import "./ZKKYCVerifier.sol";

/**
 * @title ZKAccessController
 * @dev Controls access to resources using zero-knowledge proofs
 * Users prove they have valid KYC without revealing their identity
 */
contract ZKAccessController {
    KYCRegistry public immutable kycRegistry;
    ZKKYCVerifier public immutable verifier;
    
    // Events
    event AccessGranted(address indexed user, bytes32 indexed nullifierHash, uint256 timestamp);
    event AccessDenied(address indexed user, string reason, uint256 timestamp);
    
    // Errors
    error InvalidProof();
    error NullifierAlreadyUsed();
    error InvalidMerkleRoot();
    error UntrustedIssuer();
    error InvalidRecipient();
    
    constructor(address _kycRegistry, address _verifier) {
        kycRegistry = KYCRegistry(_kycRegistry);
        verifier = ZKKYCVerifier(_verifier);
    }
    
    /**
     * @dev Verify ZK proof and grant access if valid
     * @param _pA The first component of the ZK proof
     * @param _pB The second component of the ZK proof
     * @param _pC The third component of the ZK proof
     * @param _merkleRoot The merkle root to verify against
     * @param _nullifierHash The nullifier hash to prevent double-spending
     * @param _issuerAddress The address of the issuer who created the DID
     * @param _recipient The recipient address (should be msg.sender)
     */
    function verifyAndGrantAccess(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        bytes32 _merkleRoot,
        bytes32 _nullifierHash,
        address _issuerAddress,
        address _recipient
    ) external {
        // Check recipient matches caller
        if (_recipient != msg.sender) {
            emit AccessDenied(msg.sender, "Invalid recipient", block.timestamp);
            revert InvalidRecipient();
        }
        
        // Check if nullifier has been used
        if (kycRegistry.isSpent(_nullifierHash)) {
            emit AccessDenied(msg.sender, "Nullifier already used", block.timestamp);
            revert NullifierAlreadyUsed();
        }
        
        // Check if merkle root is recent (within 30 blocks)
        if (!kycRegistry.isKnownRoot(_merkleRoot)) {
            emit AccessDenied(msg.sender, "Invalid merkle root", block.timestamp);
            revert InvalidMerkleRoot();
        }
        
        // Check if issuer is trusted
        if (!kycRegistry.trustedIssuers(_issuerAddress)) {
            emit AccessDenied(msg.sender, "Untrusted issuer", block.timestamp);
            revert UntrustedIssuer();
        }
        
        // Verify the ZK proof
        // Using temporary verification for demo purposes
        bool isValidProof = _verifyProofTemp(_pA, _pB, _pC, _merkleRoot, _nullifierHash, _issuerAddress, _recipient);
        
        if (!isValidProof) {
            emit AccessDenied(msg.sender, "Invalid proof", block.timestamp);
            revert InvalidProof();
        }
        
        // Mark nullifier as spent
        kycRegistry.markNullifierSpent(_nullifierHash);
        
        // Grant access
        emit AccessGranted(msg.sender, _nullifierHash, block.timestamp);
    }
    
    /**
     * @dev Temporary proof verification function
     * This will be replaced with the actual verifier once the new circuit is ready
     */
    function _verifyProofTemp(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        bytes32 _merkleRoot,
        bytes32 _nullifierHash,
        address _issuerAddress,
        address _recipient
    ) internal view returns (bool) {
        // For now, return true to test the flow
        // This will be replaced with actual verification
        return true;
    }
    
    /**
     * @dev Check if a nullifier has been used
     */
    function isNullifierSpent(bytes32 _nullifierHash) external view returns (bool) {
        return kycRegistry.isSpent(_nullifierHash);
    }
    
    /**
     * @dev Check if a merkle root is valid
     */
    function isValidMerkleRoot(bytes32 _merkleRoot) external view returns (bool) {
        return kycRegistry.isKnownRoot(_merkleRoot);
    }
    
    /**
     * @dev Check if an issuer is trusted
     */
    function isTrustedIssuer(address _issuer) external view returns (bool) {
        return kycRegistry.trustedIssuers(_issuer);
    }
}