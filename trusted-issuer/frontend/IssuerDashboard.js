import React, { useState, useEffect } from 'react';

const ISSUER_API_URL = 'http://localhost:3002';

function IssuerDashboard() {
  const [issuedDIDs, setIssuedDIDs] = useState([]);
  const [merkleRoot, setMerkleRoot] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});

  // New DID issuance form
  const [newDID, setNewDID] = useState({
    age: '',
    name: '',
    nationality: '',
    userAddress: ''
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load issued DIDs
      const didsResponse = await fetch(`${ISSUER_API_URL}/admin/issued-dids`);
      const didsResult = await didsResponse.json();
      if (didsResult.success) {
        setIssuedDIDs(didsResult.data);
      }

      // Load merkle root
      const rootResponse = await fetch(`${ISSUER_API_URL}/merkle-root`);
      const rootResult = await rootResponse.json();
      if (rootResult.success) {
        setMerkleRoot(rootResult.data.merkleRoot);
        setStats({
          totalLeaves: rootResult.data.totalLeaves,
          merkleRoot: rootResult.data.merkleRoot
        });
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const issueDID = async (e) => {
    e.preventDefault();
    
    if (!newDID.age || !newDID.name || !newDID.nationality || !newDID.userAddress) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${ISSUER_API_URL}/issue-did`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          age: parseInt(newDID.age),
          name: newDID.name,
          nationality: newDID.nationality,
          userAddress: newDID.userAddress
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setNewDID({ age: '', name: '', nationality: '', userAddress: '' });
        await loadDashboardData(); // Refresh data
        alert('DID issued successfully!');
      } else {
        setError(`Failed to issue DID: ${result.error}`);
      }
    } catch (error) {
      console.error('Error issuing DID:', error);
      setError('Failed to issue DID');
    } finally {
      setLoading(false);
    }
  };

  const updateBlockchain = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${ISSUER_API_URL}/update-blockchain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Blockchain updated successfully!');
      } else {
        setError(`Failed to update blockchain: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating blockchain:', error);
      setError('Failed to update blockchain');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="issuer-dashboard">
      <h1>🏛️ Trusted Issuer Dashboard</h1>
      
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Statistics */}
      <div className="stats-section">
        <h2>📊 Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total DIDs Issued</h3>
            <p className="stat-number">{stats.totalLeaves || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Current Merkle Root</h3>
            <p className="stat-hash">{merkleRoot ? `${merkleRoot.slice(0, 10)}...${merkleRoot.slice(-8)}` : 'Empty'}</p>
          </div>
        </div>
      </div>

      {/* Issue New DID */}
      <div className="issue-section">
        <h2>🆔 Issue New DID</h2>
        <form onSubmit={issueDID} className="issue-form">
          <div className="form-row">
            <div className="form-group">
              <label>User Address:</label>
              <input
                type="text"
                value={newDID.userAddress}
                onChange={(e) => setNewDID({...newDID, userAddress: e.target.value})}
                placeholder="0x..."
                required
              />
            </div>
            <div className="form-group">
              <label>Age:</label>
              <input
                type="number"
                value={newDID.age}
                onChange={(e) => setNewDID({...newDID, age: e.target.value})}
                min="0"
                max="120"
                required
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Full Name:</label>
              <input
                type="text"
                value={newDID.name}
                onChange={(e) => setNewDID({...newDID, name: e.target.value})}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="form-group">
              <label>Nationality:</label>
              <select
                value={newDID.nationality}
                onChange={(e) => setNewDID({...newDID, nationality: e.target.value})}
                required
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
          </div>
          
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Issuing...' : 'Issue DID'}
          </button>
        </form>
      </div>

      {/* Blockchain Update */}
      <div className="blockchain-section">
        <h2>⛓️ Blockchain Management</h2>
        <p>Update the smart contract with the current merkle root:</p>
        <button 
          onClick={updateBlockchain} 
          disabled={loading}
          className="btn btn-secondary"
        >
          {loading ? 'Updating...' : 'Update Blockchain'}
        </button>
      </div>

      {/* Issued DIDs List */}
      <div className="dids-section">
        <h2>📋 Issued DIDs</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="dids-table">
            <table>
              <thead>
                <tr>
                  <th>User Address</th>
                  <th>DID</th>
                  <th>Leaf Index</th>
                  <th>Issued At</th>
                </tr>
              </thead>
              <tbody>
                {issuedDIDs.map((did, index) => (
                  <tr key={index}>
                    <td>{did.userAddress.slice(0, 6)}...{did.userAddress.slice(-4)}</td>
                    <td>{did.did.slice(0, 10)}...{did.did.slice(-8)}</td>
                    <td>{did.leafIndex}</td>
                    <td>{new Date(did.issuedAt).toLocaleString()}</td>
                  </tr>
                ))}
                {issuedDIDs.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{textAlign: 'center', color: '#666'}}>
                      No DIDs issued yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .issuer-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .stats-section, .issue-section, .blockchain-section, .dids-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }
        
        .stat-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
        }
        
        .stat-number {
          font-size: 2rem;
          font-weight: bold;
          color: #007bff;
          margin: 10px 0;
        }
        
        .stat-hash {
          font-family: monospace;
          font-size: 0.9rem;
          color: #666;
          margin: 10px 0;
        }
        
        .issue-form {
          max-width: 600px;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 15px;
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
        }
        
        .form-group label {
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        .form-group input, .form-group select {
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
          margin-right: 10px;
        }
        
        .btn-primary {
          background: #007bff;
          color: white;
        }
        
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .dids-table {
          overflow-x: auto;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        
        th {
          background: #f8f9fa;
          font-weight: bold;
        }
        
        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default IssuerDashboard;