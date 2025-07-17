// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title IdentityIssuer
 * @dev Issues and manages identity credentials with various attributes
 */
contract IdentityIssuer is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    struct CredentialSchema {
        string name;
        string description;
        string[] requiredFields;
        uint256 validityPeriod;
        bool active;
    }

    struct IssuedCredential {
        bytes32 schemaId;
        address holder;
        bytes32 credentialHash;
        uint256 issuedAt;
        uint256 expiresAt;
        bool revoked;
        string metadataURI;
    }

    struct IdentityAttributes {
        string name;
        string dateOfBirth;
        string nationality;
        string governmentId;
        string email;
        bool verified;
        uint256 verificationLevel; // 1-5, 5 being highest
    }

    // Mappings
    mapping(bytes32 => CredentialSchema) public credentialSchemas;
    mapping(bytes32 => IssuedCredential) public issuedCredentials;
    mapping(address => bytes32[]) public holderCredentials;
    mapping(address => IdentityAttributes) public identityAttributes;
    mapping(address => bool) public authorizedIssuers;
    mapping(bytes32 => bool) public revokedCredentials;

    // Events
    event CredentialSchemaCreated(bytes32 indexed schemaId, string name);
    event CredentialIssued(bytes32 indexed credentialId, address indexed holder, bytes32 indexed schemaId);
    event CredentialRevoked(bytes32 indexed credentialId, address indexed holder);
    event IdentityAttributesUpdated(address indexed holder, uint256 verificationLevel);
    event IssuerAuthorized(address indexed issuer);
    event IssuerRevoked(address indexed issuer);

    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender] || msg.sender == owner(), "Not authorized issuer");
        _;
    }

    constructor() Ownable(msg.sender) {
        authorizedIssuers[msg.sender] = true;
    }

    /**
     * @dev Create a new credential schema
     */
    function createCredentialSchema(
        bytes32 schemaId,
        string memory name,
        string memory description,
        string[] memory requiredFields,
        uint256 validityPeriod
    ) external onlyOwner {
        require(bytes(credentialSchemas[schemaId].name).length == 0, "Schema already exists");
        
        credentialSchemas[schemaId] = CredentialSchema({
            name: name,
            description: description,
            requiredFields: requiredFields,
            validityPeriod: validityPeriod,
            active: true
        });
        
        emit CredentialSchemaCreated(schemaId, name);
    }

    /**
     * @dev Issue a new credential to a holder
     */
    function issueCredential(
        bytes32 credentialId,
        bytes32 schemaId,
        address holder,
        bytes32 credentialHash,
        string memory metadataURI
    ) external onlyAuthorizedIssuer nonReentrant {
        require(credentialSchemas[schemaId].active, "Schema not active");
        require(issuedCredentials[credentialId].holder == address(0), "Credential already issued");
        
        uint256 expiresAt = block.timestamp + credentialSchemas[schemaId].validityPeriod;
        
        issuedCredentials[credentialId] = IssuedCredential({
            schemaId: schemaId,
            holder: holder,
            credentialHash: credentialHash,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false,
            metadataURI: metadataURI
        });
        
        holderCredentials[holder].push(credentialId);
        
        emit CredentialIssued(credentialId, holder, schemaId);
    }

    /**
     * @dev Update identity attributes for a holder
     */
    function updateIdentityAttributes(
        address holder,
        string memory name,
        string memory dateOfBirth,
        string memory nationality,
        string memory governmentId,
        string memory email,
        uint256 verificationLevel
    ) external onlyAuthorizedIssuer {
        require(verificationLevel >= 1 && verificationLevel <= 5, "Invalid verification level");
        
        identityAttributes[holder] = IdentityAttributes({
            name: name,
            dateOfBirth: dateOfBirth,
            nationality: nationality,
            governmentId: governmentId,
            email: email,
            verified: true,
            verificationLevel: verificationLevel
        });
        
        emit IdentityAttributesUpdated(holder, verificationLevel);
    }

    /**
     * @dev Revoke a credential
     */
    function revokeCredential(bytes32 credentialId) external onlyAuthorizedIssuer {
        require(issuedCredentials[credentialId].holder != address(0), "Credential not found");
        require(!issuedCredentials[credentialId].revoked, "Already revoked");
        
        issuedCredentials[credentialId].revoked = true;
        revokedCredentials[credentialId] = true;
        
        emit CredentialRevoked(credentialId, issuedCredentials[credentialId].holder);
    }

    /**
     * @dev Authorize a new issuer
     */
    function authorizeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    /**
     * @dev Revoke issuer authorization
     */
    function revokeIssuerAuthorization(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    /**
     * @dev Verify a credential is valid
     */
    function verifyCredential(bytes32 credentialId) external view returns (bool) {
        IssuedCredential memory credential = issuedCredentials[credentialId];
        
        if (credential.holder == address(0)) return false;
        if (credential.revoked) return false;
        if (block.timestamp > credential.expiresAt) return false;
        
        return true;
    }

    /**
     * @dev Get holder's credentials
     */
    function getHolderCredentials(address holder) external view returns (bytes32[] memory) {
        return holderCredentials[holder];
    }

    /**
     * @dev Get credential schema details
     */
    function getCredentialSchema(bytes32 schemaId) external view returns (
        string memory name,
        string memory description,
        string[] memory requiredFields,
        uint256 validityPeriod,
        bool active
    ) {
        CredentialSchema memory schema = credentialSchemas[schemaId];
        return (
            schema.name,
            schema.description,
            schema.requiredFields,
            schema.validityPeriod,
            schema.active
        );
    }

    /**
     * @dev Get identity attributes
     */
    function getIdentityAttributes(address holder) external view returns (
        string memory name,
        string memory dateOfBirth,
        string memory nationality,
        string memory governmentId,
        string memory email,
        bool verified,
        uint256 verificationLevel
    ) {
        IdentityAttributes memory attrs = identityAttributes[holder];
        return (
            attrs.name,
            attrs.dateOfBirth,
            attrs.nationality,
            attrs.governmentId,
            attrs.email,
            attrs.verified,
            attrs.verificationLevel
        );
    }

    /**
     * @dev Verify credential ownership with signature
     */
    function verifyCredentialOwnership(
        bytes32 credentialId,
        bytes32 message,
        bytes memory signature
    ) external view returns (bool) {
        IssuedCredential memory credential = issuedCredentials[credentialId];
        if (credential.holder == address(0)) return false;
        
        bytes32 messageHash = keccak256(abi.encodePacked(message, credentialId));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        
        address recovered = ECDSA.recover(ethSignedMessageHash, signature);
        return recovered == credential.holder;
    }

    /**
     * @dev Update credential schema status
     */
    function updateSchemaStatus(bytes32 schemaId, bool active) external onlyOwner {
        require(bytes(credentialSchemas[schemaId].name).length > 0, "Schema not found");
        credentialSchemas[schemaId].active = active;
    }

    /**
     * @dev Get verification level for an address
     */
    function getVerificationLevel(address holder) external view returns (uint256) {
        return identityAttributes[holder].verificationLevel;
    }
}