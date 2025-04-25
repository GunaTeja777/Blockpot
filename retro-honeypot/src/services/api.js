// For React frontend only - no Node.js dependencies
const API_BASE_URL = window.REACT_APP_API_URL || 'http://localhost:3001';

export const fetchLogs = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/logs`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch logs:', error);
        throw error;
    }
};

export const checkHealth = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) throw new Error('Service unavailable');
        return await response.json();
    } catch (error) {
        console.error('Health check failed:', error);
        throw error;
    }
};

export const fetchRecentAttacks = async (limit = 100) => {
    try {
        const response = await fetch(`${API_BASE_URL}/logs?limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch recent attacks');
        return await response.json();
    } catch (error) {
        console.error('Error fetching recent attacks:', error);
        throw error;
    }
};