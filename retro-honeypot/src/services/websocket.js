class WebSocketService {
    constructor() {
      this.socket = null;
      this.listeners = new Map();
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 1000;
      this.baseUrl = this.getWebSocketUrl();
      this.isManualClose = false;
    }
  
    // Get WebSocket URL from environment or config
    getWebSocketUrl() {
      // Try different ways to get the URL
      if (typeof window !== 'undefined' && window.REACT_APP_WS_URL) {
        return window.REACT_APP_WS_URL;
      }
      if (process.env.REACT_APP_WS_URL) {
        return process.env.REACT_APP_WS_URL;
      }
      return 'ws://localhost:3001'; // Default fallback
    }
  
    connect() {
      if (this.socket || this.isManualClose) return;
  
      try {
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
          
          console.log(`WebSocket disconnected (code: ${event.code}, reason: ${event.reason})`);
          this.socket = null;
          this.notifyListeners('connection_change', 'disconnected');
          
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
      } catch (error) {
        console.error('WebSocket initialization error:', error);
        this.notifyListeners('error', { 
          message: 'Connection failed', 
          error: error 
        });
      }
    }
  
    disconnect() {
      this.isManualClose = true;
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
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
          this.notifyListeners('error', { 
            message: 'Failed to send message', 
            error: error 
          });
        }
      } else {
        console.warn('WebSocket not connected - message not sent');
        this.notifyListeners('error', { 
          message: 'WebSocket not connected' 
        });
      }
    }
  
    addListener(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event).add(callback);
      
      // Return cleanup function
      return () => this.removeListener(event, callback);
    }
  
    removeListener(event, callback) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).delete(callback);
        
        // Clean up empty event sets
        if (this.listeners.get(event).size === 0) {
          this.listeners.delete(event);
        }
      }
    }
  
    notifyListeners(event, data) {
      if (this.listeners.has(event)) {
        // Create a copy of the callbacks to avoid issues if they're modified during iteration
        const callbacks = Array.from(this.listeners.get(event));
        callbacks.forEach(callback => {
          try {
            callback(data);
          } catch (err) {
            console.error(`Error in ${event} listener:`, err);
          }
        });
      }
    }
  
    getStatus() {
      return this.socket ? this.socket.readyState : WebSocket.CLOSED;
    }
  }
  
  // Singleton instance
  export const webSocketService = new WebSocketService();