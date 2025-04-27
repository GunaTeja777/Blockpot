const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001' 
  : window.REACT_APP_API_URL || 'http://localhost:3001';

export const fetchLogs = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/logs`, {
      credentials: 'include'  // Ensure cookies are included in requests
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

export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      credentials: 'include'  // Ensure cookies are included in requests
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

export const fetchRecentAttacks = async (limit = 100) => {
  try {
    const response = await fetch(`${API_BASE_URL}/logs?limit=${limit}`, {
      credentials: 'include'  // Ensure cookies are included in requests
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
