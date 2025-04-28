const fs = require('fs');
const readline = require('readline');
const EventEmitter = require('events');
const { exec } = require('child_process');
const WebSocket = require('ws');

class CowrieLogReader extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logPath = options.logPath || process.env.COWRIE_LOG_PATH || '/home/anand/cowrie/var/log/cowrie/cowrie.log';
    this.tailProcess = null;
    this.ws = null;
    this.wsUrl = options.wsUrl || 'ws://localhost:8080';
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.shouldReconnect = true;

    // Validate log path exists
    this.checkLogFile();
  }

  checkLogFile() {
    try {
      fs.accessSync(this.logPath, fs.constants.F_OK | fs.constants.R_OK);
      console.log(`✅ Log file accessible at ${this.logPath}`);
    } catch (err) {
      console.error(`❌ Cannot access log file at ${this.logPath}:`, err.message);
      throw new Error(`Log file not accessible: ${err.message}`);
    }
  }

  // Parse log lines
  parseCowrieLog(line) {
    try {
        const timestamp = new Date().toISOString();
        
        // Command execution
        if (line.includes('CMD')) {
            const cmdMatch = line.match(/CMD\s+\(([^)]+)\)\s+(.+)/);
            if (cmdMatch) {
                const [_, ip, command] = cmdMatch;
                return {
                    event: 'command',
                    ip,
                    content: command,
                    timestamp,
                    threatLevel: command.trim() === 'sudo su' ? 'critical' : 'high'
                };
            }
        }

        // Login attempts
        if (line.includes('login attempt')) {
            const loginMatch = line.match(/(\d+\.\d+\.\d+\.\d+).*?login attempt.*?\[(.*?)\]/);
            if (loginMatch) {
                const [_, ip, credentials] = loginMatch;
                return {
                    event: 'login_attempt',
                    ip,
                    content: `Used credentials: ${credentials}`,
                    timestamp,
                    threatLevel: 'critical'
                };
            }
        }

        // Password hashes found
        if (line.includes('Password found:')) {
            const hashMatch = line.match(/Password found: '(.*?)'/);
            if (hashMatch) {
                return {
                    event: 'hash_capture',
                    ip: 'N/A',
                    content: `Hash: ${hashMatch[1]}`,
                    timestamp,
                    threatLevel: 'critical'
                };
            }
        }

        // File downloads
        if (line.includes('File download')) {
            const downloadMatch = line.match(/File download.*?\((.*?)\)/);
            if (downloadMatch) {
                return {
                    event: 'file_download',
                    ip: 'N/A',
                    content: `Downloaded file: ${downloadMatch[1]}`,
                    timestamp,
                    threatLevel: 'medium'
                };
            }
        }

        // SSH connections
        if (line.includes('New connection')) {
            const connMatch = line.match(/(\d+\.\d+\.\d+\.\d+):\d+.*?New connection/);
            if (connMatch) {
                return {
                    event: 'new_connection',
                    ip: connMatch[1],
                    content: 'New SSH connection',
                    timestamp,
                    threatLevel: 'low'
                };
            }
        }

        // Terminal interactions
        if (line.includes('Terminal size')) {
            const termMatch = line.match(/(\d+\.\d+\.\d+\.\d+).*?Terminal size (\d+)x(\d+)/);
            if (termMatch) {
                return {
                    event: 'terminal_interaction',
                    ip: termMatch[1],
                    content: `Terminal size: ${termMatch[2]}x${termMatch[3]}`,
                    timestamp,
                    threatLevel: 'low'
                };
            }
        }

    } catch (err) {
        console.error('Error parsing log line:', err);
    }
    return null;
  }

  // Connect to the WebSocket server (for integration with blockchain)
  connectWebSocket() {
    try {
      console.log(`Connecting to WebSocket server at ${this.wsUrl}...`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('✅ Connected to WebSocket server');
      });

      this.ws.on('message', (data) => {
        try {
          const response = JSON.parse(data);
          console.log('WebSocket message received:', response);
          
          // Process server responses if needed
          if (response.status === "stored") {
            console.log(`Log stored on blockchain. TX: ${response.txHash}, Block: ${response.blockNumber}`);
          }
        } catch (err) {
          console.error('Failed to process WebSocket message:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
      });

      this.ws.on('close', () => {
        console.log('WebSocket connection closed');
        
        if (this.shouldReconnect) {
          console.log(`Will attempt to reconnect in ${this.reconnectInterval/1000} seconds...`);
          setTimeout(() => this.connectWebSocket(), this.reconnectInterval);
        }
      });
    } catch (err) {
      console.error('Failed to connect to WebSocket server:', err);
      if (this.shouldReconnect) {
        setTimeout(() => this.connectWebSocket(), this.reconnectInterval);
      }
    }
  }

  // Send log to WebSocket server
  sendToWebSocket(logData) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(logData));
      } catch (err) {
        console.error('Failed to send log to WebSocket server:', err);
      }
    } else {
      console.warn('WebSocket not connected, cannot send log');
    }
  }

  // Start monitoring logs
  startMonitoring() {
    console.log(`Starting to monitor Cowrie logs at ${this.logPath}`);
    
    // Connect to WebSocket server first
    this.connectWebSocket();
    
    // Then start monitoring logs
    this.tailLogs();
  }

  // Tail the log file for real-time updates
  tailLogs() {
    try {
      this.tailProcess = exec(`tail -F ${this.logPath}`);

      this.tailProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            const logEvent = this.parseCowrieLog(line);
            if (logEvent) {
              // Emit the event locally
              this.emit('cowrie_log', logEvent);
              
              // Also send to WebSocket server if connected
              this.sendToWebSocket(logEvent);
            }
          }
        });
      });

      this.tailProcess.stderr.on('data', (data) => {
        console.error('Tail process error:', data.toString());
      });

      this.tailProcess.on('close', (code) => {
        console.error(`Tail process exited with code ${code}. Attempting to restart...`);
        setTimeout(() => this.tailLogs(), 1000);
      });
    } catch (err) {
      console.error('Failed to start tail process:', err);
      setTimeout(() => this.tailLogs(), 5000);
    }
  }

  // Stop monitoring
  stop() {
    console.log('Stopping Cowrie log monitoring...');
    this.shouldReconnect = false;
    
    if (this.tailProcess) {
      this.tailProcess.kill();
    }
    
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Create and export instance
const reader = new CowrieLogReader();

// Auto-start if this module is run directly (not imported)
if (require.main === module) {
  reader.startMonitoring();
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Shutting down...');
    reader.stop();
    process.exit(0);
  });
}

module.exports = reader;