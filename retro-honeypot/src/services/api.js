const API_BASE = window.REACT_APP_API_URL || 'http://localhost:3001';

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 5000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
    credentials: 'include'
  });
  
  clearTimeout(id);
  
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export const fetchLogs = () => fetchWithTimeout(`${API_BASE}/logs`);

export const checkHealth = () => fetchWithTimeout(`${API_BASE}/health`);

export const fetchBlockNumber = async () => {
  const { blockNumber } = await checkHealth();
  return blockNumber;
};