import axios from 'axios';
import { getToken, saveToken, removeToken } from '../utils/tokenStorage';
import { router } from 'expo-router';
import { config } from '../../app/shared/config/env';

/**
 * Get API Base URL from environment
 */
const getApiBaseUrl = () => {
  // Use env.js configuration
  const baseURL = config.API_URL + '/api';
  console.log('[apiClient] Base URL:', baseURL);
  return baseURL;
};

/**
 * Create Axios instance with base configuration
 */
const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

/**
 * Request Interceptor
 * Adds JWT token to every request
 */
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      if (__DEV__) {
        console.log(`[API Request] ${config.method.toUpperCase()} ${config.url}`);
        console.log(`[API Request] Full URL: ${config.baseURL}${config.url}`);
        console.log(`[API Request] Headers:`, config.headers);
      }
      
      return config;
    } catch (error) {
      console.error('[API] Error in request interceptor:', error);
      return config;
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * Handles token refresh on 401 errors
 */
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    // Successful response
    if (__DEV__) {
      console.log(`[API Response] ${response.config.url}:`, response.status);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is not 401 or request has already been retried, reject
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Auth endpoints should never trigger refresh — reject immediately with real error
    const AUTH_ENDPOINTS = ['/login', '/register', '/auth/refresh'];
    if (AUTH_ENDPOINTS.some(ep => originalRequest.url?.includes(ep))) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // If already refreshing, queue this request
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        })
        .catch(err => {
          return Promise.reject(err);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Try to refresh token
      const refreshToken = await getToken('refresh_token');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post(
        `${getApiBaseUrl()}/auth/refresh`,
        { refresh_token: refreshToken },
        { timeout: 10000 }
      );

      const { access_token, refresh_token: newRefreshToken } = response.data;

      // Save new tokens
      await saveToken(access_token);
      if (newRefreshToken) {
        await saveToken(newRefreshToken, 'refresh_token');
      }

      // Update authorization header
      originalRequest.headers.Authorization = `Bearer ${access_token}`;
      
      // Process queued requests
      processQueue(null, access_token);
      
      isRefreshing = false;

      // Retry original request
      return apiClient(originalRequest);
    } catch (refreshError) {
      // Refresh failed - logout user
      processQueue(refreshError, null);
      isRefreshing = false;
      
      console.error('[API] Token refresh failed:', refreshError);
      
      // Clear tokens
      await removeToken();
      await removeToken('refresh_token');
      
      // Redirect to login
      if (router) {
        router.replace('/');
      }
      
      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
