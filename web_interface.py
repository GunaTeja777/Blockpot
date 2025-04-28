from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO
import threading
import time
import os
import sys

# Import the monitoring script
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from command_monitor import start_monitoring

app = Flask(__name__)
app.config['SECRET_KEY'] = 'blockpot-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Monitoring configuration
LOG_FILE = '/home/guna-teja/cowrie/var/log/cowrie/cowrie.json'
MODEL_PATH = '/home/guna-teja/Desktop/hackathonX/blockPot-AI/trained_command_classifier'

# Start the monitoring process
processor, observer = start_monitoring(LOG_FILE, MODEL_PATH)

@app.route('/')
def index():
    """Render the main dashboard page"""
    return render_template('index.html')

@app.route('/api/commands')
def get_commands():
    """API endpoint to get the latest commands"""
    commands = processor.get_latest_commands()
    return jsonify(commands)

def background_thread():
    """Background thread that sends new command data to clients"""
    last_count = 0
    while True:
        commands = processor.get_latest_commands()
        current_count = len(commands)
        
        # If we have new commands, emit them
        if current_count > last_count:
            socketio.emit('new_commands', 
                          {'commands': commands[last_count:current_count]})
            last_count = current_count
        
        # Sleep for a short time
        socketio.sleep(1)

@socketio.on('connect')
def handle_connect():
    """Handle client connections"""
    # Start the background thread when the first client connects
    if not app.config.get('thread_running', False):
        app.config['thread_running'] = True
        thread = threading.Thread(target=background_thread)
        thread.daemon = True
        thread.start()

