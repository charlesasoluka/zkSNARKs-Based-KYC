const { ethers } = require("ethers");

class CredentialSchemaManager {
  constructor(identityIssuerContract) {
    this.identityIssuer = identityIssuerContract;
  }

  // Predefined credential schemas
  getStandardSchemas() {
    return {
      basicKYC: {
        id: ethers.utils.id("basic-kyc-v1"),
        name: "Basic KYC",
        description: "Basic Know Your Customer verification with age and identity confirmation",
        requiredFields: ["name", "dateOfBirth", "nationality", "governmentId"],
        validityPeriod: 365 * 24 * 60 * 60, // 1 year
        verificationLevel: 1
      },
      
      enhancedKYC: {
        id: ethers.utils.id("enhanced-kyc-v1"),
        name: "Enhanced KYC",
        description: "Enhanced KYC with additional document verification and address proof",
        requiredFields: ["name", "dateOfBirth", "nationality", "governmentId", "address", "addressProof"],
        validityPeriod: 365 * 24 * 60 * 60, // 1 year
        verificationLevel: 3
      },
      
      premiumKYC: {
        id: ethers.utils.id("premium-kyc-v1"),
        name: "Premium KYC",
        description: "Premium KYC with biometric verification and multiple document validation",
        requiredFields: ["name", "dateOfBirth", "nationality", "governmentId", "address", "addressProof", "biometricHash"],
        validityPeriod: 730 * 24 * 60 * 60, // 2 years
        verificationLevel: 5
      },
      
      ageVerification: {
        id: ethers.utils.id("age-verification-v1"),
        name: "Age Verification",
        description: "Simple age verification for age-restricted services",
        requiredFields: ["dateOfBirth"],
        validityPeriod: 365 * 24 * 60 * 60, // 1 year
        verificationLevel: 1
      },
      
      accreditedInvestor: {
        id: ethers.utils.id("accredited-investor-v1"),
        name: "Accredited Investor",
        description: "Accredited investor status verification",
        requiredFields: ["name", "dateOfBirth", "nationality", "governmentId", "incomeProof", "netWorthProof"],
        validityPeriod: 365 * 24 * 60 * 60, // 1 year
        verificationLevel: 4
      },
      
      corporateKYC: {
        id: ethers.utils.id("corporate-kyc-v1"),
        name: "Corporate KYC",
        description: "Corporate entity verification and compliance",
        requiredFields: ["companyName", "registrationNumber", "jurisdiction", "businessLicense", "beneficialOwners"],
        validityPeriod: 365 * 24 * 60 * 60, // 1 year
        verificationLevel: 4
      },
      
      sanctionsCheck: {
        id: ethers.utils.id("sanctions-check-v1"),
        name: "Sanctions Check",
        description: "Anti-money laundering and sanctions list verification",
        requiredFields: ["name", "dateOfBirth", "nationality", "governmentId"],
        validityPeriod: 90 * 24 * 60 * 60, // 90 days
        verificationLevel: 2
      },
      
      professionalLicense: {
        id: ethers.utils.id("professional-license-v1"),
        name: "Professional License",
        description: "Professional license and qualification verification",
        requiredFields: ["name", "licenseNumber", "issuingAuthority", "profession", "expiryDate"],
        validityPeriod: 365 * 24 * 60 * 60, // 1 year
        verificationLevel: 3
      }
    };
  }

  async deployAllSchemas() {
    const schemas = this.getStandardSchemas();
    const deployedSchemas = {};
    
    for (const [key, schema] of Object.entries(schemas)) {
      try {
        console.log(`Deploying schema: ${schema.name}`);
        
        const tx = await this.identityIssuer.createCredentialSchema(
          schema.id,
          schema.name,
          schema.description,
          schema.requiredFields,
          schema.validityPeriod
        );
        
        await tx.wait();
        deployedSchemas[key] = {
          ...schema,
          transactionHash: tx.hash
        };
        
        console.log(`✅ Schema deployed: ${schema.name} (${tx.hash})`);
      } catch (error) {
        console.error(`❌ Failed to deploy schema ${schema.name}:`, error.message);
      }
    }
    
    return deployedSchemas;
  }

