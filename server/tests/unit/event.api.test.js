'use strict';

const request = require('supertest');
const app = require('../../src/app/app');
const { StatusCodes } = require('http-status-codes');

/**
 * Event API Tests
 *
 * Tests the student event discovery endpoints:
 * - GET /api/v1/events
 * - GET /api/v1/events/:eventId
 *
 * These tests validate authentication requirements, response structure,
 * input validation, and security filtering (no completed/cancelled/conference events).
 */

// Mock the auth middleware to simulate authenticated and unauthenticated states
jest.mock('../../src/modules/auth/auth.helper', () => ({
  verifyAccessToken: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
}));

const { verifyAccessToken } = require('../../src/modules/auth/auth.helper');

// Mock the event repository for isolated unit testing
jest.mock('../../src/modules/events/event.repository', () => ({
  findVisibleEvents: jest.fn(),
  findEventById: jest.fn(),
}));

const eventRepository = require('../../src/modules/events/event.repository');

const VALID_TOKEN = 'valid-test-token';
const VALID_USER = {
  sub: '507f1f77bcf86cd799439011',
  id: '507f1f77bcf86cd799439011',
  role: 'STUDENT',
  email: 'student@test.com',
};

const MOCK_EVENT = {
  _id: '507f1f77bcf86cd799439012',
  name: 'AI Workshop [Demo]',
  description: 'A hands-on workshop for SABMS testing purposes.',
  auditorium: 'AUDITORIUM_1',
  auditoriumName: 'Auditorium 1',
  date: '2026-09-20T00:00:00.000Z',
  startTime: '10:00',
  endTime: '13:00',
  status: 'UPCOMING',
  totalSeats: 312,
  availableSeats: 312,
  image: null,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};

describe('Event API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Authentication Tests ───────────────────────────────────────────────────

  describe('Authentication', () => {
    it('GET /api/v1/events should return 401 without authentication token', async () => {
      const res = await request(app).get('/api/v1/events');

      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/events/:eventId should return 401 without authentication token', async () => {
      const res = await request(app).get(
        '/api/v1/events/507f1f77bcf86cd799439012'
      );

      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/events should return 401 with invalid token', async () => {
      verifyAccessToken.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const res = await request(app)
        .get('/api/v1/events')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  // ─── Role-Based Access Control Tests ────────────────────────────────────────

  describe('Role-Based Authorization', () => {
    it('GET /api/v1/events should return 403 Forbidden for non-student roles (FACULTY)', async () => {
      verifyAccessToken.mockReturnValue({
        sub: '507f1f77bcf86cd799439099',
        id: '507f1f77bcf86cd799439099',
        role: 'FACULTY',
        email: 'faculty@miet.ac.in',
      });

      const res = await request(app)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/events should return 403 Forbidden for non-student roles (ADMIN)', async () => {
      verifyAccessToken.mockReturnValue({
        sub: '507f1f77bcf86cd799439099',
        id: '507f1f77bcf86cd799439099',
        role: 'ADMIN',
        email: 'admin@miet.ac.in',
      });

      const res = await request(app)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/events/:eventId should return 403 Forbidden for non-student roles', async () => {
      verifyAccessToken.mockReturnValue({
        sub: '507f1f77bcf86cd799439099',
        id: '507f1f77bcf86cd799439099',
        role: 'CLUB_MEMBER',
        email: 'club@miet.ac.in',
      });

      const res = await request(app)
        .get('/api/v1/events/507f1f77bcf86cd799439012')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── List Events Tests ──────────────────────────────────────────────────────

  describe('GET /api/v1/events', () => {
    beforeEach(() => {
      verifyAccessToken.mockReturnValue(VALID_USER);
    });

    it('should return events for authenticated student', async () => {
      eventRepository.findVisibleEvents.mockResolvedValue({
        events: [MOCK_EVENT],
        pagination: {
          page: 1,
          limit: 12,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.events).toHaveLength(1);
      expect(res.body.data.events[0].name).toBe(MOCK_EVENT.name);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.total).toBe(1);
    });

    it('should return empty array when no events exist', async () => {
      eventRepository.findVisibleEvents.mockResolvedValue({
        events: [],
        pagination: {
          page: 1,
          limit: 12,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.events).toHaveLength(0);
    });

    it('should pass validated query params to repository', async () => {
      eventRepository.findVisibleEvents.mockResolvedValue({
        events: [],
        pagination: {
          page: 2,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      await request(app)
        .get(
          '/api/v1/events?page=2&limit=10&status=UPCOMING&auditorium=AUDITORIUM_1'
        )
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(eventRepository.findVisibleEvents).toHaveBeenCalledTimes(1);
      const callArgs = eventRepository.findVisibleEvents.mock.calls[0][0];
      expect(callArgs.status).toBe('UPCOMING');
      expect(callArgs.auditorium).toBe('AUDITORIUM_1');
      // Query params may be string or number depending on Zod/Express interaction
      expect(Number(callArgs.page)).toBe(2);
      expect(Number(callArgs.limit)).toBe(10);
    });

    it('should not allow COMPLETED status in query', async () => {
      const res = await request(app)
        .get('/api/v1/events?status=COMPLETED')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    });

    it('should not allow CANCELLED status in query', async () => {
      const res = await request(app)
        .get('/api/v1/events?status=CANCELLED')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    });

    it('should not allow CONFERENCE_ROOM in auditorium query', async () => {
      const res = await request(app)
        .get('/api/v1/events?auditorium=CONFERENCE_ROOM')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    });
  });

  // ─── Get Event By ID Tests ──────────────────────────────────────────────────

  describe('GET /api/v1/events/:eventId', () => {
    beforeEach(() => {
      verifyAccessToken.mockReturnValue(VALID_USER);
    });

    it('should return event details for valid event ID', async () => {
      eventRepository.findEventById.mockResolvedValue(MOCK_EVENT);

      const res = await request(app)
        .get(`/api/v1/events/${MOCK_EVENT._id}`)
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.event.name).toBe(MOCK_EVENT.name);
      expect(res.body.data.event.auditoriumName).toBe('Auditorium 1');
      expect(res.body.data.event.totalSeats).toBe(312);
    });

    it('should return 404 for non-existent event', async () => {
      eventRepository.findEventById.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/events/507f1f77bcf86cd799439099')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.success).toBe(false);
    });

    it('should return 422 for invalid event ID format', async () => {
      const res = await request(app)
        .get('/api/v1/events/invalid-id')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(res.body.success).toBe(false);
    });

    it('should return 422 for too-short event ID', async () => {
      const res = await request(app)
        .get('/api/v1/events/abc123')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    });

    it('should not expose completed event', async () => {
      // The repository enforces this, but verify the controller returns 404
      eventRepository.findEventById.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/events/507f1f77bcf86cd799439012')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });

    it('should not expose cancelled event', async () => {
      // The repository enforces this, but verify the controller returns 404
      eventRepository.findEventById.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/events/507f1f77bcf86cd799439012')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
    });
  });
});
