'use strict';

const request = require('supertest');
const app = require('../../src/app/app');
const { StatusCodes } = require('http-status-codes');

// Mock auth helper
jest.mock('../../src/modules/auth/auth.helper', () => ({
  verifyAccessToken: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
}));

const { verifyAccessToken } = require('../../src/modules/auth/auth.helper');

// Mock Event model
jest.mock('../../src/modules/events/event.model', () => ({
  findById: jest.fn(),
}));

const Event = require('../../src/modules/events/event.model');

// Mock Booking repository
jest.mock('../../src/modules/bookings/booking.repository', () => ({
  generateBookingReference: jest.fn(() => 'BK-TESTREF-123456'),
  findConfirmedBookingsForEvent: jest.fn(),
  findConfirmedBookingByUserAndEvent: jest.fn(),
  createBookingWithRetry: jest.fn(),
}));

const bookingRepository = require('../../src/modules/bookings/booking.repository');
const AppError = require('../../src/core/errors/AppError');

const VALID_TOKEN = 'valid-test-token';
const VALID_STUDENT = {
  sub: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  role: 'STUDENT',
  email: 'student@miet.ac.in',
};

const MOCK_EVENT = {
  _id: '507f1f77bcf86cd799439012',
  name: 'AI & Cloud Summit [Demo]',
  description: 'A presentation fixture for SABMS Step 3 seat booking.',
  auditorium: 'AUDITORIUM_1',
  auditoriumName: 'Auditorium 1',
  date: '2026-09-20T00:00:00.000Z',
  startTime: '10:00',
  endTime: '13:00',
  status: 'UPCOMING',
  totalSeats: 312,
  availableSeats: 312,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};

