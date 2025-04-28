require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
}));
app.use(express.json());

// WebSocket setup
const wss = new WebSocket.Server({ server, clientTracking: true });
const PORT = process.env.PORT || 3001;
const clients = new Set();
const logPath = process.env.COWRIE_LOG_PATH || '/home/anand/cowrie/var/log/cowrie/cowrie.log';

// Blockchain components
let provider, wallet, contract;

// Initialize blockchain connection
async function initializeBlockchain() {
    try {
        // Validate environment variables
        const requiredEnvVars = ['SEPOLIA_RPC_URL', 'PRIVATE_KEY', 'CONTRACT_ADDRESS'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        // Initialize provider and wallet
        provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
        wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        // Load contract ABI
        const contractJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'blockchain', 'abi', 'LogStorage.json')));
        if (!contractJson.abi) throw new Error("ABI property not found in contract JSON");
        const ABI = contractJson.abi;

        // Initialize contract
        contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet);

        // Verify contract
        const code = await provider.getCode(process.env.CONTRACT_ADDRESS);
        if (code === '0x') throw new Error("No code at contract address");

        // Test contract connection
        await contract.getLogCount();

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
        if (line.includes('CMD')) {
            const cmdMatch = line.match(/CMD\s+\(([^)]+)\)\s+(.+)/);
            if (cmdMatch) {
                const [_, ip, command] = cmdMatch;
                return {
                    type: 'command',
                    ip: ip.trim(),
                    content: command.trim(),
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
                    ip: ip.trim(),
                    content: `Used credentials: ${credentials.trim()}`,
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
                    content: `Hash: ${hashMatch[1].trim()}`,
                    timestamp: new Date().toISOString(),
                    threatLevel: 'critical'
                };
            }
        }

        if (line.includes('File download')) {
            const downloadMatch = line.match(/File download.*?\((.*?)\)/);
            if (downloadMatch) {
                return {
                    type: 'download',
                    ip: 'N/A',
                    content: `Downloaded file: ${downloadMatch[1].trim()}`,
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
            client.send(message);
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
            Math.floor(new Date(logData.timestamp).getTime() / 1000)
        );
        const receipt = await tx.wait();
        return {
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            timestamp: new Date().toISOString()
        };
    } catch (err) {
        console.error('❌ Blockchain storage failed:', err);
        return {
            success: false,
            error: err.message
        };
    }
}

// Tail Cowrie log file for real-time processing
function tailCowrieLogs() {
    console.log(`👀 Starting to watch Cowrie logs at ${logPath}`);

    const tailProcess = exec(`tail -F ${logPath}`);

    tailProcess.stdout.on('data', async (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
            if (line.trim()) {
                const logEvent = processCowrieLog(line);
                if (logEvent) {
                    // Broadcast new log event
                    broadcastEvent({
                        event: 'new_log',
                        data: logEvent,
                        blockchainStatus: 'pending'
                    });

                    // Store on blockchain
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
                        } else {
                            broadcastEvent({
                                event: 'blockchain_error',
                                data: logEvent,
                                error: blockchainResult.error,
                                blockchainStatus: 'failed'
                            });
                        }
                    } catch (err) {
                        console.error('Error storing log on blockchain:', err);
                        broadcastEvent({
                            event: 'blockchain_error',
                            data: logEvent,
                            error: err.message,
                            blockchainStatus: 'failed'
                        });
                    }
                }
            }
        }
    });

    tailProcess.stderr.on('data', (data) => {
        console.error('Tail process error:', data.toString());
    });

    tailProcess.on('close', (code) => {
        console.error(`Tail process exited with code ${code}`);
        setTimeout(tailCowrieLogs, 5000); // Retry tailing if process closes unexpectedly
    });
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    console.log('New frontend connection from:', req.headers.origin);
    clients.add(ws);

    // Heartbeat mechanism
    const heartbeat = () => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    };

    ws.isAlive = true;
    const interval = setInterval(heartbeat, 30000);

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    // Message handler with error handling
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (!data.event) {
                throw new Error("Missing event type");
            }
            // Handle specific client messages here if needed
        } catch (err) {
            console.error('Invalid WebSocket message:', err);
            ws.send(JSON.stringify({
                event: 'error',
                error: 'Invalid message format',
                details: err.message
            }));
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

    // Send connection confirmation
    ws.send(JSON.stringify({
        event: 'connection_established',
        message: 'Connected to Cowrie log server',
        timestamp: new Date().toISOString()
    }));
});

// API Endpoints

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const network = await provider.getNetwork();
        res.status(200).json({
            status: 'healthy',
            clients: clients.size,
            network: {
                name: network.name,
                chainId: network.chainId
            },
            lastBlock: await provider.getBlockNumber(),
            contractAddress: contract.address,
            walletAddress: wallet.address
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy',
            error: error.message 
        });
    }
});

// Get logs from blockchain
app.get('/api/logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        
        const eventFilter = contract.filters.LogStored();
        const logs = await contract.queryFilter(eventFilter);
        
        // Process and paginate logs
        const reversedLogs = logs.reverse();
        const paginatedLogs = reversedLogs.slice((page - 1) * limit, page * limit);
        
        const parsedLogs = paginatedLogs.map(log => ({
            id: log.args.logId,
            ip: log.args.ip,
            command: log.args.command,
            content: log.args.command, // For backward compatibility
            threatLevel: log.args.threatLevel,
            timestamp: new Date(log.args.timestamp.toNumber() * 1000).toISOString(),
            txHash: log.transactionHash,
            type: determineTypeFromThreatLevel(log.args.threatLevel),
            blockchainStatus: 'confirmed'
        }));

        res.status(200).json({
            success: true,
            data: parsedLogs,
            pagination: {
                page,
                limit,
                total: logs.length,
                totalPages: Math.ceil(logs.length / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch logs',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Helper function to determine type from threat level
function determineTypeFromThreatLevel(threatLevel) {
    switch (threatLevel) {
        case 'critical': return 'login_attempt';
        case 'high': return 'command';
        case 'medium': return 'download';
        default: return 'other';
    }
}

// Authentication endpoints
app.get('/api/auth/verify', (req, res) => {
    res.status(200).json({ authenticated: true });
});

app.get('/auth/status', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Authenticated' });
});

// Start server
(async () => {
    const blockchainInitialized = await initializeBlockchain();
    if (blockchainInitialized) {
        server.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            tailCowrieLogs();
        });
    } else {
        console.error('❌ Server failed to start due to blockchain initialization failure');
        process.exit(1);
    }
})();

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});