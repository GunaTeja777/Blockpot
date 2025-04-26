// Frontend configuration
window.APP_CONFIG = {
    API_URL: import.meta.env.VITE_API_URL || '/api',
    WS_URL: import.meta.env.VITE_WS_URL || '/ws',
    ENV: import.meta.env.MODE || 'development',
    // Add other frontend configs as needed
  };
  
  console.log('Application config loaded:', window.APP_CONFIG);