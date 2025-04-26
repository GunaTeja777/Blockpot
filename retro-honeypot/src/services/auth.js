export const checkAuthStatus = async () => {
  try {
    const response = await fetch('/api/auth/status', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Authentication check failed');
    }
    
    const data = await response.json();
    return data.authenticated || false;
  } catch (error) {
    console.error('Authentication check error:', error);
    return false;
  }
};