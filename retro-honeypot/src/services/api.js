// Frontend-compatible API service (using environment variables from React)
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
require('dotenv').config();
export const fetchLogs = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/logs`);
        if (!response.ok) throw new Error('Failed to fetch logs');
        return await response.json();
    } catch (error) {
        console.error('Error fetching logs:', error);
        throw error;
    }
};

export const checkHealth = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) throw new Error('Service unhealthy');
        return await response.json();
    } catch (error) {
        console.error('Health check failed:', error);
        throw error;
    }
};

// Add other API calls as needed
export const fetchAttackStats = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/stats`);
        if (!response.ok) throw new Error('Failed to fetch stats');
        return await response.json();
    } catch (error) {
        console.error('Error fetching stats:', error);
        throw error;
    }
};