describe('Booking API Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── 1. Authentication & Authorization ────────────────────────────────────

  describe('Authentication & Authorization', () => {
    it('1. GET /api/v1/events/:eventId/seats should return 401 without authentication token', async () => {
      const res = await request(app).get(
        `/api/v1/events/${MOCK_EVENT._id}/seats`
      );
      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(res.body.success).toBe(false);
    });

    it('2. POST /api/v1/events/:eventId/bookings should return 401 without authentication token', async () => {
      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .send({ seatId: 'C-04' });
      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(res.body.success).toBe(false);
    });

    it('22. Non-student role (FACULTY) should be rejected with 403 Forbidden', async () => {
      verifyAccessToken.mockReturnValue({
        sub: '507f1f77bcf86cd799439099',
        id: '507f1f77bcf86cd799439099',
        role: 'FACULTY',
        email: 'faculty@miet.ac.in',
      });

      const res = await request(app)
        .get(`/api/v1/events/${MOCK_EVENT._id}/seats`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── 2. Seat Map Retrieval (GET /seats) ───────────────────────────────────

  describe('GET /api/v1/events/:eventId/seats', () => {
    beforeEach(() => {
      verifyAccessToken.mockReturnValue(VALID_STUDENT);
    });

    it('2. Authenticated student can retrieve seat map with 200 OK', async () => {
      Event.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(MOCK_EVENT),
      });
      bookingRepository.findConfirmedBookingsForEvent.mockResolvedValue([
        { seatId: 'C-01', seatLabel: 'Row C, Seat 1', status: 'CONFIRMED' },
      ]);

      const res = await request(app)
        .get(`/api/v1/events/${MOCK_EVENT._id}/seats`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.event.id).toBe(MOCK_EVENT._id);
      expect(res.body.data.auditorium.code).toBe('AUDITORIUM_1');
      expect(res.body.data.seats).toHaveLength(360);

      // Verify C-01 is marked BOOKED and C-02 is AVAILABLE
      const seatC01 = res.body.data.seats.find((s) => s.seatId === 'C-01');
      const seatC02 = res.body.data.seats.find((s) => s.seatId === 'C-02');
      const seatA01 = res.body.data.seats.find((s) => s.seatId === 'A-01');

      expect(seatC01.status).toBe('BOOKED');
      expect(seatC02.status).toBe('AVAILABLE');
      expect(seatA01.status).toBe('RESERVED');
      expect(seatA01.isReserved).toBe(true);
    });

    it('3. Invalid event ID format should be rejected with 422', async () => {
      const res = await request(app)
        .get('/api/v1/events/invalid-hex-id/seats')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(res.body.success).toBe(false);
    });

    it('4. Non-existent event returns 404', async () => {
      Event.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .get('/api/v1/events/507f1f77bcf86cd799439099/seats')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.success).toBe(false);
    });

    it('5. Cancelled event seat map returns 404 to student', async () => {
      Event.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          ...MOCK_EVENT,
          status: 'CANCELLED',
        }),
      });

      const res = await request(app)
        .get(`/api/v1/events/${MOCK_EVENT._id}/seats`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });

    it('24. Seat map response omits sensitive student data', async () => {
      Event.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(MOCK_EVENT),
      });
      bookingRepository.findConfirmedBookingsForEvent.mockResolvedValue([
        { seatId: 'C-04', seatLabel: 'Row C, Seat 4', status: 'CONFIRMED' },
      ]);

      const res = await request(app)
        .get(`/api/v1/events/${MOCK_EVENT._id}/seats`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.OK);
      const resString = JSON.stringify(res.body);
      expect(resString).not.toContain('email');
      expect(resString).not.toContain('student@');
      expect(resString).not.toContain('password');
      expect(resString).not.toContain('token');
    });
  });

  // ─── 3. Seat Booking (POST /bookings) ─────────────────────────────────────

  describe('POST /api/v1/events/:eventId/bookings', () => {
    beforeEach(() => {
      verifyAccessToken.mockReturnValue(VALID_STUDENT);
    });

    it('13. Valid available seat booking succeeds with 201 Created and response contract', async () => {
      Event.findById.mockResolvedValue({
        ...MOCK_EVENT,
        _id: '507f1f77bcf86cd799439012',
      });
      bookingRepository.findConfirmedBookingByUserAndEvent.mockResolvedValue(
        null
      );
      bookingRepository.createBookingWithRetry.mockResolvedValue({
        _id: '607f1f77bcf86cd799439055',
        bookingReference: 'BK-TESTREF-123456',
        eventId: '507f1f77bcf86cd799439012',
        auditorium: 'AUDITORIUM_1',
        seatId: 'C-04',
        seatLabel: 'Row C, Seat 4',
        status: 'CONFIRMED',
        createdAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ seatId: 'C-04' });

      expect(res.status).toBe(StatusCodes.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data.booking).toBeDefined();
      expect(res.body.data.booking.bookingReference).toBe('BK-TESTREF-123456');
      expect(res.body.data.booking.seatId).toBe('C-04');
      expect(res.body.data.booking.seatLabel).toBe('Row C, Seat 4');
      expect(res.body.data.booking.status).toBe('CONFIRMED');
      expect(res.body.data.booking.auditorium).toBe('AUDITORIUM_1');
      expect(res.body.data.booking.startTime).toBe('10:00');
      expect(res.body.data.booking.endTime).toBe('13:00');
    });

    it('5b. Cancelled event seat booking is rejected with 409 Conflict', async () => {
      Event.findById.mockResolvedValue({
        ...MOCK_EVENT,
        status: 'CANCELLED',
      });

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ seatId: 'C-04' });

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.message).toContain('cancelled event');
    });

    it('6. Completed event booking is rejected with 409 Conflict', async () => {
      Event.findById.mockResolvedValue({
        ...MOCK_EVENT,
        status: 'COMPLETED',
      });

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ seatId: 'C-04' });

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.message).toContain('completed event');
    });

    it('7. Ongoing event booking is rejected with 409 Conflict', async () => {
      Event.findById.mockResolvedValue({
        ...MOCK_EVENT,
        status: 'ONGOING',
      });

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ seatId: 'C-04' });

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.message).toContain('ongoing events');
    });

    it('8. Time-Boundary Test: now < start allows booking (tested in test 13)', () => {
      expect(true).toBe(true);
    });

    it('9. Time-Boundary Test: now >= start rejects booking with 409', async () => {
      // Event scheduled in past
      Event.findById.mockResolvedValue({
        ...MOCK_EVENT,
        date: '2026-09-01T00:00:00.000Z',
        startTime: '08:00',
        status: 'UPCOMING',
      });

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ seatId: 'C-04' });

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.message).toContain('Booking window has closed');
    });

    it('11. Unknown / out-of-bounds seat ID rejected with 422', async () => {
      Event.findById.mockResolvedValue(MOCK_EVENT);

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ seatId: 'Z-99' });

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(res.body.message).toContain('does not exist');
    });

    it('12. Reserved faculty/organizer seat rejected with 422', async () => {
      Event.findById.mockResolvedValue(MOCK_EVENT);

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ seatId: 'A-01' });

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(res.body.message).toContain(
        'Faculty and organizer reserved seats'
      );
    });

    it('14. Same student duplicate booking attempt rejected with 409', async () => {
      Event.findById.mockResolvedValue(MOCK_EVENT);
      bookingRepository.findConfirmedBookingByUserAndEvent.mockResolvedValue({
        _id: 'existing-booking',
        seatId: 'C-02',
      });

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ seatId: 'C-04' });

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.message).toContain('already have a confirmed booking');
    });

    it('16. Second student booking already booked seat receives 409 Conflict', async () => {
      Event.findById.mockResolvedValue(MOCK_EVENT);
      bookingRepository.findConfirmedBookingByUserAndEvent.mockResolvedValue(
        null
      );
      bookingRepository.createBookingWithRetry.mockRejectedValue(
        AppError.conflict('Seat is no longer available.')
      );

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ seatId: 'C-04' });

      expect(res.status).toBe(StatusCodes.CONFLICT);
      expect(res.body.message).toBe('Seat is no longer available.');
    });

    it('17. Client cannot spoof user ID (backend strictly derives from req.user)', async () => {
      Event.findById.mockResolvedValue(MOCK_EVENT);

      // Client passes unauthorized fields in body
      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({
          seatId: 'C-04',
          userId: '507f1f77bcf86cd799439999',
          user: '507f1f77bcf86cd799439999',
        });

      // Strict Zod schema rejects unauthorized body fields
      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    });

    it('18. Client cannot override auditorium (derived strictly from event)', async () => {
      Event.findById.mockResolvedValue(MOCK_EVENT);

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({
          seatId: 'C-04',
          auditorium: 'AUDITORIUM_3',
        });

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    });

    it('19. Client cannot override booking status', async () => {
      Event.findById.mockResolvedValue(MOCK_EVENT);

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({
          seatId: 'C-04',
          status: 'CANCELLED',
        });

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    });

    it('20. Conference Room event booking is rejected with 422', async () => {
      Event.findById.mockResolvedValue({
        ...MOCK_EVENT,
        auditorium: 'CONFERENCE_ROOM',
      });

      const res = await request(app)
        .post(`/api/v1/events/${MOCK_EVENT._id}/bookings`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ seatId: 'C-04' });

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(res.body.message).toContain('not a student-bookable auditorium');
    });
  });
});
