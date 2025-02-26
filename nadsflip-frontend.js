import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import contractABI from './contractABI.json';

// Replace with your deployed contract address
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; 

function App() {
  // State variables
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [balance, setBalance] = useState(0);
  const [betAmount, setBetAmount] = useState('0.1');
  const [isFlipping, setIsFlipping] = useState(false);
  const [coinResult, setCoinResult] = useState(null);
  const [hasWon, setHasWon] = useState(null);
  const [contractBalance, setContractBalance] = useState('0');
  const [totalCommission, setTotalCommission] = useState('0');
  const [error, setError] = useState('');
  const [walletType, setWalletType] = useState('');

  // Initialize wallet connection
  const connectWallet = async (walletProvider) => {
    try {
      let web3Provider;
      
      // Connect to different wallet types
      if (walletProvider === 'metamask') {
        if (!window.ethereum) throw new Error("MetaMask not found");
        web3Provider = window.ethereum;
        setWalletType('MetaMask');
      } else if (walletProvider === 'phantom') {
        if (!window.solana) throw new Error("Phantom not found");
        // Add Phantom specific connection code
        web3Provider = window.ethereum; // For testing, actual implementation may vary
        setWalletType('Phantom');
      } else if (walletProvider === 'rabby') {
        if (!window.ethereum) throw new Error("Rabby not found");
        web3Provider = window.ethereum;
        setWalletType('Rabby');
      } else if (walletProvider === 'backpack') {
        if (!window.ethereum) throw new Error("Backpack not found");
        web3Provider = window.ethereum;
        setWalletType('Backpack');
      }

      // Request account access
      await web3Provider.request({ method: 'eth_requestAccounts' });
      
      // Check if connected to Monad testnet
      const chainId = await web3Provider.request({ method: 'eth_chainId' });
      if (chainId !== '0x27AF') { // 0x27AF is 10143 in hex
        try {
          await web3Provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x27AF' }],
          });
        } catch (switchError) {
          // If the chain hasn't been added to the user's wallet
          if (switchError.code === 4902) {
            await web3Provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x27AF',
                chainName: 'Monad Testnet',
                nativeCurrency: {
                  name: 'MON',
                  symbol: 'MON',
                  decimals: 18
                },
                rpcUrls: ['https://testnet-rpc.monad.xyz'],
                blockExplorerUrls: ['https://testnet.monadexplorer.com']
              }],
            });
          } else {
            throw switchError;
          }
        }
      }

      const ethersProvider = new ethers.providers.Web3Provider(web3Provider);
      const signer = ethersProvider.getSigner();
      const address = await signer.getAddress();
      const balance = await ethersProvider.getBalance(address);
      
      // Initialize contract
      const gameContract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
      const contractBal = await gameContract.getContractBalance();
      
      // Set state variables
      setProvider(ethersProvider);
      setSigner(signer);
      setAccount(address);
      setBalance(ethers.utils.formatEther(balance));
      setContract(gameContract);
      setContractBalance(ethers.utils.formatEther(contractBal));
      
      // Listen for account changes
      web3Provider.on('accountsChanged', (accounts) => {
        setAccount(accounts[0] || '');
        window.location.reload();
      });
      
      // Listen for chain changes
      web3Provider.on('chainChanged', () => {
        window.location.reload();
      });
      
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setError(error.message);
    }
  };

  // Bet on coin flip
  const placeBet = async (isHeads) => {
    try {
      setError('');
      setIsFlipping(true);
      setCoinResult(null);
      setHasWon(null);

      // Calculate total amount with commission
      const betAmountWei = ethers.utils.parseEther(betAmount);
      const commissionRate = await contract.commissionRate();
      const totalAmount = betAmountWei.add(betAmountWei.mul(commissionRate).div(100));

      // Listen for the BetResult event
      contract.once("BetResult", (player, amount, chosenHeads, won) => {
        if (player.toLowerCase() === account.toLowerCase()) {
          setCoinResult(chosenHeads ? "heads" : "tails");
          setHasWon(won);
          
          // Refresh balances
          refreshBalances();
          
          setTimeout(() => {
            setIsFlipping(false);
          }, 2000);
        }
      });

      // Send transaction
      const tx = await contract.flipCoin(isHeads, { value: totalAmount });
      await tx.wait();
      
    } catch (error) {
      console.error("Error placing bet:", error);
      setError(error.message);
      setIsFlipping(false);
    }
  };

  // Refresh user and contract balances
  const refreshBalances = async () => {
    if (provider && account && contract) {
      const userBalance = await provider.getBalance(account);
      const contractBal = await contract.getContractBalance();
      
      setBalance(ethers.utils.formatEther(userBalance));
      setContractBalance(ethers.utils.formatEther(contractBal));
    }
  };

  // Calculate total amount (bet + commission)
  const calculateTotal = () => {
    try {
      const amount = parseFloat(betAmount) || 0;
      const commission = amount * 0.1; // 10% commission
      return (amount + commission).toFixed(2);
    } catch {
      return "0.00";
    }
  };

  // Format wallet address
  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  useEffect(() => {
    // Refresh balances periodically
    const interval = setInterval(() => {
      refreshBalances();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [provider, account, contract]);

  return (
    <div className="app">
      <header>
        <div className="logo">NadsFlip dApp</div>
        <div className="network">Monad Testnet</div>
        {account ? (
          <div className="account-info">
            <div className="balance">{parseFloat(balance).toFixed(4)} MON</div>
            <div className="address">
              {walletType}: {formatAddress(account)}
            </div>
          </div>
        ) : (
          <div className="connect-options">
            <button onClick={() => connectWallet('metamask')}>MetaMask</button>
            <button onClick={() => connectWallet('phantom')}>Phantom</button>
            <button onClick={() => connectWallet('rabby')}>Rabby</button>
            <button onClick={() => connectWallet('backpack')}>Backpack</button>
          </div>
        )}
      </header>

      <main>
        <div className="game-container">
          <div className="prize-pool">
            <h2>{contractBalance} MON</h2>
            <p>Available to Win</p>
          </div>

          <div className="bet-controls">
            <div className="bet-amount">
              <label>Wager</label>
              <div className="input-group">
                <input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  disabled={isFlipping || !account}
                />
                <span>MON</span>
              </div>
              <div className="total-info">
                <p>Balance: {parseFloat(balance).toFixed(2)} MON</p>
                <p>Total with 10% commission: {calculateTotal()} MON</p>
              </div>
            </div>

            <div className="coin-flip-controls">
              <button
                className="heads-button"
                onClick={() => placeBet(true)}
                disabled={isFlipping || !account}
              >
                Heads
              </button>
              <span>or</span>
              <button
                className="tails-button"
                onClick={() => placeBet(false)}
                disabled={isFlipping || !account}
              >
                Tails
              </button>
            </div>
          </div>

          <div className="coin-container">
            <div className={`coin ${isFlipping ? "flipping" : ""} ${coinResult ? coinResult : ""}`}>
              {/* Replace with your custom coin image */}
              <div className="coin-side heads"></div>
              <div className="coin-side tails"></div>
            </div>
          </div>

          {hasWon !== null && (
            <div className={`result ${hasWon ? "win" : "lose"}`}>
              <h3>{hasWon ? "You won!" : "Better luck next time!"}</h3>
              <p>
                {hasWon
                  ? `You won ${(parseFloat(betAmount) * 2).toFixed(2)} MON`
                  : `You lost ${calculateTotal()} MON`}
              </p>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="game-info">
            <div className="info-box">
              <h3>Your Winnings:</h3>
              <p>{account ? "0.00" : "Connect Wallet"}</p>
            </div>
          </div>

          <button
            className="withdraw-button"
            disabled={!account}
            onClick={refreshBalances}
          >
            Refresh
          </button>
        </div>
      </main>

      <footer>
        <p>© 2025 NadsFlip - A coin flip dApp on Monad Testnet</p>
        <a href={`https://testnet.monadexplorer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer">
          View Contract
        </a>
      </footer>
    </div>
  );
}

export default App;
