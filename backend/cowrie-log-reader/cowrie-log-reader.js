const fs = require('fs');
const readline = require('readline');
const EventEmitter = require('events');
const emitter = new EventEmitter();

const logPath = '/home/anand/cowrie/var/log/cowrie/cowrie.log';

const rl = readline.createInterface({
  input: fs.createReadStream(logPath),
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  if (line.includes('CMD')) {
    const match = line.match(/CMD\s+\(([^)]+)\)\s+(.+)/);
    if (match) {
      const [_, ip, command] = match;
      const logEvent = {
        ip,
        command,
        timestamp: new Date().toISOString(),
        threatLevel: 'high',
      };

      console.log('Detected Cowrie log event:', logEvent); // ✅ Add this line
      emitter.emit('cowrie_log', logEvent);
    }
  }
});

module.exports = emitter;
