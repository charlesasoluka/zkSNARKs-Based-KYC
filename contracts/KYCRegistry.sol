// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MerkleTreeWithHistory.sol";
// Verifier import removed - handled by access controller
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title KYCRegistry
 * @dev Central registry for KYC commitments using Merkle tree structure
 * Inspired by Tornado Cash but adapted for identity commitments
 */
contract KYCRegistry is MerkleTreeWithHistory, Ownable {
    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public nullifierHashes;
    mapping(address => bool) public trustedIssuers;
    
    event CommitmentAdded(bytes32 indexed commitment, uint32 leafIndex, bytes32 root);
    event TrustedIssuerAdded(address indexed issuer);
    event TrustedIssuerRemoved(address indexed issuer);
    
    modifier onlyTrustedIssuer() {
        require(trustedIssuers[msg.sender], "Not a trusted issuer");
        _;
    }
    
    constructor(
        IHasher _hasher,
        uint32 _merkleTreeHeight,
        address[] memory _trustedIssuers
    ) MerkleTreeWithHistory(_merkleTreeHeight, _hasher) Ownable(msg.sender) {
        for (uint i = 0; i < _trustedIssuers.length; i++) {
            trustedIssuers[_trustedIssuers[i]] = true;
            emit TrustedIssuerAdded(_trustedIssuers[i]);
        }
    }
    
    /**
     * @dev Deposit a commitment to the Merkle tree
     * @param _commitment Hash(nullifier || secret || DID)
     */
    function depositCommitment(bytes32 _commitment) external {
        require(!commitments[_commitment], "Commitment already exists");
        
        uint32 insertedIndex = _insert(_commitment);
        commitments[_commitment] = true;
        
        emit CommitmentAdded(_commitment, insertedIndex, getLastRoot());
    }
    
    /**
     * @dev Add a trusted issuer (governance function)
     */
    function addTrustedIssuer(address _issuer) external onlyOwner {
        trustedIssuers[_issuer] = true;
        emit TrustedIssuerAdded(_issuer);
    }
    
    /**
     * @dev Remove a trusted issuer (governance function)
     */
    function removeTrustedIssuer(address _issuer) external onlyOwner {
        trustedIssuers[_issuer] = false;
        emit TrustedIssuerRemoved(_issuer);
    }
    
    /**
     * @dev Check if nullifier hash has been used
     */
    function isSpent(bytes32 _nullifierHash) external view returns (bool) {
        return nullifierHashes[_nullifierHash];
    }
    
    /**
     * @dev Mark nullifier as spent (internal)
     */
    function _markNullifierSpent(bytes32 _nullifierHash) internal {
        nullifierHashes[_nullifierHash] = true;
    }
    
    /**
     * @dev Mark nullifier as spent (external, restricted to access controller)
     */
    function markNullifierSpent(bytes32 _nullifierHash) external {
        require(msg.sender == owner() || trustedIssuers[msg.sender], "Not authorized");
        _markNullifierSpent(_nullifierHash);
    }
}