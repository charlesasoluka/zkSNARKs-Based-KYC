import React, { useContext } from 'react';
import { Web3Context } from '../context/Web3Context';

function NetworkStatus() {
  const { account, network, isConnected, isCorrectNetwork, switchToSepolia, SEPOLIA_CHAIN_ID } = useContext(Web3Context);

  const networkName = network?.name || 'Unknown';
  const shortAccount = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : '';

  const handleSwitchNetwork = async () => {
    await switchToSepolia();
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="network-status">
      <div className="status-card">
        <div className="connection-info">
          <div className="connection-row">
            <span className="label">Wallet:</span>
            <span className="value account-address">{shortAccount}</span>
          </div>
          
          <div className="connection-row">
            <span className="label">Network:</span>
            <div className="network-info">
              <span className={`status-indicator ${isCorrectNetwork ? 'correct' : 'incorrect'}`}></span>
              <span className="value">{networkName} {network?.chainId ? `(${network.chainId})` : ''}</span>
              {!isCorrectNetwork && (
                <button 
                  onClick={handleSwitchNetwork}
                  className="switch-network-btn"
                >
                  Switch to Sepolia
                </button>
              )}
            </div>
          </div>
        </div>

        {!isCorrectNetwork && (
          <div className="network-warning">
            <strong>Warning:</strong> Please switch to Sepolia testnet for full functionality
          </div>
        )}
      </div>

      <style jsx>{`
        .network-status {
          margin-bottom: 2rem;
        }

        .status-card {
          background: white;
          border-radius: 8px;
          padding: 1rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          border: 1px solid #e9ecef;
        }

        .connection-info {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .connection-row {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .label {
          font-weight: 600;
          color: #495057;
          min-width: 80px;
        }

        .value {
          color: #212529;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.9rem;
        }

        .account-address {
          background-color: #f8f9fa;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          border: 1px solid #dee2e6;
        }

        .network-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-indicator.correct {
          background-color: #28a745;
          box-shadow: 0 0 0 2px rgba(40, 167, 69, 0.25);
        }

        .status-indicator.incorrect {
          background-color: #dc3545;
          box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.25);
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
          }
          70% {
            box-shadow: 0 0 0 4px rgba(220, 53, 69, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0);
          }
        }

        .switch-network-btn {
          background-color: #ffc107;
          color: #212529;
          border: none;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .switch-network-btn:hover {
          background-color: #ffca2c;
        }

        .network-warning {
          background-color: #fff3cd;
          color: #856404;
          padding: 0.75rem;
          border-radius: 4px;
          margin-top: 1rem;
          border: 1px solid #ffeaa7;
          font-size: 0.9rem;
        }

        @media (max-width: 768px) {
          .connection-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .label {
            min-width: auto;
          }

          .network-info {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}

export default NetworkStatus;