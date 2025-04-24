// cowrie-log-reader.js
const fs = require('fs');
const readline = require('readline');
const EventEmitter = require('events');
const emitter = new EventEmitter();

const logPath = '/path/to/cowrie/log/cowrie.log'; // Replace with actual path

const rl = readline.createInterface({
  input: fs.createReadStream(logPath),
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  // Example Cowrie log line to match: CMD (192.168.0.1) ls -la
  if (line.includes('CMD')) {
    const match = line.match(/CMD\s+\(([^)]+)\)\s+(.+)/);
    if (match) {
      const [_, ip, command] = match;
      emitter.emit('cowrie_log', {
        ip,
        command,
        timestamp: new Date().toISOString(),
        threatLevel: 'high',
      });
    }
  }
});

module.exports = emitter;