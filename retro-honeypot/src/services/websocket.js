class WebSocketService {
    constructor() {
      this.socket = null;
      this.listeners = new Map();
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 1000;
      this.isManualClose = false;
      this.baseUrl = this.getWebSocketUrl();
    }
  
    // Safe way to get WebSocket URL that works in browser
    getWebSocketUrl() {
      // Use window variable if available (set in public/config.js)
      if (typeof window !== 'undefined' && window.REACT_APP_WS_URL) {
        return window.REACT_APP_WS_URL;
      }
      // Default fallback for development
      return 'ws://localhost:3001';
    }
  
    connect() {
      if (this.socket || this.isManualClose) return;
  
      this.socket = new WebSocket(this.baseUrl);
  
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.notifyListeners('connection_change', 'connected');
      };
  
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
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
        if (this.isManualClose) return;
        
        console.log(`WebSocket disconnected`);
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
        this.notifyListeners('error', { 
          message: 'WebSocket error', 
          error: error 
        });
      };
    }
  
    disconnect() {
      this.isManualClose = true;
      if (this.socket) {
        this.socket.close(1000, 'Manual disconnect');
        this.socket = null;
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
  }
  
  export const webSocketService = new WebSocketService();