class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isManualClose = false;
    this.heartbeatInterval = null;
    this.baseUrl = this.getWebSocketUrl();
  }

  getWebSocketUrl() {
    // Use proxy in development, and fallback URL for production
    if (process.env.NODE_ENV === 'development') {
      return 'ws://localhost:3001'; // Match your backend port
    }
    return window.REACT_APP_WS_URL || 'ws://localhost:3001'; // Fallback for production
  }

  connect() {
    if (this.socket || this.isManualClose) return;

    this.socket = new WebSocket(this.baseUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;

      // Start heartbeat
      this.heartbeatInterval = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 25000);

      this.notifyListeners('connection_change', 'connected');
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'heartbeat') return; // Ignore heartbeat responses
        this.notifyListeners(data.event, data.data || data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
        this.notifyListeners('error', { 
          message: 'Invalid message format', 
          error: err 
        });
      }
    };

    this.socket.onclose = (event) => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (this.isManualClose) return;

      console.log(`WebSocket disconnected (code: ${event.code}, reason: ${event.reason})`);
      this.socket = null;
      this.notifyListeners('connection_change', 'disconnected');

      // Reconnect logic
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
          this.connect();
        }, this.reconnectDelay);
      } else {
        this.notifyListeners('error', { 
          message: 'Max reconnection attempts reached' 
        });
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.notifyListeners('error', { 
        message: 'WebSocket error', 
        error: error 
      });
    };
  }

  disconnect() {
    this.isManualClose = true;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.socket) {
      this.socket.close(1000, 'Manual disconnect');
      this.socket = null;
    }
  }

  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        this.socket.send(payload);
        return true;
      } catch (error) {
        console.error('Error sending message:', error);
        return false;
      }
    }
    console.warn('WebSocket is not open, message not sent.');
    return false;
  }

  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.removeListener(event, callback);
  }

  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in ${event} listener:`, err);
        }
      });
    }
  }

  getStatus() {
    if (!this.socket) return 'disconnected';
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'disconnecting';
      case WebSocket.CLOSED: return 'disconnected';
      default: return 'unknown';
    }
  }
}

export const webSocketService = new WebSocketService();
