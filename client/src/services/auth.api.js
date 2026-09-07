import apiClient from '../utils/api';

/**
 * Authentication API Service (Sprint 2.4 - 2.6).
 * Consumes the authoritative SABMS backend endpoints.
 */
export const authApi = {
  /**
   * Registers a new user account (Sprint 2.4).
   * POST /api/v1/auth/register
   *
   * @param {Object} payload
   * @param {string} payload.name
   * @param {string} payload.email
   * @param {string} [payload.phone]
   * @param {string} payload.password
   * @param {string} [payload.department]
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  registerUser: async (payload) => {
    // Construct clean payload matching backend registerSchema strict contract
    const cleanPayload = {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password, // NEVER trim password
    };
    if (payload.phone && payload.phone.trim()) {
      cleanPayload.phone = payload.phone.trim();
    }
    if (payload.department && payload.department.trim()) {
      cleanPayload.department = payload.department.trim();
    }

    return apiClient.post('/auth/register', cleanPayload);
  },

  /**
   * Submits Email OTP for verification (Sprint 2.5).
   * POST /api/v1/auth/verify-email
   *
   * @param {Object} payload
   * @param {string} payload.email
   * @param {string} payload.otp
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  verifyEmailOtp: async ({ email, otp }) => {
    return apiClient.post('/auth/verify-email', {
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
    });
  },

  /**
   * Resends Email OTP (Sprint 2.5).
   * POST /api/v1/auth/resend-email-otp
   *
   * @param {Object} payload
   * @param {string} payload.email
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  resendEmailOtp: async ({ email }) => {
    return apiClient.post('/auth/resend-email-otp', {
      email: email.trim().toLowerCase(),
    });
  },

  /**
   * Submits Phone OTP for verification (Sprint 2.6).
   * POST /api/v1/auth/verify-phone
   *
   * @param {Object} payload
   * @param {string} payload.phone
   * @param {string} payload.otp
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  verifyPhoneOtp: async ({ phone, otp }) => {
    return apiClient.post('/auth/verify-phone', {
      phone: phone.trim(),
      otp: otp.trim(),
    });
  },

  /**
   * Resends Phone OTP (Sprint 2.6).
   * POST /api/v1/auth/resend-phone-otp
   *
   * @param {Object} payload
   * @param {string} payload.phone
   * @returns {Promise<{ success: boolean, message: string, data: Object }>}
   */
  resendPhoneOtp: async ({ phone }) => {
    return apiClient.post('/auth/resend-phone-otp', {
      phone: phone.trim(),
    });
  },

  /**
   * Authenticates user with credentials (Sprint 2.7).
   * POST /api/v1/auth/login
   *
   * @param {Object} credentials
   * @param {string} credentials.email
   * @param {string} credentials.password
   * @returns {Promise<{ success: boolean, message: string, data: { user: Object, accessToken: string } }>}
   */
  login: async ({ email, password }) => {
    return apiClient.post('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    });
  },

  /**
   * Exchanges HttpOnly refresh cookie for a new access token (Sprint 2.9/2.10).
   * POST /api/v1/auth/refresh
   *
   * @returns {Promise<{ success: boolean, message: string, data: { accessToken: string, user: Object } }>}
   */
  refresh: async () => {
    return apiClient.post('/auth/refresh');
  },

  /**
   * Requests a password reset OTP via email (Sprint 2.12).
   * POST /api/v1/auth/forgot-password
   *
   * @param {Object} payload
   * @param {string} payload.email
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  forgotPassword: async ({ email }) => {
    return apiClient.post('/auth/forgot-password', {
      email: email.trim().toLowerCase(),
    });
  },

  /**
   * Verifies reset OTP and sets new password (Sprint 2.13).
   * POST /api/v1/auth/reset-password
   *
   * @param {Object} payload
   * @param {string} payload.email
   * @param {string} payload.otp
   * @param {string} payload.newPassword
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  resetPassword: async ({ email, otp, newPassword }) => {
    return apiClient.post('/auth/reset-password', {
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
      newPassword,
    });
  },

  /**
   * Authenticated user password change (Sprint 2.14).
   * POST /api/v1/auth/change-password
   *
   * @param {Object} payload
   * @param {string} payload.currentPassword
   * @param {string} payload.newPassword
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  changePassword: async ({ currentPassword, newPassword }) => {
    return apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  },

  /**
   * Retrieves all active sessions for authenticated user (Sprint 2.16).
   * GET /api/v1/auth/sessions
   *
   * @returns {Promise<{ success: boolean, message: string, data: Array<Object> }>}
   */
  getSessions: async () => {
    return apiClient.get('/auth/sessions');
  },

  /**
   * Revokes a specific session by sessionId (Sprint 2.16).
   * DELETE /api/v1/auth/sessions/:sessionId
   *
   * @param {string} sessionId
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  revokeSession: async (sessionId) => {
    return apiClient.delete(`/auth/sessions/${sessionId}`);
  },

  /**
   * Revokes all other sessions except current active session (Sprint 2.16).
   * DELETE /api/v1/auth/sessions
   *
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  revokeAllOtherSessions: async () => {
    return apiClient.delete('/auth/sessions');
  },

  /**
   * Retrieves CSRF token and establishes double-submit cookie (Sprint 2.18).
   * GET /api/v1/auth/csrf-token
   *
   * @returns {Promise<{ success: boolean, data: { csrfToken: string } }>}
   */
  getCsrfToken: async () => {
    return apiClient.get('/auth/csrf-token');
  },

  /**
   * Logs out the user and invalidates refresh token family (Sprint 2.11).
   * POST /api/v1/auth/logout
   *
   * @returns {Promise<{ success: boolean, message: string, data: null }>}
   */
  logout: async () => {
    return apiClient.post('/auth/logout');
  },
};

export default authApi;
