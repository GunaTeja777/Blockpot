class WebSocketService {
    constructor() {
      this.socket = null;
      this.listeners = new Map();
      this.reconnectAttempts = 0;
      this.maxReconnects = 5;
      this.baseUrl = window.REACT_APP_WS_URL || 'ws://localhost:3001';
    }
  
    connect() {
      if (this.socket) return;
  
      this.socket = new WebSocket(this.baseUrl);
  
      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.notify('connection', { status: 'connected' });
      };
  
      this.socket.onmessage = (event) => {
        try {
          const { event: type, data } = JSON.parse(event.data);
          this.notify(type, data);
        } catch (err) {
          console.error('Message parse error:', err);
        }
      };
  
      this.socket.onclose = () => {
        this.socket = null;
        this.notify('connection', { status: 'disconnected' });
        
        if (this.reconnectAttempts < this.maxReconnects) {
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, Math.min(1000 * this.reconnectAttempts, 5000));
        }
      };
  
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.notify('error', { message: 'Connection error' });
      };
    }
  
    addListener(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, new Set());
      }
      this.listeners.get(event).add(callback);
      return () => this.listeners.get(event).delete(callback);
    }
  
    notify(event, data) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).forEach(cb => cb(data));
      }
    }
  
    send(event, data) {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ event, data }));
      }
    }
  }
  
  export const webSocketService = new WebSocketService();