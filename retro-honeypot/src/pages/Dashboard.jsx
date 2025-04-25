import { useEffect, useState } from 'react';
import { webSocketService } from '../services/websocket';
import { fetchInitialLogs } from '../services/api';

export default function Dashboard() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Fetch initial logs
    fetchInitialLogs().then(setLogs);

    // Subscribe to real-time updates
    const removeListener = webSocketService.addListener('new_log', (log) => {
      setLogs(prev => [log, ...prev.slice(0, 99)]); // Keep last 100 logs
    });

    return () => {
      removeListener();
    };
  }, []);

  return (
    <div className="dashboard">
      <h1>Security Logs</h1>
      <div className="logs-container">
        {logs.map((log, index) => (
          <div key={index} className={`log-item threat-${log.threatLevel}`}>
            <div className="log-timestamp">{new Date(log.timestamp).toLocaleString()}</div>
            <div className="log-ip">{log.ip}</div>
            <div className="log-command">{log.command}</div>
          </div>
        ))}
      </div>
    </div>
  );
}