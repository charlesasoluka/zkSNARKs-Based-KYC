import React, { useContext, useState } from 'react';
import { Web3Context } from '../context/Web3Context';

function WalletConnection() {
  const { connectWallet, loading, error, switchToSepolia, addSepoliaNetwork } = useContext(Web3Context);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      await connectWallet();
      
      // Check if we need to switch to Sepolia
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const sepoliaChainId = '0xaa36a7'; // 11155111 in hex
      
      if (chainId !== sepoliaChainId) {
        await switchToSepolia();
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAddSepolia = async () => {
    try {
      await addSepoliaNetwork();
    } catch (error) {
      console.error('Error adding Sepolia network:', error);
    }
  };

  return (
    <div className="wallet-connection">
      <div className="connection-card">
        <div className="card-header">
          <h2>Connect Your Wallet</h2>
          <p>Connect your MetaMask wallet to access the ZK-KYC system</p>
        </div>

        {error && (
          <div className="error-message">
            <strong>Connection Error:</strong> {error}
          </div>
        )}

        <div className="connection-steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Install MetaMask</h3>
              <p>Make sure you have MetaMask installed in your browser</p>
              {!window.ethereum && (
                <a 
                  href="https://metamask.io/download/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                >
                  Install MetaMask
                </a>
              )}
            </div>
          </div>

          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Connect to Sepolia</h3>
              <p>This application requires the Sepolia test network</p>
              <button 
                onClick={handleAddSepolia}
                className="btn btn-outline"
                disabled={!window.ethereum}
              >
                Add Sepolia Network
              </button>
            </div>
          </div>

          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Connect Wallet</h3>
              <p>Click the button below to connect your MetaMask wallet</p>
              <button 
                onClick={handleConnect}
                disabled={!window.ethereum || loading || isConnecting}
                className="btn btn-primary"
              >
                {isConnecting ? (
                  <span className="loading-spinner">
                    <span className="spinner"></span>
                    Connecting...
                  </span>
                ) : (
                  'Connect MetaMask'
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="features-info">
          <h3>What you can do with ZK-KYC:</h3>
          <ul>
            <li>Create a privacy-preserving digital identity</li>
            <li>Generate zero-knowledge proofs for age verification</li>
            <li>Access services without revealing personal information</li>
            <li>Maintain full control over your data</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .wallet-connection {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 60vh;
          padding: 2rem 0;
        }

        .connection-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          padding: 2rem;
          max-width: 600px;
          width: 100%;
        }

        .card-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .card-header h2 {
          color: #333;
          margin-bottom: 0.5rem;
          font-size: 1.8rem;
        }

        .card-header p {
          color: #666;
          font-size: 1rem;
        }

        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          border: 1px solid #f5c6cb;
        }

        .connection-steps {
          margin-bottom: 2rem;
        }

        .step {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background-color: #f8f9fa;
          border-radius: 8px;
        }

        .step-number {
          background-color: #007bff;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          flex-shrink: 0;
        }

        .step-content {
          flex: 1;
        }

        .step-content h3 {
          margin: 0 0 0.5rem 0;
          color: #333;
          font-size: 1.1rem;
        }

        .step-content p {
          margin: 0 0 0.5rem 0;
          color: #666;
          font-size: 0.9rem;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 500;
          transition: all 0.2s;
          text-decoration: none;
          display: inline-block;
          text-align: center;
        }

        .btn-primary {
          background-color: #007bff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .btn-outline {
          background-color: transparent;
          color: #007bff;
          border: 2px solid #007bff;
        }

        .btn-outline:hover:not(:disabled) {
          background-color: #007bff;
          color: white;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-spinner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .features-info {
          background-color: #e3f2fd;
          padding: 1.5rem;
          border-radius: 8px;
          border-left: 4px solid #2196f3;
        }

        .features-info h3 {
          margin: 0 0 1rem 0;
          color: #1565c0;
          font-size: 1.1rem;
        }

        .features-info ul {
          margin: 0;
          padding-left: 1.5rem;
        }

        .features-info li {
          margin-bottom: 0.5rem;
          color: #333;
        }

        @media (max-width: 768px) {
          .connection-card {
            margin: 1rem;
            padding: 1.5rem;
          }

          .step {
            flex-direction: column;
            text-align: center;
          }

          .step-number {
            align-self: center;
          }
        }
      `}</style>
    </div>
  );
}

export default WalletConnection;