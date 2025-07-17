# ZK-KYC Frontend

A React-based frontend application for the ZK-KYC (Zero-Knowledge Know Your Customer) system. This application provides a user-friendly interface for privacy-preserving identity verification using zero-knowledge proofs.

## Features

- **Wallet Connection**: Connect MetaMask wallet to interact with the Ethereum blockchain
- **Identity Creation**: Create privacy-preserving digital identities
- **ZK Proof Generation**: Generate zero-knowledge proofs for age verification
- **Service Access**: Submit proofs to access various services without revealing personal information
- **Access Management**: Check and manage service access permissions
- **Network Support**: Optimized for Sepolia testnet

## Prerequisites

- Node.js (v16 or higher)
- MetaMask browser extension
- Sepolia testnet ETH for gas fees

## Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. The application is configured to use the deployed contracts on Sepolia testnet with the following addresses:
   - **KYC Registry**: `0x819799345151F021195F5DF69bFF38Fe7239Ecd4`
   - **Access Controller**: `0x3CE91999eE4fdd91BB1dB7Cb8ec2f2781cE4a883`
   - **Verifier**: `0x7cAa97F4eB8708CEFB04eC8D8d54b572b90E5367`
   - **Hasher**: `0x1862b393cdE4FA9B629018322a517FD72c1740fb`

## Running the Application

### Development Mode

Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

### Production Build

Create a production build:
```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

### 1. Connect Your Wallet

1. Open the application in your browser
2. Click "Connect MetaMask" to connect your wallet
3. Make sure you're on the Sepolia testnet (the app will prompt you to switch if needed)

### 2. Create an Identity

1. After connecting your wallet, click "Create Identity"
2. This creates a privacy-preserving digital identity using zero-knowledge cryptography
3. Your identity commitment will be stored locally (securely store this in production)

### 3. Register Your Commitment

1. Click "Register Commitment" to add your identity commitment to the blockchain
2. This requires a transaction on the Sepolia testnet
3. Wait for the transaction to be confirmed

### 4. Generate ZK Proofs

1. Fill in your birth date and age
2. Select a service you want to access
3. Click "Generate & Submit Proof"
4. The system will:
   - Generate a zero-knowledge proof of your age
   - Submit it to the smart contract
   - Grant you access to the service if the proof is valid

### 5. Check Access Status

The interface shows available services and your access status for each service.

## Project Structure

```
frontend/
├── public/
│   └── index.html          # Main HTML template
├── src/
│   ├── components/
│   │   ├── ZKKYCWallet.js     # Main wallet interface
│   │   ├── WalletConnection.js # Wallet connection component
│   │   └── NetworkStatus.js   # Network status display
│   ├── context/
│   │   ├── Web3Context.js     # Web3 provider context
│   │   └── ZKKYCContext.js    # ZK-KYC specific context
│   ├── config/
│   │   └── contracts.json     # Contract addresses
│   ├── App.js              # Main application component
│   └── index.js            # Application entry point
├── package.json
├── webpack.config.js
└── .babelrc
```

## Configuration

The application is configured to work with the deployed contracts on Sepolia testnet. Contract addresses are stored in `src/config/contracts.json`.

## Security Considerations

- **Local Storage**: In development, identity keys are stored in localStorage. In production, use secure storage
- **Private Keys**: Never expose private keys or sensitive cryptographic material
- **Network Security**: Only use trusted RPC endpoints
- **Input Validation**: All user inputs are validated before processing

## Troubleshooting

### Common Issues

1. **MetaMask not detected**: Make sure MetaMask is installed and enabled
2. **Wrong network**: Switch to Sepolia testnet in MetaMask
3. **Transaction failures**: Ensure you have sufficient Sepolia ETH for gas fees
4. **Slow proof generation**: ZK proof generation is computationally intensive and may take time

### Development Issues

1. **Module not found**: Run `npm install` to install dependencies
2. **Build errors**: Check that all dependencies are installed and versions are compatible
3. **Hot reload not working**: Restart the development server

## Browser Support

- Chrome 80+
- Firefox 78+
- Safari 13+
- Edge 80+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.