if __name__ == '__main__':
    # Create templates directory if it doesn't exist
    os.makedirs('templates', exist_ok=True)
    
    # Create the HTML template
    with open('templates/index.html', 'w') as f:
        f.write('''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BlockPot AI - Command Monitor</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            padding-top: 20px;
            background-color: #f8f9fa;
        }
        .command-card {
            margin-bottom: 15px;
            border-left: 5px solid #ccc;
            transition: all 0.3s ease;
        }
        .command-card.malicious {
            border-left-color: #dc3545;
        }
        .command-card.suspicious {
            border-left-color: #ffc107;
        }
        .command-card.safe {
            border-left-color: #28a745;
        }
        .command-card.new {
            animation: highlight 2s ease;
        }
        .command-text {
            font-family: monospace;
            padding: 5px;
            background-color: #f1f1f1;
            border-radius: 3px;
        }
        .risk-meter {
            height: 10px;
            border-radius: 5px;
            background: linear-gradient(to right, #28a745, #ffc107, #dc3545);
        }
        .risk-indicator {
            position: relative;
            width: 10px;
            height: 10px;
            background-color: #000;
            border-radius: 50%;
            top: -5px;
        }
        @keyframes highlight {
            0% { background-color: rgba(255, 255, 0, 0.5); }
            100% { background-color: transparent; }
        }
        .dashboard-header {
            background-color: #343a40;
            color: white;
            padding: 15px 0;
            margin-bottom: 20px;
        }
        .stats-card {
            text-align: center;
            margin-bottom: 20px;
        }
        .stats-number {
            font-size: 2rem;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="dashboard-header">
        <div class="container">
            <div class="row">
                <div class="col-md-6">
                    <h1>BlockPot AI - Command Monitor</h1>
                    <p>Real-time honeypot command analysis and threat detection</p>
                </div>
                <div class="col-md-6 text-end">
                    <span id="connection-status" class="badge bg-success">Connected</span>
                    <span id="last-update" class="ms-3"></span>
                </div>
            </div>
        </div>
    </div>

    <div class="container">
        <!-- Stats Row -->
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="card-body">
                        <h5>Total Commands</h5>
                        <div id="total-commands" class="stats-number">0</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="card-body">
                        <h5>Malicious</h5>
                        <div id="malicious-commands" class="stats-number text-danger">0</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="card-body">
                        <h5>Suspicious</h5>
                        <div id="suspicious-commands" class="stats-number text-warning">0</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="card-body">
                        <h5>Safe</h5>
                        <div id="safe-commands" class="stats-number text-success">0</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="row">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h5>Detected Commands</h5>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="auto-scroll" checked>
                            <label class="form-check-label" for="auto-scroll">Auto-scroll</label>
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="commands-container"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.5.1/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Connect to Socket.IO server
        const socket = io();
        
        // Stats counters
        let stats = {
            total: 0,
            malicious: 0,
            suspicious: 0,
            safe: 0
        };

        // Connection status handling
        socket.on('connect', () => {
            document.getElementById('connection-status').className = 'badge bg-success';
            document.getElementById('connection-status').textContent = 'Connected';
        });

        socket.on('disconnect', () => {
            document.getElementById('connection-status').className = 'badge bg-danger';
            document.getElementById('connection-status').textContent = 'Disconnected';
        });

        // Handle new commands
        socket.on('new_commands', (data) => {
            const commands = data.commands;
            for (const cmd of commands) {
                addCommandCard(cmd);
                
                // Update stats
                stats.total++;
                if (cmd.ml_classification === 'malicious') {
                    stats.malicious++;
                } else if (cmd.ml_classification === 'suspicious') {
                    stats.suspicious++;
                } else {
                    stats.safe++;
                }
            }
            
            // Update stats display
            updateStats();
            
            // Update last update time
            const now = new Date();
            document.getElementById('last-update').textContent = 
                `Last update: ${now.toLocaleTimeString()}`;
                
            // Auto-scroll if enabled
            if (document.getElementById('auto-scroll').checked) {
                const container = document.getElementById('commands-container');
                container.scrollTop = container.scrollHeight;
            }
        });

        // Function to add a command card to the display
        function addCommandCard(cmd) {
            const container = document.getElementById('commands-container');
            
            const card = document.createElement('div');
            card.className = `card command-card ${cmd.ml_classification} new`;
            
            // Format timestamp
            const timestamp = new Date(cmd.timestamp).toLocaleString();
            
            // Create card content
            card.innerHTML = `
                <div class="card-header d-flex justify-content-between">
                    <span>Session: ${cmd.session} | IP: ${cmd.src_ip}</span>
                    <span>${timestamp}</span>
                </div>
                <div class="card-body">
                    <div class="command-text mb-3">${escapeHtml(cmd.command)}</div>
                    <div class="row">
                        <div class="col-md-6">
                            <h6>ML Model Analysis</h6>
                            <p>Classification: <span class="badge ${getBadgeClass(cmd.ml_classification)}">${cmd.ml_classification}</span></p>
                            <p>Confidence: ${(cmd.ml_confidence * 100).toFixed(2)}%</p>
                            <div class="small">
                                <div>Safe: ${(cmd.ml_probabilities.safe * 100).toFixed(2)}%</div>
                                <div>Suspicious: ${(cmd.ml_probabilities.suspicious * 100).toFixed(2)}%</div>
                                <div>Malicious: ${(cmd.ml_probabilities.malicious * 100).toFixed(2)}%</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <h6>NLP Analysis</h6>
                            <p>Intent: <span class="badge ${getIntentBadgeClass(cmd.intent)}">${cmd.intent}</span></p>
                            <p>Risk Score: ${cmd.risk_score.toFixed(2)}/10</p>
                            <div class="risk-meter">
                                <div class="risk-indicator" style="left: ${cmd.risk_score * 10}%"></div>
                            </div>
                            <p class="mt-2">Actions: ${cmd.actions.join(', ') || 'None'}</p>
                        </div>
                    </div>
                </div>
            `;
            
            // Add to container
            container.appendChild(card);
            
            // Remove highlight after animation ends
            setTimeout(() => {
                card.classList.remove('new');
            }, 2000);
        }
        
        // Function to update stats display
        function updateStats() {
            document.getElementById('total-commands').textContent = stats.total;
            document.getElementById('malicious-commands').textContent = stats.malicious;
            document.getElementById('suspicious-commands').textContent = stats.suspicious;
            document.getElementById('safe-commands').textContent = stats.safe;
        }
        
        // Helper function to get badge class based on classification
        function getBadgeClass(classification) {
            switch(classification) {
                case 'malicious': return 'bg-danger';
                case 'suspicious': return 'bg-warning text-dark';
                case 'safe': return 'bg-success';
                default: return 'bg-secondary';
            }
        }
        
        // Helper function to get badge class based on intent
        function getIntentBadgeClass(intent) {
            switch(intent) {
                case 'attack': return 'bg-danger';
                case 'reconnaissance': return 'bg-warning text-dark';
                case 'exploration': return 'bg-info text-dark';
                case 'informational': return 'bg-success';
                default: return 'bg-secondary';
            }
        }
        
        // Helper function to escape HTML
        function escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
        
        // Load initial commands
        fetch('/api/commands')
            .then(response => response.json())
            .then(commands => {
                for (const cmd of commands) {
                    addCommandCard(cmd);
                    
                    // Update stats
                    stats.total++;
                    if (cmd.ml_classification === 'malicious') {
                        stats.malicious++;
                    } else if (cmd.ml_classification === 'suspicious') {
                        stats.suspicious++;
                    } else {
                        stats.safe++;
                    }
                }
                
                // Update stats display
                updateStats();
                
                // Update last update time
                const now = new Date();
                document.getElementById('last-update').textContent = 
                    `Last update: ${now.toLocaleTimeString()}`;
            });
    </script>
</body>
</html>''')
    
    # Start the Flask app
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
