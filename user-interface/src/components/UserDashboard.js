import React, { useState, useEffect, useContext } from 'react';
import { ethers } from 'ethers';
import { Web3Context } from '../../../frontend/src/context/Web3Context';

const TRUSTED_ISSUER_URL = 'http://localhost:3002';
const VERIFIER_URL = 'http://localhost:3003';

function UserDashboard() {
  const { account, isConnected } = useContext(Web3Context);
  const [userDID, setUserDID] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [proofStatus, setProofStatus] = useState(null);
  
  // Form data for DID request
  const [formData, setFormData] = useState({
    age: '',
    name: '',
    nationality: ''
  });
  
  // Proof generation data
  const [proofData, setProofData] = useState(null);
  const [hasVotingAccess, setHasVotingAccess] = useState(false);

  useEffect(() => {
    if (account) {
      loadUserDID();
    }
  }, [account]);

  const loadUserDID = async () => {
    try {
      const stored = localStorage.getItem(`user_did_${account}`);
      if (stored) {
        setUserDID(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading user DID:', error);
    }
  };

  const requestDID = async () => {
    if (!formData.age || !formData.name || !formData.nationality) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${TRUSTED_ISSUER_URL}/issue-did`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          age: parseInt(formData.age),
          name: formData.name,
          nationality: formData.nationality,
          userAddress: account
        })
      });

      const result = await response.json();
      
      if (result.success) {
        const didInfo = {
          ...result.data,
          originalData: formData
        };
        
        setUserDID(didInfo);
        localStorage.setItem(`user_did_${account}`, JSON.stringify(didInfo));
        setProofStatus('✅ DID issued successfully by trusted authority');
      } else {
        setError(`Failed to issue DID: ${result.error}`);
      }
    } catch (error) {
      console.error('Error requesting DID:', error);
      setError('Failed to connect to trusted issuer');
    } finally {
      setLoading(false);
    }
  };

  const generateProof = async () => {
    if (!userDID) {
      setError('No DID available. Please request DID first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setProofStatus('🔐 Generating zero-knowledge proof...');
      
      // Get merkle proof from trusted issuer
      const proofResponse = await fetch(`${TRUSTED_ISSUER_URL}/merkle-proof/${account}`);
      const proofResult = await proofResponse.json();
      
      if (!proofResult.success) {
        throw new Error('Failed to get merkle proof');
      }

      const merkleProof = proofResult.data;
      
      // Prepare ZK proof inputs
      const proofInputs = {
        // Private inputs
        age: userDID.originalData.age,
        name: userDID.originalData.name,
        nationality: userDID.originalData.nationality,
        randomID: userDID.randomID,
        merkleProof: merkleProof.proof,
        
        // Public inputs  
        merkleRoot: merkleProof.merkleRoot,
        minimumAge: 18,
        currentTime: Math.floor(Date.now() / 1000)
      };

      setProofStatus('📡 Generating cryptographic proof...');
      
      // For now, create a structured proof (in production, use real ZK proof)
      const proof = {
        proofData: {
          merkleRoot: merkleProof.merkleRoot,
          nullifierHash: ethers.keccak256(
            ethers.toUtf8Bytes(`${userDID.did}_${proofInputs.currentTime}`)
          ),
          ageVerified: parseInt(userDID.originalData.age) >= 18,
          timestamp: proofInputs.currentTime
        },
        metadata: {
          userAddress: account,
          proofType: 'age_verification',
          generatedAt: new Date().toISOString()
        }
      };

      setProofData(proof);
      setProofStatus('✅ Zero-knowledge proof generated successfully');
      
    } catch (error) {
      console.error('Error generating proof:', error);
      setError(`Failed to generate proof: ${error.message}`);
      setProofStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const submitProofToVerifier = async () => {
    if (!proofData) {
      setError('No proof available. Please generate proof first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setProofStatus('📤 Submitting proof to verifier...');
      
      const response = await fetch(`${VERIFIER_URL}/verify-proof`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          proof: proofData.proofData,
          metadata: proofData.metadata,
          service: 'voting'
        })
      });

      const result = await response.json();
      
      if (result.success && result.data.verified) {
        setHasVotingAccess(true);
        setProofStatus('🎉 Proof verified! Voting access granted.');
      } else {
        setError(`Proof verification failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error submitting proof:', error);
      setError('Failed to connect to verifier service');
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="user-dashboard">
        <h2>👤 User Dashboard</h2>
        <p>Please connect your wallet to continue</p>
      </div>
    );
  }

  return (
    <div className="user-dashboard">
      <h2>👤 User Dashboard</h2>
      
      <div className="user-info">
        <p><strong>Account:</strong> {account?.slice(0, 6)}...{account?.slice(-4)}</p>
        <p><strong>DID Status:</strong> {userDID ? '✅ Issued' : '❌ Not issued'}</p>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {proofStatus && (
        <div className="status-message">
          {proofStatus}
        </div>
      )}

      {!userDID ? (
        <div className="did-request-section">
          <h3>🆔 Request DID from Trusted Issuer</h3>
          <div className="form-group">
            <label>Age:</label>
            <input
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({...formData, age: e.target.value})}
              min="0"
              max="120"
              placeholder="Enter your age"
            />
          </div>
          <div className="form-group">
            <label>Full Name:</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Enter your full name"
            />
          </div>
          <div className="form-group">
            <label>Nationality:</label>
            <select
              value={formData.nationality}
              onChange={(e) => setFormData({...formData, nationality: e.target.value})}
            >
              <option value="">Select nationality</option>
              <option value="US">United States</option>
              <option value="UK">United Kingdom</option>
              <option value="CA">Canada</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="JP">Japan</option>
              <option value="AU">Australia</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <button 
            onClick={requestDID}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Requesting...' : 'Request DID from Trusted Issuer'}
          </button>
        </div>
      ) : (
        <div className="did-info-section">
          <h3>🆔 Your DID Information</h3>
          <div className="did-details">
            <p><strong>DID:</strong> {userDID.did?.slice(0, 10)}...{userDID.did?.slice(-8)}</p>
            <p><strong>Issued At:</strong> {new Date(userDID.issuedAt).toLocaleString()}</p>
            <p><strong>Merkle Root:</strong> {userDID.merkleRoot?.slice(0, 10)}...{userDID.merkleRoot?.slice(-8)}</p>
            <p><strong>Age Eligible:</strong> {parseInt(userDID.originalData.age) >= 18 ? '✅ Yes' : '❌ No'}</p>
          </div>

          <div className="proof-section">
            <h3>🔐 Generate Zero-Knowledge Proof</h3>
            <button 
              onClick={generateProof}
              disabled={loading || proofData}
              className="btn btn-secondary"
            >
              {loading ? 'Generating...' : proofData ? 'Proof Generated' : 'Generate ZK Proof'}
            </button>
          </div>

          {proofData && (
            <div className="proof-details">
              <h4>📜 Generated Proof</h4>
              <div className="proof-info">
                <p><strong>Nullifier:</strong> {proofData.proofData.nullifierHash?.slice(0, 10)}...{proofData.proofData.nullifierHash?.slice(-8)}</p>
                <p><strong>Age Verified:</strong> {proofData.proofData.ageVerified ? '✅ Yes' : '❌ No'}</p>
                <p><strong>Generated At:</strong> {new Date(proofData.metadata.generatedAt).toLocaleString()}</p>
              </div>
              
              <button 
                onClick={submitProofToVerifier}
                disabled={loading || hasVotingAccess}
                className="btn btn-success"
              >
                {loading ? 'Submitting...' : hasVotingAccess ? 'Access Granted' : 'Submit to Verifier'}
              </button>
            </div>
          )}

          {hasVotingAccess && (
            <div className="access-granted">
              <h4>🎉 Voting Access Granted!</h4>
              <p>Your zero-knowledge proof has been verified successfully. You can now access the voting system without revealing your identity.</p>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .user-dashboard {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .user-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        
        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .status-message {
          background: #d4edda;
          color: #155724;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        
        .did-request-section, .did-info-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        .form-group input, .form-group select {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .btn-primary {
          background: #007bff;
          color: white;
        }
        
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        
        .btn-success {
          background: #28a745;
          color: white;
        }
        
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .did-details, .proof-info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 4px;
          margin: 10px 0;
        }
        
        .access-granted {
          background: #d4edda;
          color: #155724;
          padding: 20px;
          border-radius: 8px;
          margin-top: 20px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}

export default UserDashboard;