  async getSchemaDetails(schemaId) {
    try {
      const details = await this.identityIssuer.getCredentialSchema(schemaId);
      return {
        name: details.name,
        description: details.description,
        requiredFields: details.requiredFields,
        validityPeriod: details.validityPeriod.toNumber(),
        active: details.active
      };
    } catch (error) {
      console.error('Error fetching schema details:', error);
      return null;
    }
  }

  validateCredentialData(schemaId, credentialData) {
    const schemas = this.getStandardSchemas();
    const schema = Object.values(schemas).find(s => s.id === schemaId);
    
    if (!schema) {
      throw new Error('Schema not found');
    }

    const errors = [];
    
    // Check required fields
    for (const field of schema.requiredFields) {
      if (!credentialData[field] || credentialData[field].trim() === '') {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate specific field formats
    if (credentialData.dateOfBirth) {
      const birthDate = new Date(credentialData.dateOfBirth);
      if (isNaN(birthDate.getTime())) {
        errors.push('Invalid date of birth format');
      }
      
      const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 0 || age > 150) {
        errors.push('Invalid age calculated from date of birth');
      }
    }

    if (credentialData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(credentialData.email)) {
        errors.push('Invalid email format');
      }
    }

    if (credentialData.governmentId) {
      if (credentialData.governmentId.length < 5) {
        errors.push('Government ID too short');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  generateCredentialHash(credentialData) {
    // Sort keys for consistent hashing
    const sortedKeys = Object.keys(credentialData).sort();
    const sortedData = {};
    
    for (const key of sortedKeys) {
      sortedData[key] = credentialData[key];
    }
    
    return ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(JSON.stringify(sortedData))
    );
  }

  async issueCredential(schemaId, holder, credentialData, metadataURI = "") {
    // Validate credential data
    const validation = this.validateCredentialData(schemaId, credentialData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Generate credential hash
    const credentialHash = this.generateCredentialHash(credentialData);
    
    // Generate unique credential ID
    const credentialId = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "bytes32", "uint256"],
        [schemaId, holder, credentialHash, Date.now()]
      )
    );

    try {
      const tx = await this.identityIssuer.issueCredential(
        credentialId,
        schemaId,
        holder,
        credentialHash,
        metadataURI
      );

      await tx.wait();

      return {
        credentialId,
        schemaId,
        holder,
        credentialHash,
        credentialData,
        metadataURI,
        transactionHash: tx.hash
      };
    } catch (error) {
      console.error('Error issuing credential:', error);
      throw error;
    }
  }

  async verifyCredential(credentialId) {
    try {
      const isValid = await this.identityIssuer.verifyCredential(credentialId);
      
      if (isValid) {
        const credential = await this.identityIssuer.issuedCredentials(credentialId);
        return {
          valid: true,
          credential: {
            schemaId: credential.schemaId,
            holder: credential.holder,
            credentialHash: credential.credentialHash,
            issuedAt: credential.issuedAt.toNumber(),
            expiresAt: credential.expiresAt.toNumber(),
            revoked: credential.revoked,
            metadataURI: credential.metadataURI
          }
        };
      }
      
      return { valid: false };
    } catch (error) {
      console.error('Error verifying credential:', error);
      return { valid: false, error: error.message };
    }
  }

  async getHolderCredentials(holder) {
    try {
      const credentialIds = await this.identityIssuer.getHolderCredentials(holder);
      const credentials = [];
      
      for (const credentialId of credentialIds) {
        const verification = await this.verifyCredential(credentialId);
        if (verification.valid) {
          credentials.push({
            id: credentialId,
            ...verification.credential
          });
        }
      }
      
      return credentials;
    } catch (error) {
      console.error('Error fetching holder credentials:', error);
      return [];
    }
  }
}

module.exports = { CredentialSchemaManager };