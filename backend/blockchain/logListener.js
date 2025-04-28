require("dotenv").config();
const WebSocket = require("ws");
const { ethers } = require("ethers");
const fs = require("fs");

// Load ABI and contract address
const abiFile = require("/home/anand/Desktop/Blockpot/backend/blockchain/abi/LogStorage.json");
const abi = abiFile.abi;
const { address: contractAddress } = require("/home/anand/Desktop/Blockpot/backend/blockchain/contractAddress.json");

// Connect to blockchain provider (ethers v6 syntax)
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
// If you want local Hardhat instead, use:
// const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

let signer;
let contract;

async function init() {
  // Get signer using private key from environment variable
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ No PRIVATE_KEY found in .env file");
    return;
  }
  
  signer = new ethers.Wallet(privateKey, provider);
  contract = new ethers.Contract(contractAddress, abi, signer);
  console.log("✅ Connected to contract at", contractAddress);
}

// Create a WebSocket server for Cowrie to connect to
const server = new WebSocket.Server({ port: 8080 });
console.log("🌐 WebSocket server started on ws://127.0.0.1:8080");

server.on('connection', (ws) => {
  console.log('🔗 Cowrie connected to WebSocket server');
  
  ws.on('message', async (data) => {
    const log = data.toString();
    console.log("📥 Log received from Cowrie:", log);
    
    try {
      if (!contract) {
        console.log("⏳ Waiting for blockchain connection...");
        return;
      }
      
      const tx = await contract.storeLog(log);
      await tx.wait();
      console.log("✅ Log stored in blockchain:", tx.hash);
    } catch (err) {
      console.error("❌ Error storing log:", err.message);
    }
  });
  
  ws.on('close', () => {
    console.log('👋 Cowrie disconnected');
  });

  ws.on('error', (err) => {
    console.error('⚠️ WebSocket error:', err.message);
  });
});

init().catch((err) => {
  console.error("❌ Initialization error:", err.message);
});