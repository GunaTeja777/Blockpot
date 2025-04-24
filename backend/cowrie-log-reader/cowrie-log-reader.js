// cowrie-log-reader.js
const fs = require('fs');
const readline = require('readline');
const EventEmitter = require('events');

const emitter = new EventEmitter();
const logPath = '/home/anand/cowrie/var/log/cowrie/cowrie.log';

// Create a read stream for live log monitoring
const stream = fs.createReadStream(logPath, { encoding: 'utf8', flags: 'a+' });

const rl = readline.createInterface({
  input: stream,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
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
