import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { webSocketService } from './services/websocket';
import { fetchLogs, checkHealth } from './services/api';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Terminal from './components/Terminal';
import NotFound from './pages/NotFound';

function AppWrapper() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

function App() {
  const [logs, setLogs] = useState([]);
  const [connection, setConnection] = useState('disconnected');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize connection
    webSocketService.connect();
    
    // Setup listeners
    const listeners = [
      webSocketService.addListener('connection', ({ status }) => {
        setConnection(status);
        if (status === 'connected') {
          fetchInitialLogs();
        }
      }),
      
      webSocketService.addListener('new_log', (log) => {
        setLogs(prev => [log, ...prev.slice(0, 99)]);
      }),
      
      webSocketService.addListener('error', (err) => {
        setError(err.message || 'WebSocket error');
      })
    ];

    // Initial data load
    const fetchInitialLogs = async () => {
      try {
        const initialLogs = await fetchLogs();
        setLogs(initialLogs);
      } catch (err) {
        setError('Failed to load initial logs');
      }
    };

    // Check health on startup
    checkHealth().catch(err => {
      setError('Backend unavailable');
    });

    return () => {
      listeners.forEach(remove => remove());
    };
  }, [navigate]);

  return (
    <div className="app">
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      <div className={`connection-status ${connection}`}>
        {connection === 'connected' ? '🟢' : '🔴'} {connection}
      </div>

      <Routes>
        <Route path="/" element={<Dashboard logs={logs} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/terminal" element={<Terminal />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default AppWrapper;