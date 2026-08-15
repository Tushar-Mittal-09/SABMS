import axios from 'axios';
import { normalizeApiError } from './errorHandler';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

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

// Response interceptor for transparent error normalization
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const normalized = normalizeApiError(error);
    return Promise.reject(normalized);
  }
);

export default apiClient;
