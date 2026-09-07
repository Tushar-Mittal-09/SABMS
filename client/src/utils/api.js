import axios from 'axios';
import { normalizeApiError } from './errorHandler';
import { useAuthStore } from '../store/auth.store';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

/**
 * Helper to read a cookie value by name from document.cookie.
 *
 * @param {string} name
 * @returns {string|null}
 */
const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match ? decodeURIComponent(match[3]) : null;
};

/**
 * Standard Axios instance configured for SABMS backend.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
});

// Single-flight refresh state tracking
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ─── Request Interceptor ─────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    // 1. Inject in-memory access token if available
    const token = useAuthStore.getState().accessToken;
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Inject Double-Submit CSRF token header on mutating methods
    const method = config.method ? config.method.toUpperCase() : 'GET';
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    if (isMutating) {
      const csrfToken = getCookie('XSRF-TOKEN');
      if (csrfToken && !config.headers['X-XSRF-TOKEN']) {
        config.headers['X-XSRF-TOKEN'] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Skip retry on non-401 errors, already retried requests, or auth refresh/login itself
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/register');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      if (isRefreshing) {
        // Queue subsequent failed requests while refresh is in-flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Send HttpOnly refresh cookie to /auth/refresh
        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken =
          refreshResponse.data?.data?.accessToken ||
          refreshResponse.data?.accessToken;
        const user =
          refreshResponse.data?.data?.user || refreshResponse.data?.user;

        if (newAccessToken) {
          useAuthStore.getState().setAuth({
            user: user || useAuthStore.getState().user,
            accessToken: newAccessToken,
          });

          apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);
          return apiClient(originalRequest);
        } else {
          throw new Error('Refresh response did not return an access token');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        useAuthStore.getState().clearAuth();
        return Promise.reject(normalizeApiError(refreshErr));
      } finally {
        isRefreshing = false;
      }
    }

    const normalized = normalizeApiError(error);
    return Promise.reject(normalized);
  }
);

export default apiClient;
