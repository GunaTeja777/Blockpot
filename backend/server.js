require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cors = require('cors');
const tail = require('tail-forever');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL, 
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// WebSocket Server
const wss = new WebSocket.Server({
  server,
  clientTracking: true,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    threshold: 1024,
    concurrencyLimit: 10
  }
});

const PORT = process.env.PORT || 3001;
const clients = new Set();
const logPath = process.env.COWRIE_LOG_PATH || '/home/anand/cowrie/var/log/cowrie/cowrie.log';

let provider, wallet, contract;

// Authentication Middleware
function authenticateToken(req, res, next) {
  const token = req.cookies?.token || req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Initialize blockchain connection
async function initializeBlockchain() {
    try {
        const contractPath = path.join(__dirname, 'blockchain', 'abi', 'LogStorage.json');
        if (!fs.existsSync(contractPath)) {
            throw new Error("Contract ABI file not found");
        }

        const contractJson = JSON.parse(fs.readFileSync(contractPath));
        if (!contractJson.abi) throw new Error("ABI property not found in contract JSON");

        const requiredEnvVars = [
            'SEPOLIA_RPC_URL',
            'PRIVATE_KEY',
            'CONTRACT_ADDRESS',
            'JWT_SECRET',
            'ADMIN_PASSWORD_HASH'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
        wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractJson.abi, wallet);

        const code = await provider.getCode(process.env.CONTRACT_ADDRESS);
        if (code === '0x') throw new Error("No code at contract address");

        console.log('✅ Blockchain components initialized');
        return true;
    } catch (err) {
        console.error('❌ Blockchain initialization failed:', err);
        return false;
    }
}

// Process Cowrie log lines
function processCowrieLog(line) {
    try {
        // Command processing
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

        // Login attempts
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

        // Password hashes
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

        // File downloads
        if (line.includes('File download')) {
            const downloadMatch = line.match(/File download.*?\((.*?)\)/);
            if (downloadMatch) {
                return {
                    type: 'download',
                    ip: 'N/A',
                    content: `Downloaded file: ${downloadMatch[1]}`,
                    timestamp: new Date().toISOString(),
                    threatLevel: 'medium'
                };
            }
        }
    } catch (err) {
        console.error('Error processing log line:', err);
    }
    return null;
}

// Broadcast events to all connected clients
function broadcastEvent(event) {
    const message = JSON.stringify(event);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message, (err) => {
                if (err) {
                    console.error('WebSocket send error:', err);
                    clients.delete(client);
                }
            });
        }
    });
}

// Store log on blockchain
async function storeOnBlockchain(logData) {
    try {
        const tx = await contract.storeLog(
            logData.ip || 'unknown',
            logData.content,
            logData.threatLevel,
            Math.floor(new Date(logData.timestamp).getTime() / 1000
        ));
        
        const receipt = await tx.wait();
        
        return {
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            timestamp: new Date().toISOString()
        };
    } catch (err) {
        console.error('❌ Blockchain storage failed:', err.message);
        return {
            success: false,
            error: err.message
        };
    }
}

// Tail Cowrie log file for real-time processing
function tailCowrieLogs() {
    console.log(`👀 Starting to watch Cowrie logs at ${logPath}`);
    
    const tail = new tail.Tail(logPath, { 
        interval: 500,
        fromBeginning: false 
    });

    tail.on('line', async (line) => {
        if (line.trim()) {
            const logEvent = processCowrieLog(line);
            if (logEvent) {
                broadcastEvent({
                    event: 'new_log',
                    data: logEvent,
                    blockchainStatus: 'pending'
                });

                try {
                    const blockchainResult = await storeOnBlockchain(logEvent);
                    if (blockchainResult.success) {
                        broadcastEvent({
                            event: 'blockchain_confirmation',
                            data: {
                                ...logEvent,
                                txHash: blockchainResult.txHash,
                                blockNumber: blockchainResult.blockNumber,
                                blockchainTimestamp: blockchainResult.timestamp
                            },
                            blockchainStatus: 'confirmed'
                        });
                    }
                } catch (err) {
                    console.error('Error storing log on blockchain:', err);
                    broadcastEvent({
                        event: 'blockchain_error',
                        data: {
                            ...logEvent,
                            error: err.message
                        },
                        blockchainStatus: 'failed'
                    });
                }
            }
        }
    });

    tail.on('error', (error) => {
        console.error('Tail error:', error);
        setTimeout(tailCowrieLogs, 5000);
    });
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    console.log('New frontend connection from:', req.headers.origin);
    clients.add(ws);

    // Heartbeat
    const heartbeat = () => {
        if (ws.isAlive === false) {
            console.log('Terminating unresponsive connection');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    };

    ws.isAlive = true;
    const interval = setInterval(heartbeat, 30000);

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'heartbeat') {
                ws.send(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }));
            }
        } catch (err) {
            console.error('Error processing client message:', err);
        }
    });

    ws.on('close', () => {
        clearInterval(interval);
        clients.delete(ws);
        console.log('Frontend disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });

    ws.send(JSON.stringify({
        event: 'connection_established',
        message: 'Connected to Cowrie log server',
        timestamp: new Date().toISOString(),
        clients: clients.size
    }));
});


// Authentication Endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const passwordMatch = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    }).json({ authenticated: true });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/status', authenticateToken, (req, res) => {
  res.json({ authenticated: true, user: req.user });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token').json({ authenticated: false });
});

// Protected API Endpoints
app.get('/api/logs', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const eventFilter = contract.filters.LogStored();
        const logs = await contract.queryFilter(eventFilter, -limit);
        
        const formattedLogs = logs.map(log => ({
            id: `${log.args.timestamp}-${log.transactionHash}`,
            type: log.args.command.includes('Used credentials') ? 'login_attempt' : 
                 log.args.command.includes('Hash:') ? 'hash_capture' :
                 log.args.command.includes('Downloaded file') ? 'download' : 'command',
            ip: log.args.ip,
            content: log.args.command,
            threatLevel: log.args.threatLevel,
            timestamp: new Date(log.args.timestamp * 1000).toISOString(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            blockchainStatus: 'confirmed'
        })).reverse();
        
        res.status(200).json(formattedLogs);
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            details: error.stack 
        });
    }
});

// [Keep all your existing WebSocket and server startup code]

// Start server
async function startServer() {
    console.log('Initializing server...');
    
    const blockchainInitialized = await initializeBlockchain();
    if (!blockchainInitialized) {
        console.error('Cannot start server without blockchain connection');
        process.exit(1);
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
        console.log(`📡 WebSocket server running on ws://0.0.0.0:${PORT}`);
        tailCowrieLogs();
    });

    server.on('error', (error) => {
        console.error('Server error:', error);
        process.exit(1);
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    wss.clients.forEach(client => client.close());
    wss.close();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

console.log("Environment Variables:");
console.log("SEPOLIA_RPC_URL:", process.env.SEPOLIA_RPC_URL ? "✅" : "❌");
console.log("CONTRACT_ADDRESS:", process.env.CONTRACT_ADDRESS ? "✅" : "❌");
console.log("COWRIE_LOG_PATH:", fs.existsSync(logPath) ? "✅" : "❌", logPath);

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});