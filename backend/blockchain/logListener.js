require("dotenv").config();
const WebSocket = require("ws");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Load ABI and contract address
const abiPath = path.join(__dirname, "abi", "LogStorage.json");

// Check if ABI file exists
if (!fs.existsSync(abiPath)) {
  console.error(`❌ ABI file not found at ${abiPath}`);
  process.exit(1);
}

const abiFile = require(abiPath);
const abi = abiFile.abi;

// Check if contractAddress.json exists
const contractAddressPath = path.join(__dirname, "contractAddress.json");
if (!fs.existsSync(contractAddressPath)) {
  console.error(`❌ Contract address file not found at ${contractAddressPath}`);
  process.exit(1);
}

const { address: contractAddress } = require(contractAddressPath);

// Connect to blockchain provider
let provider;
let signer;
let contract;

async function init() {
  try {
    // Get configuration from environment
    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;

    if (!rpcUrl) {
      throw new Error("No SEPOLIA_RPC_URL found in .env file");
    }

    if (!privateKey) {
      throw new Error("No PRIVATE_KEY found in .env file");
    }

    // Initialize provider
    provider = new ethers.JsonRpcProvider(rpcUrl);
    console.log("✅ Connected to RPC provider");

    // Test provider connection
    const blockNumber = await provider.getBlockNumber()
      .catch(err => {
        throw new Error(`RPC connection failed: ${err.message}`);
      });
    console.log(`✅ Connected to blockchain. Current block: ${blockNumber}`);

    // Initialize signer and contract
    signer = new ethers.Wallet(privateKey, provider);
    console.log(`✅ Wallet initialized: ${signer.address}`);

    contract = new ethers.Contract(contractAddress, abi, signer);
    
    // Verify contract exists
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
      throw new Error(`No contract deployed at address ${contractAddress}`);
    }
    
    console.log(`✅ Connected to contract at ${contractAddress}`);
    
    // Test contract
    const logCount = await contract.getLogCount()
      .catch(err => {
        throw new Error(`Contract interaction failed: ${err.message}`);
      });
    console.log(`✅ Contract working. Current log count: ${logCount}`);
  } catch (error) {
    console.error(`❌ Initialization error: ${error.message}`);
    process.exit(1);
  }
}

// Create a WebSocket server for Cowrie to connect to
const server = new WebSocket.Server({ port: 8080 });
console.log("🌐 WebSocket server started on ws://127.0.0.1:8080");

server.on('connection', (ws) => {
  console.log('🔗 Cowrie connected to WebSocket server');
  
  ws.on('message', async (data) => {
    try {
      const log = data.toString();
      console.log("📥 Log received from Cowrie:", log);
      
      if (!contract) {
        console.log("⏳ Blockchain connection not ready. Waiting for initialization...");
        // Queue logs or implement retry mechanism here if needed
        return;
      }
      
      // Parse the log to extract IP and command if available
      let ip = "unknown";
      let command = log;
      let threatLevel = "low";
      
      // Simple parsing logic - enhance based on your log format
      if (log.includes("CMD")) {
        const match = log.match(/CMD\s+\(([^)]+)\)\s+(.+)/);
        if (match) {
          ip = match[1];
          command = match[2];
          threatLevel = command.includes("sudo") ? "critical" : "high";
        }
      }
      
      console.log(`Storing log: IP=${ip}, Command=${command}, ThreatLevel=${threatLevel}`);
      
      // Store log in blockchain
      const tx = await contract.storeLog(
        ip,
        command,
        threatLevel,
        Math.floor(Date.now() / 1000)
      );
      
      console.log("Transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Log stored in blockchain. Block:", receipt.blockNumber, "TX:", tx.hash);
      
      // Send confirmation back to client if needed
      ws.send(JSON.stringify({
        status: "stored",
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      }));
      
    } catch (err) {
      console.error("❌ Error processing log:", err.message);
      
      // Send error to client
      try {
        ws.send(JSON.stringify({
          status: "error",
          message: err.message
        }));
      } catch (sendError) {
        console.error("Failed to send error to client:", sendError);
      }
    }
  });
  
  ws.on('close', () => {
    console.log('👋 Cowrie disconnected');
  });
  
  ws.on('error', (err) => {
    console.error('⚠️ WebSocket error:', err.message);
  });
});

// Initialize and catch any errors
init().catch((err) => {
  console.error("❌ Fatal initialization error:", err.message);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  server.close();
  process.exit(0);
});