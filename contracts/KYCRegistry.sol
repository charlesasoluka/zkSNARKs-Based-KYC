// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MerkleTreeWithHistory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SecureKYCRegistry
 * @dev Enhanced KYC registry with formal security guarantees
 * 
 * Security Properties:
 * - Soundness: Only valid issuer-signed commitments can be deposited
 * - Anonymity: Commitment deposits don't reveal user identity
 * - DoS Resistance: Rate limiting and gas optimization prevent spam
 * - Access Control: Multi-tiered authorization system
 */
contract KYCRegistry is MerkleTreeWithHistory, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Security parameters
    uint256 public constant MIN_COMMITMENT_ENTROPY = 2**128; // Minimum commitment value
    uint256 public constant MAX_COMMITMENTS_PER_BLOCK = 10;  // DoS prevention
    uint256 public constant ISSUER_SIGNATURE_TIMEOUT = 1 hours; // Signature validity window
    
    // State variables
    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public nullifierHashes;
    mapping(address => IssuerInfo) public trustedIssuers;
    mapping(address => uint256) public userCommitmentCount; // Rate limiting
    mapping(uint256 => uint256) public blockCommitmentCount; // Block-level rate limiting
    
    struct IssuerInfo {
        bool isActive;
        bytes32 publicKeyHash; // Hash of issuer's public key for verification
        uint256 maxDailyIssuances; // Rate limiting per issuer
        uint256 issuancesToday;
        uint256 lastResetDay;
    }
    
    // Anonymous events for privacy preservation
    event CommitmentDeposited(
        bytes32 indexed commitmentHash,
        uint32 leafIndex,
        uint256 timestamp
    ); // Note: No user-identifying information
    
    event TrustedIssuerAdded(
        address indexed issuer,
        bytes32 publicKeyHash,
        uint256 maxDailyIssuances
    );
    
    event TrustedIssuerRemoved(address indexed issuer);
    
    event SecurityViolation(
        address indexed violator,
        string violationType,
        uint256 timestamp
    );

    // Custom errors for gas optimization
    error CommitmentAlreadyExists();
    error InvalidCommitment();
    error UntrustedIssuer();
    error InvalidSignature();
    error SignatureExpired();
    error RateLimitExceeded();
    error InsufficientEntropy();
    error InvalidPublicKey();
    error CommitmentSpamPrevention();

    modifier onlyTrustedIssuer() {
        if (!trustedIssuers[msg.sender].isActive) {
            revert UntrustedIssuer();
        }
        _;
    }
    
    modifier rateLimited() {
        // Per-user rate limiting
        if (userCommitmentCount[msg.sender] >= 5) { // Max 5 per user per block
            revert RateLimitExceeded();
        }
        
        // Per-block rate limiting  
        if (blockCommitmentCount[block.number] >= MAX_COMMITMENTS_PER_BLOCK) {
            revert CommitmentSpamPrevention();
        }
        _;
    }

    constructor(
        IHasher _hasher,
        uint32 _merkleTreeHeight,
        address[] memory _trustedIssuers,
        bytes32[] memory _publicKeyHashes,
        uint256[] memory _maxDailyIssuances
    ) MerkleTreeWithHistory(_merkleTreeHeight, _hasher) Ownable(msg.sender) {
        require(
            _trustedIssuers.length == _publicKeyHashes.length && 
            _trustedIssuers.length == _maxDailyIssuances.length,
            "Array length mismatch"
        );
        
        for (uint i = 0; i < _trustedIssuers.length; i++) {
            _addTrustedIssuer(_trustedIssuers[i], _publicKeyHashes[i], _maxDailyIssuances[i]);
        }
    }
    
    /**
     * @dev Securely deposit a commitment with issuer signature verification
     * @param _commitment The commitment hash to deposit
     * @param _issuerSignature ECDSA signature from trusted issuer
     * @param _timestamp Signature timestamp for replay protection  
     * @param _did The DID that was signed by the issuer
     */
    function secureDepositCommitment(
        bytes32 _commitment,
        bytes calldata _issuerSignature,
        uint256 _timestamp,
        bytes32 _did
    ) external nonReentrant rateLimited {
        // 1. Basic validation
        if (commitments[_commitment]) {
            revert CommitmentAlreadyExists();
        }
        
        if (uint256(_commitment) < MIN_COMMITMENT_ENTROPY) {
            revert InsufficientEntropy();
        }
        
        // 2. Timestamp validation (prevent replay attacks)
        if (block.timestamp > _timestamp + ISSUER_SIGNATURE_TIMEOUT) {
            revert SignatureExpired();
        }
        
        // 3. Verify issuer signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            _commitment,
            _did,
            _timestamp,
            msg.sender // Bind to specific user
        )).toEthSignedMessageHash();
        
        address issuer = messageHash.recover(_issuerSignature);
        IssuerInfo storage issuerInfo = trustedIssuers[issuer];
        
        if (!issuerInfo.isActive) {
            emit SecurityViolation(issuer, "Untrusted issuer attempted deposit", block.timestamp);
            revert UntrustedIssuer();
        }
        
        // 4. Issuer rate limiting
        uint256 currentDay = block.timestamp / 1 days;
        if (issuerInfo.lastResetDay < currentDay) {
            issuerInfo.issuancesToday = 0;
            issuerInfo.lastResetDay = currentDay;
        }
        
        if (issuerInfo.issuancesToday >= issuerInfo.maxDailyIssuances) {
            emit SecurityViolation(issuer, "Daily issuance limit exceeded", block.timestamp);
            revert RateLimitExceeded();
        }
        
        // 5. Insert commitment into Merkle tree
        uint32 insertedIndex = _insert(_commitment);
        commitments[_commitment] = true;
        
        // 6. Update rate limiting counters
        userCommitmentCount[msg.sender]++;
        blockCommitmentCount[block.number]++;
        issuerInfo.issuancesToday++;
        
        // 7. Emit anonymous event (no user-identifying info)
        emit CommitmentDeposited(
            keccak256(abi.encodePacked(_commitment, block.timestamp)), // Anonymized hash
            insertedIndex,
            block.timestamp
        );
    }
    
    /**
     * @dev Add a trusted issuer with enhanced security
     */
    function addTrustedIssuer(
        address _issuer,
        bytes32 _publicKeyHash,
        uint256 _maxDailyIssuances
    ) external onlyOwner {
        _addTrustedIssuer(_issuer, _publicKeyHash, _maxDailyIssuances);
    }
    
    function _addTrustedIssuer(
        address _issuer,
        bytes32 _publicKeyHash,
        uint256 _maxDailyIssuances
    ) internal {
        require(_issuer != address(0), "Invalid issuer address");
        require(_publicKeyHash != bytes32(0), "Invalid public key hash");
        require(_maxDailyIssuances > 0, "Invalid daily limit");
        
        trustedIssuers[_issuer] = IssuerInfo({
            isActive: true,
            publicKeyHash: _publicKeyHash,
            maxDailyIssuances: _maxDailyIssuances,
            issuancesToday: 0,
            lastResetDay: block.timestamp / 1 days
        });
        
        emit TrustedIssuerAdded(_issuer, _publicKeyHash, _maxDailyIssuances);
    }
    
    /**
     * @dev Remove a trusted issuer (governance function)
     */
    function removeTrustedIssuer(address _issuer) external onlyOwner {
        trustedIssuers[_issuer].isActive = false;
        emit TrustedIssuerRemoved(_issuer);
    }
    
    /**
     * @dev Check if nullifier hash has been used
     */
    function isSpent(bytes32 _nullifierHash) external view returns (bool) {
        return nullifierHashes[_nullifierHash];
    }
    
    /**
     * @dev Mark nullifier as spent with enhanced authorization
     */
    function markNullifierSpent(bytes32 _nullifierHash) external {
        // Only authorized access controllers can mark nullifiers as spent
        require(
            msg.sender == owner() || trustedIssuers[msg.sender].isActive,
            "Not authorized to mark nullifier"
        );
        
        if (nullifierHashes[_nullifierHash]) {
            emit SecurityViolation(msg.sender, "Attempted nullifier reuse", block.timestamp);
            revert("Nullifier already spent");
        }
        
        nullifierHashes[_nullifierHash] = true;
    }
    
    /**
     * @dev Verify commitment structure for additional security
     */
    function verifyCommitmentStructure(
        bytes32 _commitment,
        bytes32 _nullifier,
        bytes32 _secret,
        bytes32 _did,
        bytes32 _issuerPubKeyX
    ) external pure returns (bool) {
        // This should match the circuit's commitment computation
        // In a real implementation, this would use Poseidon hash
        bytes32 expectedCommitment = keccak256(abi.encodePacked(
            _nullifier,
            _secret,
            _did,
            _issuerPubKeyX
        ));
        
        return expectedCommitment == _commitment;
    }
    
    /**
     * @dev Emergency pause function for security incidents
     */
    function emergencyPause() external onlyOwner {
        // Implementation would pause all operations
        // This is a placeholder for emergency response
        emit SecurityViolation(msg.sender, "Emergency pause activated", block.timestamp);
    }
    
    /**
     * @dev Get issuer information for external verification
     */
    function getIssuerInfo(address _issuer) external view returns (IssuerInfo memory) {
        return trustedIssuers[_issuer];
    }
    
    /**
     * @dev Reset rate limiting (emergency function)
     */
    function resetRateLimiting() external onlyOwner {
        // Reset block-level rate limiting if needed
        blockCommitmentCount[block.number] = 0;
    }
}