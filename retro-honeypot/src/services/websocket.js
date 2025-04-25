class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.connectionStatus = "disconnected";
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5 seconds
  }

  connect() {
    if (this.socket) return;

    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.connectionStatus = "connected";
      this.reconnectAttempts = 0; // Reset on successful connection
      this.notifyListeners("connection_change", this.connectionStatus);
      console.log('WebSocket connected');
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.notifyListeners(data.event || 'message', data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
        this.notifyListeners('error', { 
          type: 'parse_error', 
          error: err.message,
          originalData: event.data
        });
      }
    };

    this.socket.onclose = (event) => {
      this.connectionStatus = "disconnected";
      this.notifyListeners("connection_change", this.connectionStatus);
      this.socket = null;

      if (event.code === 1000) { // Normal closure
        console.log('WebSocket closed normally');
        return;
      }

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.calculateReconnectDelay();
        console.log(`Reconnecting in ${delay/1000} seconds... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
      } else {
        console.error('Max reconnection attempts reached');
        this.notifyListeners('error', {
          type: 'max_reconnects',
          message: 'Failed to reconnect after maximum attempts'
        });
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.notifyListeners('error', {
        type: 'socket_error',
        error: error
      });
    };
  }

  calculateReconnectDelay() {
    // Exponential backoff with jitter
    const baseDelay = Math.min(
      this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      30000 // Max 30 seconds
    );
    return baseDelay * (0.8 + Math.random() * 0.4); // Add jitter
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
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
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

  send(data) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      try {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        this.socket.send(payload);
      } catch (err) {
        console.error('Error sending WebSocket message:', err);
      }
    } else {
      console.warn('Cannot send - WebSocket not connected');
    }
  }

  close() {
    if (this.socket) {
      this.socket.close(1000, 'Client initiated close');
      this.socket = null;
      this.reconnectAttempts = 0;
    }
  }
}

export const webSocketService = new WebSocketService();