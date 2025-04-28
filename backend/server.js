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

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
}));

const wss = new WebSocket.Server({ server, clientTracking: true });
const PORT = process.env.PORT || 3001;
const clients = new Set();
const logPath = process.env.COWRIE_LOG_PATH || '/home/anand/cowrie/var/log/cowrie/cowrie.log';

let provider, wallet, contract;

// Initialize blockchain connection
async function initializeBlockchain() {
    try {
        // Ensure path exists before reading the file
        const abiPath = path.join(__dirname, 'blockchain', 'abi', 'LogStorage.json');
        
        if (!fs.existsSync(abiPath)) {
            throw new Error(`ABI file not found at: ${abiPath}`);
        }
        
        const contractJson = JSON.parse(fs.readFileSync(abiPath));
        if (!contractJson.abi) throw new Error("ABI property not found in contract JSON");

        const ABI = contractJson.abi;
        const requiredEnvVars = ['SEPOLIA_RPC_URL', 'PRIVATE_KEY', 'CONTRACT_ADDRESS'];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
        wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet);

        // Verify contract exists
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
        if (line.includes('CMD')) {
            const cmdMatch = line.match(/CMD\s+\(([^)]+)\)\s+(.+)/);
            if (cmdMatch) {
                const [_, ip, command] = cmdMatch;
                return {
                    type: 'command',
                    ip,
                    content: command,
                    timestamp: new Date().toISOString(),
                    threatLevel: command.trim() === 'sudo su' ? 'critical' : 'high'
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
            try {
                client.send(message);
            } catch (err) {
                console.error('Error sending message to client:', err);
                clients.delete(client);
            }
        }
    });
}

// Store log on blockchain
async function storeOnBlockchain(logData) {
    try {
        if (!contract) {
            throw new Error("Blockchain contract not initialized");
        }
        
        const tx = await contract.storeLog(
            logData.ip || 'unknown',
            logData.content,
            logData.threatLevel,
            Math.floor(new Date(logData.timestamp).getTime() / 1000)
        );
        console.log('Transaction sent:', tx.hash);
        
        const receipt = await tx.wait();
        console.log('Transaction confirmed in block:', receipt.blockNumber);
        
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

    // Check if the log file exists first
    if (!fs.existsSync(logPath)) {
        console.error(`❌ Log file does not exist at ${logPath}`);
        return;
    }

    const tailProcess = exec(`tail -F ${logPath}`);

    tailProcess.stdout.on('data', async (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
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
                        } else {
                            broadcastEvent({
                                event: 'blockchain_error',
                                data: {
                                    ...logEvent,
                                    error: blockchainResult.error
                                },
                                blockchainStatus: 'failed'
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

    ws.on('close', () => {
        clearInterval(interval);
        clients.delete(ws);
        console.log('Frontend disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });

    try {
        ws.send(JSON.stringify({
            event: 'connection_established',
            message: 'Connected to Cowrie log server',
            timestamp: new Date().toISOString()
        }));
    } catch (err) {
        console.error('Error sending initial message to client:', err);
    }
});

// ✅ API Endpoints

// Health check
app.get('/api/health', async (req, res) => {
    try {
        if (!provider) {
            return res.status(503).json({
                status: 'unhealthy',
                message: 'Blockchain provider not initialized'
            });
        }
        
        const network = await provider.getNetwork();
        res.status(200).json({
            status: 'healthy',
            clients: clients.size,
            network: {
                name: network.name,
                chainId: network.chainId
            },
            lastBlock: await provider.getBlockNumber()
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

// Get logs (fetch events from blockchain)
app.get('/api/logs', async (req, res) => {
    try {
        if (!contract) {
            return res.status(503).json({ 
                error: "Blockchain connection not initialized" 
            });
        }
        
        console.log('Fetching logs from blockchain...');
        
        const eventFilter = contract.filters.LogStored();
        let logs;
        
        try {
            logs = await contract.queryFilter(eventFilter);
            console.log(`Found ${logs.length} logs`);
        } catch (err) {
            console.error("Error querying logs:", err);
            throw new Error(`Failed to query logs: ${err.message}`);
        }
            
        const parsedLogs = logs.map(log => {
            try {
                // Safer timestamp conversion
                let timestamp;
                try {
                    // First, ensure we have a number regardless of how it's stored
                    let timestampValue;
                    
                    if (typeof log.args.timestamp === 'object' && log.args.timestamp !== null) {
                        // Handle BigNumber objects from ethers v5
                        if (typeof log.args.timestamp.toNumber === 'function') {
                            timestampValue = log.args.timestamp.toNumber();
                        } 
                        // Handle BigInt objects from ethers v6
                        else if (typeof log.args.timestamp.toString === 'function') {
                            timestampValue = Number(log.args.timestamp.toString());
                        }
                        else {
                            // If it's some other object type, try to convert it
                            timestampValue = Number(log.args.timestamp);
                        }
                    } else {
                        // Handle primitive types
                        timestampValue = Number(log.args.timestamp);
                    }
                    
                    // Create date from timestamp (multiply by 1000 to convert seconds to milliseconds)
                    timestamp = new Date(timestampValue * 1000).toISOString();
                } catch (timestampErr) {
                    console.error("Timestamp conversion error:", timestampErr, "Raw value:", log.args.timestamp);
                    timestamp = new Date().toISOString(); // Fallback to current time
                }

                return {
                    ip: log.args.ip,
                    content: log.args.command,
                    threatLevel: log.args.threatLevel,
                    timestamp: timestamp,
                    txHash: log.transactionHash,
                    logId: log.args.logId.toString() // Ensure logId is string
                };
            } catch (err) {
                console.error("Error parsing log:", err);
                console.error("Problem log:", JSON.stringify(log, (key, value) => 
                    typeof value === 'bigint' ? value.toString() : value
                ));
                return null;
            }
        }).filter(log => log !== null);
        
        res.status(200).json(parsedLogs);
    } catch (error) {
        console.error("API logs error:", error);
        res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
// ✅ Add this route to fix your 404: /api/auth/verify
app.get('/api/auth/verify', (req, res) => {
    // You can enhance this logic with sessions or JWT later
    res.status(200).json({ authenticated: true });
});
// Add this route for /auth/status
app.get('/auth/status', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Authenticated' });
});

// Start server
(async () => {
    const blockchainInitialized = await initializeBlockchain();
    if (blockchainInitialized) {
        server.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            tailCowrieLogs(); // Start tailing the logs only after the blockchain is initialized
        });
    } else {
        console.error('❌ Server failed to start due to blockchain initialization failure');
        // Start server anyway to show errors in UI
        server.listen(PORT, () => {
            console.log(`🚨 Server running in LIMITED MODE on http://localhost:${PORT}`);
            console.log('⚠️ Blockchain functionality is disabled');
        });
    }
})();