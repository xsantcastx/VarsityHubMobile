// API Configuration for VarsityHub
// Handles both development and production environments

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api-production-8ac3.up.railway.app';

export const API_TIMEOUT = 10000; // 10 seconds

// Debug logging
console.log('🔗 API Configuration:');
console.log('  Base URL:', API_BASE_URL);
console.log('  Environment:', process.env.EXPO_PUBLIC_NODE_ENV || 'production');
console.log('  Timeout:', API_TIMEOUT + 'ms');

// API health check function
export const checkAPIHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('API health check failed:', error);
    return false;
  }
};

// Export for use in http client
export default {
  BASE_URL: API_BASE_URL,
  TIMEOUT: API_TIMEOUT,
  checkHealth: checkAPIHealth,
};