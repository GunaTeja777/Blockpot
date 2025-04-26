class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.isManualClose = false;
    this.heartbeatInterval = null;
    this.pendingMessages = [];
  }

  connect() {
    if (this.socket || this.isManualClose) return;

    const socketUrl = WS_BASE_URL.startsWith('/') 
      ? `${window.location.origin.replace('http', 'ws')}${WS_BASE_URL}`
      : WS_BASE_URL;

    this.socket = new WebSocket(socketUrl);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.flushPendingMessages();
      
      // Start heartbeat
      this.heartbeatInterval = setInterval(() => {
        if (this.isConnected()) {
          this.send({ type: 'heartbeat' });
        }
      }, 25000);

      this.notifyListeners('connection_change', { status: 'connected' });
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'heartbeat') return;
        this.notifyListeners(data.event || 'message', data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
        this.notifyListeners('error', { 
          type: 'parse_error',
          error: err.toString(),
          raw: event.data
        });
      }
    };

    this.socket.onclose = (event) => {
      this.cleanup();
      if (this.isManualClose) return;
      
      console.log(`WebSocket disconnected (code: ${event.code}, reason: ${event.reason})`);
      this.notifyListeners('connection_change', { 
        status: 'disconnected',
        code: event.code,
        reason: event.reason
      });
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(this.reconnectDelay * (this.reconnectAttempts + 1), 30000);
        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, delay);
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

  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect() {
    this.isManualClose = true;
    this.cleanup();
    if (this.socket) {
      this.socket.close(1000, 'Manual disconnect');
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  send(message) {
    if (this.isConnected()) {
      try {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        this.socket.send(payload);
        return true;
      } catch (error) {
        console.error('Error sending message:', error);
        return false;
      }
    } else {
      this.pendingMessages.push(message);
      return false;
    }
  }

  flushPendingMessages() {
    while (this.pendingMessages.length > 0 && this.isConnected()) {
      const message = this.pendingMessages.shift();
      this.send(message);
    }
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

