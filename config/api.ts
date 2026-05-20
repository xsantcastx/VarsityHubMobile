// API Configuration for VarsityHub
// Handles both development and production environments

import { getConfig } from '@/config/env';
import { getApiBaseUrl } from '../api/http';

const appConfig = getConfig();
export const API_BASE_URL = appConfig.apiUrl || getApiBaseUrl();

export const API_TIMEOUT = 10000; // 10 seconds

// Debug logging
if (__DEV__) {
  console.log('API Configuration:', {
    baseUrl: API_BASE_URL,
    env: appConfig.nodeEnv || 'production',
    timeout: API_TIMEOUT,
  });
}

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
