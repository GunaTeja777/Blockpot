const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001' 
  : window.REACT_APP_API_URL || 'http://localhost:3001';

// API wrapper with consistent error handling
const apiRequest = async (endpoint, options = {}) => {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            credentials: 'include',
            ...options
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || response.statusText);
        }

        return await response.json();
    } catch (error) {
        console.error(`API request to ${endpoint} failed:`, error);
        throw error;
    }
};

// Fetch logs with pagination
export const fetchLogs = async (page = 1, limit = 100) => {
    return apiRequest(`/api/logs?page=${page}&limit=${limit}`);
};

// Health check
export const checkHealth = async () => {
    return apiRequest('/api/health');
};

// Authentication status
export const checkAuthStatus = async () => {
    return apiRequest('/api/auth/verify');
};