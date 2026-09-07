import { create } from 'zustand';
import { authApi } from '../services/auth.api';

/**
 * In-Memory Authentication Store (Sprint 2 / M-02 Remediation).
 *
 * CRITICAL SECURITY INVARIANTS:
 * - Access token and user session data are stored EXCLUSIVELY in memory.
 * - NEVER persisted to localStorage, sessionStorage, cookies, or IndexedDB.
 * - Refresh token is maintained strictly in an HttpOnly, SameSite=Strict cookie
 *   managed exclusively by the browser and backend.
 */
export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  /**
   * Updates state with authenticated user profile and in-memory access token.
   *
   * @param {Object} params
   * @param {Object} params.user
   * @param {string} params.accessToken
   */
  setAuth: ({ user, accessToken }) =>
    set({
      user,
      accessToken,
      isAuthenticated: Boolean(accessToken && user),
      isLoading: false,
    }),

  /**
   * Updates the in-memory access token (e.g. after silent refresh rotation).
   *
   * @param {string} accessToken
   */
  setAccessToken: (accessToken) =>
    set((state) => ({
      accessToken,
      isAuthenticated: Boolean(accessToken && state.user),
    })),

  /**
   * Completely clears user session and credentials from memory.
   */
  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  /**
   * Sets loading spinner status during initialization or async operations.
   *
   * @param {boolean} isLoading
   */
  setLoading: (isLoading) => set({ isLoading }),

  /**
   * Performs silent token refresh on application load or session restore.
   * Sends the HttpOnly refresh cookie to POST /api/v1/auth/refresh.
   *
   * @returns {Promise<boolean>} True if session was restored, false otherwise.
   */
  silentRefresh: async () => {
    try {
      set({ isLoading: true });
      const response = await authApi.refresh();
      if (response && response.data && response.data.accessToken) {
        get().setAuth({
          user: response.data.user,
          accessToken: response.data.accessToken,
        });
        return true;
      }
      get().clearAuth();
      return false;
    } catch {
      get().clearAuth();
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Logs out user globally, revoking token family on backend and clearing memory.
   */
  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Clean up in-memory state regardless of network response
    } finally {
      get().clearAuth();
    }
  },
}));

export default useAuthStore;
