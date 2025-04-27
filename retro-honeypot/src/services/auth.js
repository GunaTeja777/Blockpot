const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001' 
  : window.REACT_APP_API_URL || 'http://localhost:3001';

// Fetch logs
export const fetchLogs = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/logs`, {
      credentials: 'include'  // Ensure credentials (cookies) are included in requests
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
};

// Health check
export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      credentials: 'include'  // Ensure credentials (cookies) are included in requests
    });
    if (!response.ok) {
      throw new Error(`Service unavailable: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// Fetch recent attacks with a limit
export const fetchRecentAttacks = async (limit = 100) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/logs?limit=${limit}`, {
      credentials: 'include'  // Ensure credentials (cookies) are included in requests
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch recent attacks: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching recent attacks:', error);
    throw error;
  }
};

// Check authentication status
export const checkAuthStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      credentials: 'include'  // Ensure credentials (cookies) are included in requests
    });
    if (!response.ok) {
      throw new Error(`Not authenticated: ${response.statusText}`);
    }
    const authStatus = await response.json();
    return authStatus.authenticated;
  } catch (error) {
    console.error('Authentication check failed:', error);
    return false;  // Return false if authentication check fails
  }
};
