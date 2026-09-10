'use strict';

const mongoose = require('mongoose');
const Booking = require('../../src/modules/bookings/booking.model');
const Event = require('../../src/modules/events/event.model');
const { bookSeat } = require('../../src/modules/bookings/booking.service');
const {
  BOOKING_STATUS,
} = require('../../src/modules/bookings/booking.constants');

const TEST_MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/sabms_db';

describe('Booking Database Concurrency & Index Integration Tests', () => {
  let testEvent;
  const studentA = new mongoose.Types.ObjectId().toString();
  const studentB = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGODB_URI);
    }

    // Ensure all indexes are built
    await Booking.init();

    // Create a temporary test event scheduled in the future
    testEvent = await Event.create({
      name: 'Concurrency Test Event [Automated]',
      description:
        'Temporary event for testing concurrency and unique partial indexes.',
      auditorium: 'AUDITORIUM_1',
      date: new Date('2026-10-01T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '12:00',
      status: 'UPCOMING',
      totalSeats: 312,
      availableSeats: 312,
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testEvent?._id) {
      await Booking.deleteMany({ eventId: testEvent._id });
      await Event.deleteOne({ _id: testEvent._id });
    }
    await mongoose.connection.close();
  });

  // ─── 1. Real Index Verification ───────────────────────────────────────────

  describe('Real Database Index Verification', () => {
    it('should verify actual MongoDB collection indexes exist and are unique/partial', async () => {
      const indexes = await Booking.collection.indexes();

      // Check unique active event-seat index
      const seatIndex = indexes.find(
        (idx) => idx.key.eventId === 1 && idx.key.seatId === 1
      );
      expect(seatIndex).toBeDefined();
      expect(seatIndex.unique).toBe(true);
      expect(seatIndex.partialFilterExpression).toEqual({
        status: BOOKING_STATUS.CONFIRMED,
      });

      // Check unique active event-user index
      const userIndex = indexes.find(
        (idx) => idx.key.eventId === 1 && idx.key.user === 1
      );
      expect(userIndex).toBeDefined();
      expect(userIndex.unique).toBe(true);
      expect(userIndex.partialFilterExpression).toEqual({
        status: BOOKING_STATUS.CONFIRMED,
      });

      // Check bookingReference unique index
      const refIndex = indexes.find((idx) => idx.key.bookingReference === 1);
      expect(refIndex).toBeDefined();
      expect(refIndex.unique).toBe(true);
    });
  });

  // ─── 2. Real Concurrent Booking on Same Seat ──────────────────────────────

  describe('Atomic Double-Booking Protection (Real Concurrency)', () => {
    it('should allow exactly one student to book C-04 concurrently, and reject the second with 409', async () => {
      const targetSeat = 'C-04';

      // Fire concurrent requests simultaneously
      const results = await Promise.allSettled([
        bookSeat({
          eventId: testEvent._id.toString(),
          userId: studentA,
          seatId: targetSeat,
        }),
        bookSeat({
          eventId: testEvent._id.toString(),
          userId: studentB,
          seatId: targetSeat,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one succeeds
      expect(fulfilled).toHaveLength(1);
      expect(fulfilled[0].value.seatId).toBe('C-04');
      expect(fulfilled[0].value.status).toBe('CONFIRMED');

      // Exactly one fails with HTTP 409 Conflict
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason.statusCode).toBe(409);
      expect(rejected[0].reason.message).toBe('Seat is no longer available.');

      // Verify the database contains exactly one CONFIRMED booking for that seat
      const dbBookings = await Booking.find({
        eventId: testEvent._id,
        seatId: targetSeat,
        status: BOOKING_STATUS.CONFIRMED,
      });
      expect(dbBookings).toHaveLength(1);
    });

    it('should reject same student attempting to book a second seat for the same event with 409', async () => {
      // Find which student won C-04 in the concurrent race
      const winningBooking = await Booking.findOne({
        eventId: testEvent._id,
        seatId: 'C-04',
        status: BOOKING_STATUS.CONFIRMED,
      });
      expect(winningBooking).toBeDefined();
      const winningStudent = winningBooking.user.toString();

      // The winning student attempts to book a second seat (C-05)
      await expect(
        bookSeat({
          eventId: testEvent._id.toString(),
          userId: winningStudent,
          seatId: 'C-05',
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'You already have a confirmed booking for this event.',
      });

      // Verify winning student still holds only 1 confirmed seat in DB
      const studentBookings = await Booking.find({
        eventId: testEvent._id,
        user: winningStudent,
        status: BOOKING_STATUS.CONFIRMED,
      });
      expect(studentBookings).toHaveLength(1);
      expect(studentBookings[0].seatId).toBe('C-04');
    });

    it('should allow booking of a seat previously CANCELLED without conflict', async () => {
      // Find the existing confirmed booking and mark it CANCELLED
      const existing = await Booking.findOne({
        eventId: testEvent._id,
        seatId: 'C-04',
        status: BOOKING_STATUS.CONFIRMED,
      });
      expect(existing).toBeDefined();

      await Booking.updateOne(
        { _id: existing._id },
        { status: BOOKING_STATUS.CANCELLED }
      );

      // A different student should now be able to book C-04 successfully
      const freshStudent = new mongoose.Types.ObjectId().toString();
      const booking = await bookSeat({
        eventId: testEvent._id.toString(),
        userId: freshStudent,
        seatId: 'C-04',
      });

      expect(booking.seatId).toBe('C-04');
      expect(booking.status).toBe('CONFIRMED');

      // In DB: exactly one CONFIRMED booking for C-04 exists
      const confirmedForC04 = await Booking.find({
        eventId: testEvent._id,
        seatId: 'C-04',
        status: BOOKING_STATUS.CONFIRMED,
      });
      expect(confirmedForC04).toHaveLength(1);
      expect(confirmedForC04[0].user.toString()).toBe(freshStudent);
    });
  });
});
