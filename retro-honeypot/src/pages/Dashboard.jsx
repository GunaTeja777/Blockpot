import React, { useState, useEffect, useRef } from 'react';

// Simple Spinner component
function Spinner() {
  return (
    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]">
      <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
        Loading...
      </span>
    </div>
  );
}

// Simple Alert component (since it was used but not defined)
function Alert({ variant = 'danger', children, className = '' }) {
  const variantClasses = {
    danger: 'bg-red-100 border-red-400 text-red-700',
    success: 'bg-green-100 border-green-400 text-green-700',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700',
    info: 'bg-blue-100 border-blue-400 text-blue-700'
  };

  return (
    <div className={`border rounded px-4 py-3 ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("Dashboard error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary p-4 bg-red-100 border border-red-400 rounded">
          <h2 className="text-xl font-bold text-red-800">Something went wrong</h2>
          <p className="text-red-700">{this.state.error?.message || 'Unknown error'}</p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Extract hash from transaction object (handles ethers.js v5 or v6 tx objects)
const extractTxHash = (txObj) => {
  // If it's a string, just return it
  if (typeof txObj === 'string') return txObj;
  
  // If it's null/undefined, return empty string
  if (!txObj) return '';
  
  // If it's an object with a hash property that's a string
  if (typeof txObj === 'object' && txObj.hash && typeof txObj.hash === 'string') {
    return txObj.hash;
  }
  
  // If it's an object with a hash property that's an object (ethers transaction)
  if (typeof txObj === 'object' && txObj.hash && typeof txObj.hash === 'object') {
    return ''; // Return empty since we can't safely use it
  }
  
  // Last resort - try to stringify
  try {
    return String(txObj).substring(0, 10);
  } catch (e) {
    return '';
  }
};

function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const wsRef = useRef(null);

  // Function to fetch logs from API
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/logs');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log("Fetched logs:", data);
      
      // Process each log to ensure txHash is a string
      const processedData = data.map(log => ({
        ...log,
        // Process txHash specifically
        txHash: log.txHash ? extractTxHash(log.txHash) : null,
        // Ensure blockNumber is a string
        blockNumber: log.blockNumber ? String(log.blockNumber) : null
      }));
      
      setLogs(processedData);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      setError(`Failed to fetch logs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Setup WebSocket and API connections
  useEffect(() => {
    // Connect to WebSocket server
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:3001');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connection established');
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          if (!event || !event.data) {
            console.warn('Received empty WebSocket message');
            return;
          }
          
          const parsedData = JSON.parse(event.data);
          console.log("WebSocket message received:", parsedData);
          
          // Handle different event types
          if (parsedData.event === 'new_log') {
            // Process new log data
            const processedLog = {
              ...parsedData.data,
              txHash: parsedData.data.txHash ? extractTxHash(parsedData.data.txHash) : null,
              blockNumber: parsedData.data.blockNumber ? String(parsedData.data.blockNumber) : null
            };
            
            setLogs(prevLogs => [...prevLogs, processedLog]);
          } else if (parsedData.event === 'blockchain_confirmation') {
            // Process confirmation data
            const processedData = {
              ...parsedData.data,
              txHash: parsedData.data.txHash ? extractTxHash(parsedData.data.txHash) : null,
              blockNumber: parsedData.data.blockNumber ? String(parsedData.data.blockNumber) : null
            };
            
            setLogs(prevLogs => 
              prevLogs.map(log => 
                (log.timestamp === parsedData.data.timestamp && log.content === parsedData.data.content) 
                  ? { ...log, ...processedData } 
                  : log
              )
            );
          } else if (parsedData.event === 'blockchain_error') {
            // Handle blockchain errors
            console.error("Blockchain error:", parsedData.data.error);
          }
        } catch (err) {
          console.error('Error handling WebSocket message:', err);
          if (event && event.data) {
            console.error('Raw message:', event.data);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setConnectionStatus('disconnected');
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          setConnectionStatus('connecting');
          connectWebSocket();
        }, 5000);
      };
    };

    // Initial fetch of logs
    fetchLogs();
    
    // Initial WebSocket connection
    connectWebSocket();

    // Clean up
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Connection status indicator
  const ConnectionStatus = () => {
    let statusColor;
    let statusText;
    
    switch (connectionStatus) {
      case 'connected':
        statusColor = 'bg-green-500';
        statusText = 'Connected';
        break;
      case 'connecting':
        statusColor = 'bg-yellow-500';
        statusText = 'Connecting...';
        break;
      case 'disconnected':
        statusColor = 'bg-red-500';
        statusText = 'Disconnected';
        break;
      case 'error':
        statusColor = 'bg-red-500';
        statusText = 'Connection Error';
        break;
      default:
        statusColor = 'bg-gray-500';
        statusText = 'Unknown';
    }
    
    return (
      <div className="flex items-center mb-4">
        <div className={`w-3 h-3 ${statusColor} rounded-full mr-2`}></div>
        <span>{statusText}</span>
      </div>
    );
  };

  // Simple function to safely render TX hash
  const renderTxHash = (hash) => {
    if (!hash) return 'N/A';
    try {
      return hash.substring(0, 10) + '...';
    } catch (e) {
      return 'Invalid Hash';
    }
  };

  // Render loading state
  if (loading && logs.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
        <p className="ml-2">Loading logs...</p>
      </div>
    );
  }

  return (
    <div className="dashboard p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Honeypot Activity Dashboard</h1>
        <ConnectionStatus />
      </div>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
          <button 
            className="ml-4 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            onClick={() => fetchLogs()}
          >
            Retry
          </button>
        </Alert>
      )}
      
      <div className="log-container space-y-4">
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <div 
              key={index} 
              className={`log-item p-4 border rounded ${
                log.threatLevel === 'critical' ? 'border-red-500 bg-red-50' :
                log.threatLevel === 'high' ? 'border-orange-500 bg-orange-50' :
                log.threatLevel === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}
            >
              <div className="log-header flex justify-between items-center mb-2">
                <span className="ip font-mono">{log.ip}</span>
                <span className="time text-sm text-gray-600">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
                <span className={`threat-level px-2 py-1 rounded text-xs font-bold ${
                  log.threatLevel === 'critical' ? 'bg-red-600 text-white' :
                  log.threatLevel === 'high' ? 'bg-orange-600 text-white' :
                  log.threatLevel === 'medium' ? 'bg-yellow-600 text-white' :
                  'bg-blue-600 text-white'
                }`}>
                  {log.threatLevel}
                </span>
              </div>
              <div className="log-content font-mono bg-gray-100 p-2 rounded">
                {log.content}
              </div>
              {log.txHash && (
                <div className="blockchain-info mt-2 text-xs text-gray-700">
                  <span className="tx-hash">TX: {renderTxHash(log.txHash)}</span>
                  {log.blockNumber && (
                    <span className="block ml-2">Block: {log.blockNumber}</span>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center p-8 bg-gray-100 rounded">
            <p>No logs available</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Export the Dashboard wrapped in the ErrorBoundary
export default function DashboardWithErrorHandling() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}