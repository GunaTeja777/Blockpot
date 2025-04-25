class WebSocketService {
    constructor() {
      this.socket = null;
      this.listeners = new Map();
      this.connectionStatus = "disconnected";
    }
  
    connect() {
      if (this.socket) return;
  
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
      this.socket = new WebSocket(wsUrl);
  
      this.socket.onopen = () => {
        this.connectionStatus = "connected";
        this.notifyListeners("connection_change", this.connectionStatus);
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
        this.connectionStatus = "disconnected";
        this.notifyListeners("connection_change", this.connectionStatus);
        this.socket = null;
        setTimeout(() => this.connect(), 5000);
      };
  
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    }
  
    // ... rest of the class implementation from previous example
  }
  
  export const webSocketService = new WebSocketService();