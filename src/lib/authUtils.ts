import { supabase } from './supabase';

// Constants for storage keys
const AUTH_TOKEN_KEY = 'sb-auth-token';
const REFRESH_TOKEN_KEY = 'sb-refresh-token';
const USER_DATA_KEY = 'sb-user-data';

// Get stored auth token
export const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);

// Get stored refresh token
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

// Get stored user data
export const getCurrentUser = () => {
  const userData = localStorage.getItem(USER_DATA_KEY);
  return userData ? JSON.parse(userData) : null;
};

// Check if user is authenticated
export const isAuthenticated = () => {
  const token = getAuthToken();
  const user = getCurrentUser();
  return !!token && !!user;
};

// Store auth data
export const setAuthData = async (session: any, userData: any) => {
  try {
    console.log('Setting auth data...');
    localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
    console.log('Auth data set successfully');
    return true;
  } catch (error) {
    console.error('Error setting auth data:', error);
    return false;
  }
};

// Clear auth data
export const clearAuthData = async () => {
  try {
    console.log('Clearing auth data...');
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    await supabase.auth.signOut();
    console.log('Auth data cleared successfully');
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
};

// Check and refresh token if needed
export const checkAndRefreshToken = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return false;
    }
    
    if (!session) {
      console.log('No session found');
      return false;
    }
    
    // If session exists but is expired or close to expiring, refresh it
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt - now;
    
    if (timeUntilExpiry < 300) { // Less than 5 minutes until expiry
      console.log('Session expiring soon, refreshing...');
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Error refreshing session:', refreshError);
        return false;
      }
      
      if (!newSession) {
        console.log('No new session after refresh');
        return false;
      }
      
      // Get user data after refresh
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', newSession.user.id)
        .single();
      
      if (userError || !userData) {
        console.error('Error getting user data after refresh:', userError);
        return false;
      }
      
      // Store new session data
      await setAuthData(newSession, userData);
    }
    
    return true;
  } catch (error) {
    console.error('Error checking/refreshing token:', error);
    return false;
  }
};