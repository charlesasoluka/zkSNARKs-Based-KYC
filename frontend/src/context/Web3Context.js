import React, { createContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

export const Web3Context = createContext();

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [network, setNetwork] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  
  const SEPOLIA_CHAIN_ID = 11155111;
  const SEPOLIA_CHAIN_HEX = '0xaa36a7';

  useEffect(() => {
    checkWalletConnection();
    setupEventListeners();
    return () => {
      removeEventListeners();
    };
  }, []);
  
  const setupEventListeners = () => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }
  };
  
  const removeEventListeners = () => {
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
  };
  
  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAccount(accounts[0]);
      if (provider) {
        setSigner(provider.getSigner());
      }
    }
  };
  
  const handleChainChanged = (chainId) => {
    // Convert hex to decimal and check if it's Sepolia
    const chainIdDecimal = parseInt(chainId, 16);
    setIsCorrectNetwork(chainIdDecimal === SEPOLIA_CHAIN_ID);
    
    // Reload the page to reset the app state
    window.location.reload();
  };
  
  const checkNetworkCompatibility = (networkInfo) => {
    const isCorrect = networkInfo.chainId === SEPOLIA_CHAIN_ID;
    setIsCorrectNetwork(isCorrect);
    return isCorrect;
  };

  const checkWalletConnection = async () => {
    try {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider);
        
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setSigner(provider.getSigner());
          
          const network = await provider.getNetwork();
          setNetwork(network);
          checkNetworkCompatibility(network);
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
      setError('Failed to connect to wallet');
    }
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(provider);
      
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setSigner(provider.getSigner());
        
        const network = await provider.getNetwork();
        setNetwork(network);
        checkNetworkCompatibility(network);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setNetwork(null);
    setError(null);
    setIsCorrectNetwork(false);
  };
  
  const switchAccount = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }
      
      // Request account access to show account selector
      await window.ethereum.request({ 
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }] 
      });
      
      // Reconnect with the new account
      await connectWallet();
    } catch (error) {
      console.error('Error switching account:', error);
      setError('Failed to switch account');
    } finally {
      setLoading(false);
    }
  };

  const switchToSepolia = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }
      
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_HEX }],
      });
      
      // Wait a bit for the network to switch
      setTimeout(() => {
        checkWalletConnection();
      }, 1000);
      
    } catch (error) {
      // If the network doesn't exist, add it
      if (error.code === 4902) {
        await addSepoliaNetwork();
      } else {
        console.error('Error switching network:', error);
        setError('Failed to switch to Sepolia network');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const addSepoliaNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: SEPOLIA_CHAIN_HEX,
          chainName: 'Sepolia Test Network',
          nativeCurrency: {
            name: 'SepoliaETH',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: ['https://sepolia.infura.io/v3/'],
          blockExplorerUrls: ['https://sepolia.etherscan.io/']
        }]
      });
    } catch (error) {
      console.error('Error adding Sepolia network:', error);
      setError('Failed to add Sepolia network');
    }
  };

  const value = {
    account,
    provider,
    signer,
    network,
    loading,
    error,
    isCorrectNetwork,
    connectWallet,
    disconnectWallet,
    switchAccount,
    switchToSepolia,
    addSepoliaNetwork,
    isConnected: !!account,
    SEPOLIA_CHAIN_ID
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};