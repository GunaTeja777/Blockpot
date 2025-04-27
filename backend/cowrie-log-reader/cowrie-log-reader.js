const fs = require('fs');
const readline = require('readline');
const EventEmitter = require('events');
const { exec } = require('child_process');

const emitter = new EventEmitter();
const logPath = process.env.COWRIE_LOG_PATH || '/home/anand/cowrie/var/log/cowrie/cowrie.log';

// Enhanced log parser with more event types
function parseCowrieLog(line) {
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

// More robust log tailing implementation
function tailLogs() {
    // Use tail -F for continuous monitoring
    const tailProcess = exec(`tail -F ${logPath}`);

    tailProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                const logEvent = parseCowrieLog(line);
                if (logEvent) {
                    emitter.emit('cowrie_log', logEvent);
                }
            }
        });
    });

    tailProcess.stderr.on('data', (data) => {
        console.error('Tail process error:', data.toString());
    });

    tailProcess.on('close', (code) => {
        console.error(`Tail process exited with code ${code}. Attempting to restart...`);
        setTimeout(tailLogs, 1000);
    });
}

// Initial log file check
fs.access(logPath, fs.constants.F_OK | fs.constants.R_OK, (err) => {
    if (err) {
        console.error(`Cannot access log file at ${logPath}:`, err);
        process.exit(1);
    }
    console.log(`Starting to monitor Cowrie logs at ${logPath}`);
    tailLogs();
});

module.exports = emitter;