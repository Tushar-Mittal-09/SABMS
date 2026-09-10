import apiClient from '../utils/api';

/**
 * Events API Service
 *
 * Consumes the SABMS backend event discovery endpoints.
 * All event data including auditorium configuration is sourced
 * from the backend — the backend is the single source of truth.
 */
export const eventsApi = {
  /**
   * Lists student-visible events with pagination and filters.
   * GET /api/v1/events
   *
   * @param {Object} [params]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=12]
   * @param {string} [params.status] - UPCOMING or ONGOING
   * @param {string} [params.auditorium] - AUDITORIUM_1, AUDITORIUM_2, AUDITORIUM_3
   * @returns {Promise<{ success: boolean, message: string, data: { events: Array, pagination: Object } }>}
   */
  listEvents: async (params = {}) => {
    const query = {};
    if (params.page) query.page = String(params.page);
    if (params.limit) query.limit = String(params.limit);
    if (params.status) query.status = params.status;
    if (params.auditorium) query.auditorium = params.auditorium;

    return apiClient.get('/events', { params: query });
  },

  /**
   * Retrieves details of a specific event.
   * GET /api/v1/events/:eventId
   *
   * @param {string} eventId - MongoDB ObjectId string
   * @returns {Promise<{ success: boolean, message: string, data: { event: Object } }>}
   */
  getEventById: async (eventId) => {
    return apiClient.get(`/events/${eventId}`);
  },
};

export default eventsApi;
