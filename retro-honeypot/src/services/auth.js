export async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/verify');
    if (!response.ok) throw new Error('Not authenticated');
    return await response.json();
  } catch (error) {
    console.error('Auth check failed:', error);
    return { authenticated: false };
  }
}