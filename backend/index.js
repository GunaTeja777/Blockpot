require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const SERVER_PATH = path.join(__dirname, 'server.js');
const LOG_READER_PATH = path.join(__dirname, 'cowrie-log-reader', 'cowrie-log-reader.js');

// Check if required files exist
[SERVER_PATH, LOG_READER_PATH].forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Required file not found: ${filePath}`);
    process.exit(1);
  }
});

console.log('🚀 Starting Blockpot Honeypot Monitor');

// Start server
const serverProcess = spawn('node', [SERVER_PATH], { 
  stdio: 'inherit',
  env: { ...process.env }
});

serverProcess.on('error', (err) => {
  console.error('❌ Failed to start server:', err);
});

// We don't need to explicitly start the log reader as it's integrated with the server
console.log('✅ Server starting. Check for detailed logs above');

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down application...');
  serverProcess.kill();
  process.exit(0);
});

// Keep the process alive
process.stdin.resume();


//thanks for visiting