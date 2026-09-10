import api from '../utils/api';

/**
 * Bookings API Service
 *
 * Provides API clients for the seat map and booking endpoints.
 */
export const bookingsApi = {
  /**
   * Retrieves the seat map and availability for a specific event.
   *
   * @param {string} eventId - Target event ID.
   * @returns {Promise<Object>} API response with seat map data.
   */
  getSeatMap: (eventId) => api.get(`/events/${eventId}/seats`),

  /**
   * Atomically books one seat for an event.
   *
   * @param {string} eventId - Target event ID.
   * @param {string} seatId - Target seat identifier (e.g. 'C-04').
   * @returns {Promise<Object>} API response with created booking.
   */
  bookSeat: (eventId, seatId) =>
    api.post(`/events/${eventId}/bookings`, { seatId }),
};

export default bookingsApi;
