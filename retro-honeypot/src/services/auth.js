export const checkAuthStatus = async () => {
  try {
    const response = await fetch('/api/auth/status', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Not authenticated');
    }
    
    const data = await response.json();
    return data.authenticated || false;
  } catch (error) {
    console.error('Authentication check error:', error);
    return false;
  }
};

export const login = async (password) => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Login failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    return false;
  }
};