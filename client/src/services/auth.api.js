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
};

export default authApi;
