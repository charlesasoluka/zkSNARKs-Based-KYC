// Centralized API service for backend communication
class ApiService {
  constructor() {
    this.baseUrls = {
      trustedIssuer: 'http://localhost:3002',
      verifierService: 'http://localhost:3003', 
      proofServer: 'http://localhost:3001'
    };
    
    this.defaultTimeout = 30000; // 30 seconds
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  // Generic request method with retry logic and better error handling
  async request(url, options = {}) {
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: options.timeout || this.defaultTimeout,
      ...options
    };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;

      } catch (error) {
        console.warn(`Request attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.retryAttempts) {
          throw new Error(`Request failed after ${this.retryAttempts} attempts: ${error.message}`);
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }

  // Trusted Issuer API calls
  async issueDid(userData) {
    const url = `${this.baseUrls.trustedIssuer}/issue-did`;
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async getMerkleProof(userAddress) {
    const url = `${this.baseUrls.trustedIssuer}/merkle-proof/${userAddress}`;
    return this.request(url);
  }

  async getMerkleRoot() {
    const url = `${this.baseUrls.trustedIssuer}/merkle-root`;
    return this.request(url);
  }

  async getTrustedIssuerHealth() {
    const url = `${this.baseUrls.trustedIssuer}/health`;
    return this.request(url, { timeout: 5000 });
  }

  // Verifier Service API calls
  async getServices() {
    const url = `${this.baseUrls.verifierService}/services`;
    return this.request(url);
  }

  async verifyProof(proofData) {
    const url = `${this.baseUrls.verifierService}/verify-proof`;
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(proofData),
      timeout: 60000 // Extended timeout for proof verification
    });
  }

  async checkAccess(userAddress, service) {
    const url = `${this.baseUrls.verifierService}/check-access/${userAddress}/${service}`;
    return this.request(url);
  }

  async revokeAccess(userAddress, service) {
    const url = `${this.baseUrls.verifierService}/revoke-access`;
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify({ userAddress, service })
    });
  }

  async getVerifierHealth() {
    const url = `${this.baseUrls.verifierService}/health`;
    return this.request(url, { timeout: 5000 });
  }

  // Proof Server API calls
  async generateProof(proofInputs) {
    const url = `${this.baseUrls.proofServer}/generate-proof`;
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(proofInputs),
      timeout: 120000 // Extended timeout for proof generation
    });
  }

  async verifyProofOnServer(proof, publicSignals) {
    const url = `${this.baseUrls.proofServer}/verify-proof`;
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify({ proof, publicSignals }),
      timeout: 60000
    });
  }

  async getProofServerHealth() {
    const url = `${this.baseUrls.proofServer}/health`;
    return this.request(url, { timeout: 5000 });
  }

  // Batch health check for all services
  async checkAllServicesHealth() {
    const healthChecks = await Promise.allSettled([
      this.getTrustedIssuerHealth(),
      this.getVerifierHealth(),
      this.getProofServerHealth()
    ]);

    return {
      trustedIssuer: healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : { error: healthChecks[0].reason?.message },
      verifierService: healthChecks[1].status === 'fulfilled' ? healthChecks[1].value : { error: healthChecks[1].reason?.message },
      proofServer: healthChecks[2].status === 'fulfilled' ? healthChecks[2].value : { error: healthChecks[2].reason?.message }
    };
  }

  // Helper method to check if a service is available
  async isServiceAvailable(serviceName) {
    try {
      const healthMethod = `get${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)}Health`;
      if (typeof this[healthMethod] === 'function') {
        await this[healthMethod]();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Update base URLs (useful for different environments)
  updateBaseUrls(newUrls) {
    this.baseUrls = { ...this.baseUrls, ...newUrls };
  }

  // Get current service URLs
  getServiceUrls() {
    return { ...this.baseUrls };
  }
}

// Export singleton instance
const apiService = new ApiService();
export default apiService;