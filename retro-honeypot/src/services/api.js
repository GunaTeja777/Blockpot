const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || '/ws';

// Helper function for API requests
async function makeRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
}

export const fetchLogs = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return makeRequest(`/logs?${query}`);
};

export const checkHealth = async () => {
  return makeRequest('/health');
};

export const fetchRecentAttacks = async (limit = 100) => {
  return makeRequest(`/logs?limit=${limit}`);
};

export const fetchBlockchainStats = async () => {
  return makeRequest('/blockchain/stats');
};