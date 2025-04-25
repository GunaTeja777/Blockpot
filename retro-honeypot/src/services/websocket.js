class WebSocketService {
  constructor() {
      this.socket = null;
      this.listeners = new Map();
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 1000;
  }

  connect() {
      if (this.socket) return;

      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.notifyListeners('connection_change', 'connected');
      };

      this.socket.onmessage = (event) => {
          try {
              const data = JSON.parse(event.data);
              this.notifyListeners(data.event, data);
          } catch (err) {
              console.error('Error parsing WebSocket message:', err);
          }
      };

      this.socket.onclose = () => {
          console.log('WebSocket disconnected');
          this.socket = null;
          this.notifyListeners('connection_change', 'disconnected');
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
              setTimeout(() => {
                  this.reconnectAttempts++;
                  this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
                  this.connect();
              }, this.reconnectDelay);
          }
      };

      this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
      };
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
          this.listeners.get(event).forEach(callback => callback(data));
      }
  }
}

export const webSocketService = new WebSocketService();