import React, { useState, useEffect, useContext } from 'react';
import { Web3Provider, Web3Context } from './context/Web3Context';
import { ZKKYCProvider } from './context/ZKKYCContext';
import ZKKYCWallet from './components/ZKKYCWallet';
import WalletConnection from './components/WalletConnection';
import NetworkStatus from './components/NetworkStatus';

function AppContent() {
  const { account, network, isConnected, isCorrectNetwork, error: web3Error, switchAccount, switchToSepolia } = useContext(Web3Context);
  const [appError, setAppError] = useState(null);

  useEffect(() => {
    // Check if we're on the correct network
    if (network && !isCorrectNetwork) {
      setAppError('Please switch to Sepolia testnet to use this application');
    } else {
      setAppError(null);
    }
  }, [network, isCorrectNetwork]);

  return (
    <div className="app">
      <header>
        <div className="container">
          <h1>ZK-KYC System</h1>
          <p>Privacy-preserving KYC verification using zero-knowledge proofs</p>
        </div>
      </header>

      <main className="container">
        {/* Network Status */}
        <NetworkStatus />

        {/* Error Display */}
        {(appError || web3Error) && (
          <div className="error-banner">
            {appError || web3Error}
            {appError && network && !isCorrectNetwork && (
              <button 
                onClick={switchToSepolia} 
                className="switch-network-btn"
                style={{ marginLeft: '10px' }}
              >
                Switch to Sepolia
              </button>
            )}
          </div>
        )}
        
        {/* Wallet Controls */}
        {isConnected && (
          <div className="wallet-controls">
            <div className="wallet-info">
              <span>Connected: {account?.slice(0, 6)}...{account?.slice(-4)}</span>
              <span className={`network-status ${isCorrectNetwork ? 'correct' : 'incorrect'}`}>
                {network?.name || 'Unknown Network'} {isCorrectNetwork ? '✅' : '❌'}
              </span>
            </div>
            <button 
              onClick={switchAccount} 
              className="btn btn-outline"
            >
              Switch Account
            </button>
          </div>
        )}

        {/* Main Content */}
        {!isConnected ? (
          <WalletConnection />
        ) : !isCorrectNetwork ? (
          <div className="network-warning">
            <h3>⚠️ Wrong Network</h3>
            <p>Please switch to Sepolia testnet to use this application.</p>
            <button onClick={switchToSepolia} className="btn btn-primary">
              Switch to Sepolia
            </button>
          </div>
        ) : (
          <ZKKYCProvider>
            <ZKKYCWallet />
          </ZKKYCProvider>
        )}

        {/* Footer */}
        <footer>
          <div className="footer-content">
            <p>&copy; 2024 ZK-KYC System. Privacy-first identity verification.</p>
            <div className="footer-links">
              <a href="https://sepolia.etherscan.io/" target="_blank" rel="noopener noreferrer">
                View on Sepolia Etherscan
              </a>
              <span>•</span>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </main>

      <style jsx>{`
        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 2rem 0;
          text-align: center;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        header h1 {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
          font-weight: 700;
        }

        header p {
          font-size: 1.1rem;
          opacity: 0.9;
          max-width: 600px;
          margin: 0 auto;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem;
        }

        main {
          flex: 1;
          padding: 2rem 1rem;
        }

        .error-banner {
          background-color: #f8d7da;
          color: #721c24;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          border: 1px solid #f5c6cb;
          text-align: center;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        
        .switch-network-btn {
          background-color: #007bff;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }
        
        .switch-network-btn:hover {
          background-color: #0056b3;
        }
        
        .wallet-controls {
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .wallet-info {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .network-status {
          font-size: 0.9rem;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 500;
        }
        
        .network-status.correct {
          background-color: #d4edda;
          color: #155724;
        }
        
        .network-status.incorrect {
          background-color: #f8d7da;
          color: #721c24;
        }
        
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        
        .btn-outline {
          background-color: transparent;
          color: #007bff;
          border: 1px solid #007bff;
        }
        
        .btn-outline:hover {
          background-color: #007bff;
          color: white;
        }

        footer {
          background-color: #f8f9fa;
          border-top: 1px solid #e9ecef;
          padding: 2rem 0;
          margin-top: 3rem;
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .footer-links {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .footer-links a {
          color: #007bff;
          text-decoration: none;
          transition: color 0.2s;
        }

        .footer-links a:hover {
          color: #0056b3;
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          header h1 {
            font-size: 2rem;
          }

          header p {
            font-size: 1rem;
          }

          .footer-content {
            flex-direction: column;
            text-align: center;
          }

          main {
            padding: 1rem;
          }
          
          .wallet-controls {
            flex-direction: column;
            text-align: center;
          }
        }
        
        .network-warning {
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          margin: 2rem 0;
        }
        
        .network-warning h3 {
          color: #856404;
          margin-bottom: 1rem;
        }
        
        .network-warning p {
          color: #856404;
          margin-bottom: 1.5rem;
        }
        
        .btn-primary {
          background-color: #007bff;
          color: white;
        }
        
        .btn-primary:hover {
          background-color: #0056b3;
        }
      `}</style>
    </div>
  );
}

function App() {
  return (
    <Web3Provider>
      <AppContent />
    </Web3Provider>
  );
}

export default App;