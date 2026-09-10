'use strict';

const request = require('supertest');
const { StatusCodes } = require('http-status-codes');
const app = require('../../src/app/app');
const {
  generateSecureTicketToken,
  buildTicketPayload,
  generateTicketQrCode,
} = require('../../src/modules/bookings/ticket.service');
const {
  buildBookingConfirmationEmailHtml,
  buildBookingConfirmationEmailText,
  sendBookingConfirmationEmail,
  setTransporter,
} = require('../../src/services/email.service');
const bookingRepository = require('../../src/modules/bookings/booking.repository');
const bookingService = require('../../src/modules/bookings/booking.service');
const Booking = require('../../src/modules/bookings/booking.model');
const Event = require('../../src/modules/events/event.model');
const { verifyAccessToken } = require('../../src/modules/auth/auth.helper');

jest.mock('../../src/modules/auth/auth.helper', () => ({
  verifyAccessToken: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
}));

jest.mock('../../src/modules/events/event.model', () => ({
  findById: jest.fn(),
}));

describe('SABMS Step 5 — QR Ticket Generation & Email Confirmation', () => {
  const STUDENT_1 = {
    id: '507f1f77bcf86cd799439011',
    sub: '507f1f77bcf86cd799439011',
    role: 'STUDENT',
    email: 'student1@university.edu',
    name: 'Alice Student',
  };

  const STUDENT_2 = {
    id: '507f1f77bcf86cd799439099',
    sub: '507f1f77bcf86cd799439099',
    role: 'STUDENT',
    email: 'student2@university.edu',
    name: 'Bob Student',
  };

  const MOCK_EVENT = {
    _id: '507f1f77bcf86cd799439012',
    name: 'National Technology Conclave 2026',
    auditorium: 'AUDITORIUM_1',
    date: '2026-09-25T00:00:00.000Z',
    startTime: '10:00',
    endTime: '13:00',
    status: 'UPCOMING',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── 1. SECURE TICKET TOKEN GENERATION ────────────────────────────────────
  describe('1. Secure Ticket Token Generation', () => {
    it('generates a token with prefix "tkt_" and exactly 64 hex characters (256-bit entropy)', () => {
      const token = generateSecureTicketToken();
      expect(typeof token).toBe('string');
      expect(token).toMatch(/^tkt_[0-9a-f]{64}$/);
      expect(token.length).toBe(68); // 'tkt_' (4) + 64 hex chars
    });

    it('generates cryptographically distinct tokens with zero predictability', () => {
      const tokens = new Set();
      const iterations = 50;
      for (let i = 0; i < iterations; i += 1) {
        const t = generateSecureTicketToken();
        tokens.add(t);
      }
      expect(tokens.size).toBe(iterations);
    });
  });

  // ─── 2. QR PAYLOAD GENERATION & OPAQUE TOKEN SECURITY ─────────────────────
  describe('2. QR Payload & Data Sanitization', () => {
    it('builds an opaque payload containing only token and reference', () => {
      const token = generateSecureTicketToken();
      const reference = 'BK-LMF8X2-A4B7C9';

      const payloadString = buildTicketPayload({
        ticketToken: token,
        bookingReference: reference,
      });

      const parsed = JSON.parse(payloadString);
      expect(parsed).toEqual({
        t: token,
        ref: reference,
      });
    });

    it('strictly does NOT encode sensitive fields (passwords, JWTs, student PII, database internals)', () => {
      const token = generateSecureTicketToken();
      const payloadString = buildTicketPayload({
        ticketToken: token,
        bookingReference: 'BK-TEST-123456',
        password: 'SuperSecretPassword',
        jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        mongoId: '607f1f77bcf86cd799439055',
        email: 'student@university.edu',
      });

      expect(payloadString).not.toContain('SuperSecretPassword');
      expect(payloadString).not.toContain('eyJhbGci');
      expect(payloadString).not.toContain('student@university.edu');
      expect(payloadString).not.toContain('607f1f77bcf86cd799439055');
    });

    it('generates a valid QR DataURL and PNG Buffer from ticket payload', async () => {
      const token = generateSecureTicketToken();
      const { dataUrl, buffer } = await generateTicketQrCode({
        ticketToken: token,
        bookingReference: 'BK-QR-TEST-001',
      });

      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(100);
    });
  });

  // ─── 3. BOOKING CONFIRMATION EMAIL COMPOSITION ────────────────────────────
  describe('3. Booking Confirmation Email Composition', () => {
    const mockBooking = {
      bookingReference: 'BK-CONFIRM-999',
      auditoriumName: 'Auditorium 1',
      seatLabel: 'Row C, Seat 4',
      seatId: 'C-04',
      status: 'CONFIRMED',
    };

    it('HTML email template contains all required booking details without secrets', () => {
      const html = buildBookingConfirmationEmailHtml({
        name: 'Alice Student',
        booking: mockBooking,
        event: MOCK_EVENT,
      });

      expect(html).toContain('Alice Student');
      expect(html).toContain('National Technology Conclave 2026');
      expect(html).toContain('BK-CONFIRM-999');
      expect(html).toContain('Row C, Seat 4');
      expect(html).toContain('C-04');
      expect(html).toContain('Auditorium 1');
      expect(html).toContain('CONFIRMED');
      expect(html).toContain('cid:booking-ticket-qr');
      expect(html).toContain('Your auditorium booking is confirmed');

      // Security check: no credentials or internal IDs
      expect(html).not.toContain('password');
      expect(html).not.toContain('tkt_');
      expect(html).not.toContain('Bearer');
    });

    it('plain-text email template contains structured booking details', () => {
      const text = buildBookingConfirmationEmailText({
        name: 'Alice Student',
        booking: mockBooking,
        event: MOCK_EVENT,
      });

      expect(text).toContain('Hello Alice Student');
      expect(text).toContain('BK-CONFIRM-999');
      expect(text).toContain('National Technology Conclave 2026');
      expect(text).toContain('Row C, Seat 4');
      expect(text).toContain('Auditorium 1');
      expect(text).toContain('CONFIRMED');
      expect(text).not.toContain('password');
      expect(text).not.toContain('tkt_');
    });
  });

  // ─── 4. EMAIL SERVICE DISPATCH & FAILURE RESILIENCE ───────────────────────
  describe('4. Email Service Dispatch & Failure Handling', () => {
    afterEach(() => {
      setTransporter(null); // Reset transporter
    });

    it('returns success and messageId when transporter succeeds', async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({
          messageId: '<mock-msg-id-12345@sabms.edu>',
        }),
      };
      setTransporter(mockTransporter);

      const result = await sendBookingConfirmationEmail({
        to: 'student@university.edu',
        name: 'Student Name',
        booking: { bookingReference: 'BK-123' },
        event: { name: 'Tech Fest' },
        qrBuffer: Buffer.from('fake-qr-bytes'),
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('<mock-msg-id-12345@sabms.edu>');
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const sentMailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentMailOptions.to).toBe('student@university.edu');
      expect(sentMailOptions.attachments[0].cid).toBe('booking-ticket-qr');
    });

    it('handles transporter failure gracefully without throwing', async () => {
      const mockTransporter = {
        sendMail: jest
          .fn()
          .mockRejectedValue(new Error('SMTP Connection Timeout')),
      };
      setTransporter(mockTransporter);

      const result = await sendBookingConfirmationEmail({
        to: 'student@university.edu',
        name: 'Student Name',
        booking: { bookingReference: 'BK-123' },
        event: { name: 'Tech Fest' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP Connection Timeout');
    });

    it('returns failure when recipient email is missing', async () => {
      const result = await sendBookingConfirmationEmail({
        to: '',
        booking: { bookingReference: 'BK-123' },
        event: { name: 'Tech Fest' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Recipient email, booking data, and event data are required'
      );
    });
  });

  // ─── 5. BOOKING TO TICKET ASSOCIATION & AUTHORITATIVE STATUS ───────────────
  describe('5. Booking Service bookSeat Integration', () => {
    it('creates booking with ticket token, QR code, and truthful email status', async () => {
      Event.findById.mockResolvedValue({
        ...MOCK_EVENT,
        _id: '507f1f77bcf86cd799439012',
      });

      const mockBookingRecord = {
        _id: '607f1f77bcf86cd799439055',
        bookingReference: 'BK-TEST-555555',
        ticketToken:
          'tkt_1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
        ticketIssuedAt: new Date('2026-09-10T12:00:00.000Z'),
        eventId: '507f1f77bcf86cd799439012',
        auditorium: 'AUDITORIUM_1',
        seatId: 'C-04',
        seatLabel: 'Row C, Seat 4',
        status: 'CONFIRMED',
        createdAt: new Date('2026-09-10T12:00:00.000Z'),
        toObject: () => ({
          _id: '607f1f77bcf86cd799439055',
          bookingReference: 'BK-TEST-555555',
          auditorium: 'AUDITORIUM_1',
          seatId: 'C-04',
          seatLabel: 'Row C, Seat 4',
          status: 'CONFIRMED',
        }),
      };

      jest
        .spyOn(bookingRepository, 'findConfirmedBookingByUserAndEvent')
        .mockResolvedValue(null);
      jest
        .spyOn(bookingRepository, 'createBookingWithRetry')
        .mockResolvedValue(mockBookingRecord);
      jest
        .spyOn(bookingRepository, 'updateBookingEmailStatus')
        .mockResolvedValue({});

      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: '<test-email-id>' }),
      };
      setTransporter(mockTransporter);

      const result = await bookingService.bookSeat({
        eventId: '507f1f77bcf86cd799439012',
        userId: STUDENT_1.id,
        user: STUDENT_1,
        seatId: 'C-04',
      });

      expect(result.status).toBe('CONFIRMED');
      expect(result.bookingReference).toBe('BK-TEST-555555');
      expect(result.ticket).toBeDefined();
      expect(result.ticket.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(result.ticket.issuedAt).toBeDefined();
      expect(result.emailDelivery.status).toBe('SENT');
      // Raw ticketToken is not exposed in public response
      expect(result.ticketToken).toBeUndefined();
    });

    it('booking remains CONFIRMED when email delivery fails', async () => {
      Event.findById.mockResolvedValue({
        ...MOCK_EVENT,
        _id: '507f1f77bcf86cd799439012',
      });

      const mockBookingRecord = {
        _id: '607f1f77bcf86cd799439056',
        bookingReference: 'BK-FAIL-EMAIL',
        ticketToken:
          'tkt_abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        eventId: '507f1f77bcf86cd799439012',
        auditorium: 'AUDITORIUM_1',
        seatId: 'D-10',
        seatLabel: 'Row D, Seat 10',
        status: 'CONFIRMED',
        createdAt: new Date(),
        toObject: () => ({
          _id: '607f1f77bcf86cd799439056',
          bookingReference: 'BK-FAIL-EMAIL',
          auditorium: 'AUDITORIUM_1',
          seatId: 'D-10',
          seatLabel: 'Row D, Seat 10',
          status: 'CONFIRMED',
        }),
      };

      jest
        .spyOn(bookingRepository, 'findConfirmedBookingByUserAndEvent')
        .mockResolvedValue(null);
      jest
        .spyOn(bookingRepository, 'createBookingWithRetry')
        .mockResolvedValue(mockBookingRecord);
      jest
        .spyOn(bookingRepository, 'updateBookingEmailStatus')
        .mockResolvedValue({});

      // Transporter rejects with error
      const mockTransporter = {
        sendMail: jest.fn().mockRejectedValue(new Error('Connection dropped')),
      };
      setTransporter(mockTransporter);

      const result = await bookingService.bookSeat({
        eventId: '507f1f77bcf86cd799439012',
        userId: STUDENT_1.id,
        user: STUDENT_1,
        seatId: 'D-10',
      });

      expect(result.status).toBe('CONFIRMED');
      expect(result.seatId).toBe('D-10');
      expect(result.emailDelivery.status).toBe('FAILED');
      expect(result.ticket.qrCode).toMatch(/^data:image\/png;base64,/);
    });
  });

  // ─── 6. HTTP ENDPOINT: GET /api/v1/bookings/:bookingId/ticket ─────────────
  describe('6. HTTP Endpoint: GET /api/v1/bookings/:bookingId/ticket', () => {
    const BOOKING_ID = '607f1f77bcf86cd799439088';

    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get(
        `/api/v1/bookings/${BOOKING_ID}/ticket`
      );
      expect(res.status).toBe(StatusCodes.UNAUTHORIZED);
      expect(res.body.success).toBe(false);
    });

    it('rejects request if booking does not exist with 404 Not Found', async () => {
      verifyAccessToken.mockReturnValue(STUDENT_1);
      jest.spyOn(bookingRepository, 'findBookingById').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/bookings/${BOOKING_ID}/ticket`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(StatusCodes.NOT_FOUND);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Booking not found');
    });

    it('rejects another student accessing the ticket with 403 Forbidden (IDOR Protection)', async () => {
      // Authenticated as STUDENT_2
      verifyAccessToken.mockReturnValue(STUDENT_2);

      // But booking belongs to STUDENT_1
      jest.spyOn(bookingRepository, 'findBookingById').mockResolvedValue({
        _id: BOOKING_ID,
        user: STUDENT_1.id, // belongs to STUDENT_1
        eventId: MOCK_EVENT._id,
        bookingReference: 'BK-TEST-IDOR',
        ticketToken: generateSecureTicketToken(),
        auditorium: 'AUDITORIUM_1',
        seatId: 'C-04',
        seatLabel: 'Row C, Seat 4',
        status: 'CONFIRMED',
      });

      const res = await request(app)
        .get(`/api/v1/bookings/${BOOKING_ID}/ticket`)
        .set('Authorization', 'Bearer valid-token-student-2');

      expect(res.status).toBe(StatusCodes.FORBIDDEN);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('permission');
    });

    it('allows booking owner to retrieve ticket with 200 OK and QR code', async () => {
      verifyAccessToken.mockReturnValue(STUDENT_1);

      const token = generateSecureTicketToken();
      jest.spyOn(bookingRepository, 'findBookingById').mockResolvedValue({
        _id: BOOKING_ID,
        user: STUDENT_1.id, // belongs to STUDENT_1
        eventId: MOCK_EVENT._id,
        bookingReference: 'BK-OWNER-SUCCESS',
        ticketToken: token,
        auditorium: 'AUDITORIUM_1',
        seatId: 'C-04',
        seatLabel: 'Row C, Seat 4',
        status: 'CONFIRMED',
        ticketIssuedAt: new Date('2026-09-10T14:00:00.000Z'),
      });

      Event.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(MOCK_EVENT),
      });

      const res = await request(app)
        .get(`/api/v1/bookings/${BOOKING_ID}/ticket`)
        .set('Authorization', 'Bearer valid-token-student-1');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticket).toBeDefined();
      expect(res.body.data.ticket.bookingReference).toBe('BK-OWNER-SUCCESS');
      expect(res.body.data.ticket.eventName).toBe(MOCK_EVENT.name);
      expect(res.body.data.ticket.seatLabel).toBe('Row C, Seat 4');
      expect(res.body.data.ticket.qrCode).toMatch(/^data:image\/png;base64,/);
      // Raw token is NOT in public ticket response
      expect(res.body.data.ticket.ticketToken).toBeUndefined();
    });

    it('allows ADMIN to access ticket for any student', async () => {
      const ADMIN = {
        id: '507f1f77bcf86cd799439090',
        sub: '507f1f77bcf86cd799439090',
        role: 'ADMIN',
      };
      verifyAccessToken.mockReturnValue(ADMIN);

      jest.spyOn(bookingRepository, 'findBookingById').mockResolvedValue({
        _id: BOOKING_ID,
        user: STUDENT_1.id,
        eventId: MOCK_EVENT._id,
        bookingReference: 'BK-ADMIN-ACCESS',
        ticketToken: generateSecureTicketToken(),
        auditorium: 'AUDITORIUM_1',
        seatId: 'C-04',
        seatLabel: 'Row C, Seat 4',
        status: 'CONFIRMED',
      });

      Event.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(MOCK_EVENT),
      });

      const res = await request(app)
        .get(`/api/v1/bookings/${BOOKING_ID}/ticket`)
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ticket.bookingReference).toBe('BK-ADMIN-ACCESS');
    });
  });

  // ─── 7. DATABASE MODEL & UNIQUE INDEX PROTECTION ──────────────────────────
  describe('7. Booking Model Schema & Index Constraints', () => {
    it('ticketToken field in schema is configured as sparse and unique', () => {
      const ticketTokenPath = Booking.schema.paths.ticketToken;
      expect(ticketTokenPath).toBeDefined();
      expect(ticketTokenPath.options.sparse).toBe(true);
      expect(ticketTokenPath.options.unique).toBe(true);
      expect(ticketTokenPath.options.select).toBe(false);
    });

    it('emailStatus field defaults to PENDING with valid enum values', () => {
      const emailStatusPath = Booking.schema.paths.emailStatus;
      expect(emailStatusPath).toBeDefined();
      expect(emailStatusPath.options.default).toBe('PENDING');
      expect(emailStatusPath.options.enum.values).toContain('PENDING');
      expect(emailStatusPath.options.enum.values).toContain('SENT');
      expect(emailStatusPath.options.enum.values).toContain('FAILED');
      expect(emailStatusPath.options.enum.values).toContain('NOT_CONFIGURED');
    });

    it('toJSON transform strips ticketToken to prevent data leak', () => {
      const doc = new Booking({
        eventId: '507f1f77bcf86cd799439012',
        user: '507f1f77bcf86cd799439011',
        auditorium: 'AUDITORIUM_1',
        seatId: 'C-04',
        seatLabel: 'Row C, Seat 4',
        bookingReference: 'BK-LEAK-TEST',
        ticketToken: 'tkt_secret_token_12345',
      });

      const json = doc.toJSON();
      expect(json.ticketToken).toBeUndefined();
      expect(json.bookingReference).toBe('BK-LEAK-TEST');
    });
  });
});
