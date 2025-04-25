export const checkAuthStatus = async () => {
    try {
      // Example: Verify token with backend
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Not authenticated');
      }
      
      return true;
    } catch (error) {
      console.error('Authentication check failed:', error);
      return false;
    }
  };