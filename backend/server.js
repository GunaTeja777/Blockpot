require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { ethers } = require('ethers');
const fs = require('fs');
const cowrieEmitter = require('./cowrie-log-reader/cowrie-log-reader');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3001;

const clients = new Set();

let provider, wallet, contract;

async function initializeBlockchain() {
    try {
        const contractJson = JSON.parse(fs.readFileSync('./blockchain/abi/LogStorage.json'));
        if (!contractJson.abi) throw new Error("ABI property not found in contract JSON");

        const ABI = contractJson.abi;

        if (!process.env.SEPOLIA_RPC_URL || !process.env.PRIVATE_KEY || !process.env.CONTRACT_ADDRESS) {
            throw new Error("Missing required environment variables");
        }

        provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
        wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet);

        const code = await provider.getCode(process.env.CONTRACT_ADDRESS);
        if (code === '0x') throw new Error("No code at contract address");

        console.log('✅ Blockchain components initialized');
        return true;
    } catch (err) {
        console.error('❌ Blockchain initialization failed:', err);
        return false;
    }
}

// WebSocket connection
wss.on('connection', (ws) => {
    console.log('Frontend connected via WebSocket');
    clients.add(ws);

    ws.on('close', () => {
        clients.delete(ws);
        console.log('Frontend disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// LIVE Cowrie log listener
cowrieEmitter.on('cowrie_log', async ({ ip, command, threatLevel, timestamp }) => {
    const message = JSON.stringify({
        ip,
        command,
        threatLevel,
        timestamp,
        event: 'new_log'
    });

    // Broadcast to frontend
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });

    // Store on blockchain
    try {
        const tx = await contract.storeLog(ip, command, threatLevel, timestamp);
        const receipt = await tx.wait();
        console.log('✅ Stored on blockchain:', {
            txHash: tx.hash,
            blockNumber: receipt.blockNumber
        });
    } catch (err) {
        console.error('❌ Blockchain storage failed:', err.message);
    }
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const network = await provider.getNetwork();
        res.status(200).json({
            status: 'healthy',
            clients: clients.size,
            network: {
                name: network.name,
                chainId: network.chainId
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Add this near your other route handlers
app.get('/logs', async (req, res) => {
    try {
      const logs = await contract.getLogs(); // You'll need to implement this in your contract
      res.status(200).json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

// Start server
async function startServer() {
    const blockchainInitialized = await initializeBlockchain();
    if (!blockchainInitialized) {
        console.error('Cannot start server without blockchain connection');
        process.exit(1);
    }

    const network = await provider.getNetwork();

    server.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 Connected to ${network.name}`);
    });
}

console.log("PRIVATE_KEY:", process.env.PRIVATE_KEY ? "✅" : "❌");
console.log("SEPOLIA_RPC_URL:", process.env.SEPOLIA_RPC_URL ? "✅" : "❌");
console.log("CONTRACT_ADDRESS:", process.env.CONTRACT_ADDRESS ? "✅" : "❌");

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
