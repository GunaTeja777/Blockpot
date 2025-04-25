require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cors = require('cors');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Enhanced CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable preflight for all routes

// WebSocket Server
const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    threshold: 1024
  }
});

const PORT = process.env.PORT || 3001;
const clients = new Set();
const logPath = process.env.COWRIE_LOG_PATH || '/home/cowrie/cowrie/var/log/cowrie/cowrie.log';

let provider, wallet, contract;

// Initialize blockchain connection
async function initializeBlockchain() {
  try {
    const contractJson = JSON.parse(fs.readFileSync(
      path.join(__dirname, 'blockchain', 'abi', 'LogStorage.json')
    ));
    
    if (!contractJson.abi) throw new Error("ABI not found");
    
    const requiredVars = ['SEPOLIA_RPC_URL', 'PRIVATE_KEY', 'CONTRACT_ADDRESS'];
    const missingVars = requiredVars.filter(v => !process.env[v]);
    
    if (missingVars.length) {
      throw new Error(`Missing: ${missingVars.join(', ')}`);
    }

    provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractJson.abi, wallet);

    const code = await provider.getCode(process.env.CONTRACT_ADDRESS);
    if (code === '0x') throw new Error("Contract not deployed");

    console.log('✅ Blockchain initialized');
    return true;
  } catch (err) {
    console.error('❌ Blockchain init failed:', err);
    return false;
  }
}

// Process log lines
function processCowrieLog(line) {
  try {
    if (line.includes('CMD')) {
      const cmdMatch = line.match(/CMD\s+\(([^)]+)\)\s+(.+)/);
      if (cmdMatch) {
        const [_, ip, command] = cmdMatch;
        return {
          type: 'command',
          ip,
          content: command,
          timestamp: new Date().toISOString(),
          threatLevel: 'high'
        };
      }
    }

    if (line.includes('login attempt')) {
      const loginMatch = line.match(/(\d+\.\d+\.\d+\.\d+).*?login attempt.*?\[(.*?)\]/);
      if (loginMatch) {
        const [_, ip, credentials] = loginMatch;
        return {
          type: 'login_attempt',
          ip,
          content: `Used credentials: ${credentials}`,
          timestamp: new Date().toISOString(),
          threatLevel: 'critical'
        };
      }
    }

    if (line.includes('Password found:')) {
      const hashMatch = line.match(/Password found: '(.*?)'/);
      if (hashMatch) {
        return {
          type: 'hash_capture',
          ip: 'N/A',
          content: `Hash: ${hashMatch[1]}`,
          timestamp: new Date().toISOString(),
          threatLevel: 'critical'
        };
      }
    }
  } catch (err) {
    console.error('Log processing error:', err);
  }
  return null;
}

// Broadcast to all clients
function broadcast(event, data) {
  const message = JSON.stringify({ event, data });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Store on blockchain
async function storeOnBlockchain(logData) {
  try {
    const tx = await contract.storeLog(
      logData.ip || 'unknown',
      logData.content,
      logData.threatLevel,
      Math.floor(Date.now() / 1000)
    );
    const receipt = await tx.wait();
    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };
  } catch (err) {
    console.error('Blockchain store failed:', err);
    return { success: false, error: err.message };
  }
}

// Tail logs
function tailCowrieLogs() {
  const tailProcess = exec(`tail -F ${logPath}`);
  
  tailProcess.stdout.on('data', async data => {
    data.toString().split('\n').forEach(async line => {
      const logEvent = processCowrieLog(line);
      if (logEvent) {
        broadcast('new_log', logEvent);
        const result = await storeOnBlockchain(logEvent);
        if (result.success) {
          broadcast('blockchain_confirmation', {
            ...logEvent,
            txHash: result.txHash,
            blockNumber: result.blockNumber
          });
        }
      }
    });
  });

  tailProcess.on('exit', code => {
    console.log(`Tail process exited (${code}), restarting...`);
    setTimeout(tailCowrieLogs, 1000);
  });
}

// WebSocket connection
wss.on('connection', (ws, req) => {
  console.log('New connection from:', req.headers.origin);
  clients.add(ws);

  // Heartbeat
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  const interval = setInterval(() => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  }, 30000);

  ws.on('close', () => {
    clearInterval(interval);
    clients.delete(ws);
  });

  ws.on('error', err => {
    console.error('WS error:', err);
    clients.delete(ws);
  });

  ws.send(JSON.stringify({
    event: 'connected',
    timestamp: new Date().toISOString()
  }));
});

// API Endpoints
aapp.get('/health', async (req, res) => {
    try {
      const network = await provider.getNetwork();
      res.json({
        status: 'ok',
        network: network.name,
        chainId: network.chainId,
        blockNumber: await provider.getBlockNumber()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.get('/logs', async (req, res) => {
    try {
      const logs = await contract.queryFilter('LogStored', -1000);
      res.json(logs.map(log => ({
        id: log.transactionHash,
        type: log.args.command.includes('Used credentials') ? 'login_attempt' : 'command',
        ip: log.args.ip,
        content: log.args.command,
        timestamp: new Date(log.args.timestamp * 1000).toISOString(),
        txHash: log.transactionHash
      })).reverse());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Example of a properly parameterized route
  app.get('/logs/:txHash', async (req, res) => {
    try {
      const log = await contract.queryFilter(
        contract.filters.LogStored(null, null, null, null, req.params.txHash)
      );
      res.json(log);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
// Start server
async function startServer() {
  if (!await initializeBlockchain()) {
    process.exit(1);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    tailCowrieLogs();
  });
}

startServer().catch(err => {
  console.error('Server failed:', err);
  process.exit(1);
});