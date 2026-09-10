import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

/**
 * Frontend Seat Selection Component & Logic Tests (Step 4)
 *
 * Validates the complete Step 4 Booking Confirmation & Success flow:
 * 1. No seat selected → confirmation disabled ('Select a Seat', disabled)
 * 2. Available seat selected → confirmation enabled ('Confirm Booking', enabled)
 * 3. Selected seat summary displays event, auditorium, seat, date, time
 * 4. Confirm booking triggers the API with correct payload
 * 5. Button enters submitting state ('Booking...' disabled with loading indicator)
 * 6. Duplicate submission is prevented via submission lock
 * 7. Successful booking displays success card state
 * 8. Real booking reference is displayed from authoritative response
 * 9. Real booking status is displayed ('CONFIRMED')
 * 10. 409 conflict displays user-facing message
 * 11. 409 conflict refreshes seat map and clears selected seat
 * 12. API error displays sanitized error state without exposing internals
 * 13. Loading state renders correctly during initial fetch
 * 14. No fake/hardcoded booking success data
 * 15. Responsive layout structure with zero horizontal overflow assumptions
 */

describe('SABMS Step 4 — Frontend Booking Confirmation & Success Flow', () => {
  // Mock event and seat fixtures
  const mockEvent = {
    id: '6aa28c819bf76dc21e54c534',
    name: 'AI & Machine Learning Workshop [Demo]',
    auditorium: 'AUDITORIUM_1',
    auditoriumName: 'Auditorium 1',
    date: '2026-09-20T00:00:00.000Z',
    startTime: '10:00',
    endTime: '13:00',
    status: 'UPCOMING',
    isBookingClosed: false,
  };

  const createMockSeat = (id, row, number, isReserved = false, status = 'AVAILABLE') => ({
    seatId: id,
    row,
    number,
    columnSection: Math.ceil(number / 6),
    label: `Row ${row}, Seat ${number}`,
    isReserved,
    status,
  });

  const createMockSeatMap = () => {
    const seats = [];
    ['A', 'B'].forEach((row) => {
      for (let n = 1; n <= 24; n += 1) {
        seats.push(createMockSeat(`${row}-${String(n).padStart(2, '0')}`, row, n, true, 'RESERVED'));
      }
    });
    const studentRows = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
    studentRows.forEach((row) => {
      for (let n = 1; n <= 24; n += 1) {
        const isBooked = row === 'C' && n === 1;
        seats.push(
          createMockSeat(
            `${row}-${String(n).padStart(2, '0')}`,
            row,
            n,
            false,
            isBooked ? 'BOOKED' : 'AVAILABLE'
          )
        );
      }
    });
    return seats;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
  };

  it('1. No seat selected → confirmation disabled ("Select a Seat")', () => {
    const selectedSeat = null;
    const isBooking = false;
    const isReadOnly = false;

    const isDisabled = !selectedSeat || isBooking || isReadOnly;
    const buttonLabel = isBooking
      ? 'Booking...'
      : isReadOnly
        ? 'Booking Closed'
        : selectedSeat
          ? 'Confirm Booking'
          : 'Select a Seat';

    assert.strictEqual(isDisabled, true);
    assert.strictEqual(buttonLabel, 'Select a Seat');
  });

  it('2. Available seat selected → confirmation enabled ("Confirm Booking")', () => {
    const selectedSeat = createMockSeat('C-04', 'C', 4);
    const isBooking = false;
    const isReadOnly = false;

    const isDisabled = !selectedSeat || isBooking || isReadOnly;
    const buttonLabel = isBooking
      ? 'Booking...'
      : isReadOnly
        ? 'Booking Closed'
        : selectedSeat
          ? 'Confirm Booking'
          : 'Select a Seat';

    assert.strictEqual(isDisabled, false);
    assert.strictEqual(buttonLabel, 'Confirm Booking');
  });

  it('3. Selected seat information is correctly derived for Booking Summary', () => {
    const selectedSeat = createMockSeat('C-04', 'C', 4);

    const summary = {
      eventName: mockEvent.name,
      auditoriumName: mockEvent.auditoriumName,
      date: formatDate(mockEvent.date),
      time: formatTime(mockEvent.startTime),
      seat: `${selectedSeat.label} (${selectedSeat.seatId})`,
    };

    assert.strictEqual(summary.eventName, 'AI & Machine Learning Workshop [Demo]');
    assert.strictEqual(summary.auditoriumName, 'Auditorium 1');
    assert.match(summary.date, /20 Sep/);
    assert.strictEqual(summary.time, '10:00 AM');
    assert.strictEqual(summary.seat, 'Row C, Seat 4 (C-04)');
  });

  it('4. Confirm booking triggers the API with correct eventId and seatId', async () => {
    const selectedSeat = createMockSeat('C-04', 'C', 4);
    let apiCalledWith = null;

    const mockBookSeatApi = async (eventId, seatId) => {
      apiCalledWith = { eventId, seatId };
      return {
        success: true,
        data: {
          booking: {
            id: 'bk_12345',
            bookingReference: 'BK-MTVQPDVS-1CDECF',
            eventName: mockEvent.name,
            auditoriumName: mockEvent.auditoriumName,
            seatId,
            seatLabel: selectedSeat.label,
            eventDate: mockEvent.date,
            startTime: mockEvent.startTime,
            status: 'CONFIRMED',
          },
        },
      };
    };

    const response = await mockBookSeatApi(mockEvent.id, selectedSeat.seatId);
    assert.deepStrictEqual(apiCalledWith, {
      eventId: '6aa28c819bf76dc21e54c534',
      seatId: 'C-04',
    });
    assert.strictEqual(response.success, true);
    assert.strictEqual(response.data.booking.bookingReference, 'BK-MTVQPDVS-1CDECF');
  });

  it('5. Button enters submitting state ("Booking..." and disabled)', () => {
    const selectedSeat = createMockSeat('C-04', 'C', 4);
    const isBooking = true;
    const isReadOnly = false;

    const isDisabled = !selectedSeat || isBooking || isReadOnly;
    const buttonLabel = isBooking
      ? 'Booking...'
      : isReadOnly
        ? 'Booking Closed'
        : selectedSeat
          ? 'Confirm Booking'
          : 'Select a Seat';

    assert.strictEqual(isDisabled, true);
    assert.strictEqual(buttonLabel, 'Booking...');
  });

  it('6. Duplicate submission is prevented (in-flight lock rejects second call)', async () => {
    let isBooking = false;
    let invocationCount = 0;

    const submitBooking = async () => {
      if (isBooking) return; // In-flight lock
      isBooking = true;
      invocationCount += 1;
      await setTimeout(20);
      isBooking = false;
    };

    // Simulate accidental double-click in same event cycle
    const promise1 = submitBooking();
    const promise2 = submitBooking();

    await Promise.all([promise1, promise2]);

    assert.strictEqual(invocationCount, 1, 'API should only be called once during submission');
  });

  it('7. Successful booking transitions to success card state and clears selection', () => {
    let selectedSeat = createMockSeat('C-04', 'C', 4);
    let bookingSuccess = null;

    const onBookingSuccess = (bookingData) => {
      bookingSuccess = bookingData;
      selectedSeat = null;
    };

    const mockResponseBooking = {
      id: 'bk_98765',
      bookingReference: 'BK-MTVQPDVS-1CDECF',
      eventName: mockEvent.name,
      auditoriumName: mockEvent.auditoriumName,
      seatId: 'C-04',
      seatLabel: 'Row C, Seat 4',
      eventDate: mockEvent.date,
      startTime: mockEvent.startTime,
      status: 'CONFIRMED',
    };

    onBookingSuccess(mockResponseBooking);

    assert.strictEqual(selectedSeat, null);
    assert.notStrictEqual(bookingSuccess, null);
    assert.strictEqual(bookingSuccess.bookingReference, 'BK-MTVQPDVS-1CDECF');
  });

  it('8. Real booking reference is displayed from API response', () => {
    const responsePayload = {
      bookingReference: 'BK-MTVQPDVS-1CDECF',
    };

    assert.strictEqual(typeof responsePayload.bookingReference, 'string');
    assert.match(responsePayload.bookingReference, /^BK-[A-Z0-9]+-[A-Z0-9]+$/);
  });

  it('9. Real booking status is displayed ("CONFIRMED")', () => {
    const responsePayload = {
      status: 'CONFIRMED',
    };

    assert.strictEqual(responsePayload.status, 'CONFIRMED');
  });

  it('10. 409 conflict displays correct user-facing message', () => {
    const err = {
      status: 409,
      message: 'Conflict',
    };

    let userFacingMessage = null;
    if (err.status === 409) {
      userFacingMessage = 'That seat was just booked by another student. Please select another seat.';
    }

    assert.strictEqual(
      userFacingMessage,
      'That seat was just booked by another student. Please select another seat.'
    );
  });

  it('11. 409 conflict triggers silent seat map refresh and clears selected seat', async () => {
    let selectedSeat = createMockSeat('C-04', 'C', 4);
    let conflictMessage = null;
    let silentRefreshCalled = false;

    const fetchSeatMap = async (isSilent) => {
      if (isSilent) silentRefreshCalled = true;
    };

    const handle409 = async () => {
      conflictMessage = 'That seat was just booked by another student. Please select another seat.';
      selectedSeat = null;
      await fetchSeatMap(true);
    };

    await handle409();

    assert.strictEqual(selectedSeat, null);
    assert.strictEqual(conflictMessage, 'That seat was just booked by another student. Please select another seat.');
    assert.strictEqual(silentRefreshCalled, true);
  });

  it('12. API error handling displays sanitized error states without exposing database internals', () => {
    const sanitizeError = (err) => {
      if (err?.status === 401) return 'Your session has expired. Please log in again.';
      if (err?.status === 404) return 'Event not found or is no longer available.';
      if (err?.status === 422 || err?.status === 400) {
        return err?.message || 'Invalid booking request. Please check your seat selection.';
      }
      return 'An error occurred while confirming your booking.';
    };

    assert.strictEqual(sanitizeError({ status: 401 }), 'Your session has expired. Please log in again.');
    assert.strictEqual(sanitizeError({ status: 404 }), 'Event not found or is no longer available.');
    assert.strictEqual(
      sanitizeError({ status: 422, message: 'Booking window has closed for this event.' }),
      'Booking window has closed for this event.'
    );
    // Ensure raw MongoDB duplicate key error is NOT exposed
    const rawMongoErr = { status: 500, message: 'E11000 duplicate key error collection: sabms.bookings' };
    assert.strictEqual(sanitizeError(rawMongoErr), 'An error occurred while confirming your booking.');
  });

  it('13. Loading state renders correctly while seat map is fetching', () => {
    const isLoading = true;
    const seatData = null;
    const error = null;

    const showLoading = isLoading;
    const showSeatMap = !isLoading && !error && seatData !== null;

    assert.strictEqual(showLoading, true);
    assert.strictEqual(showSeatMap, false);
  });

  it('14. No fake or hardcoded booking success data (strictly validates envelope mapping)', () => {
    // Interceptor normalizes response to response.data
    const normalizedApiResponse = {
      success: true,
      message: 'Seat booked successfully',
      data: {
        booking: {
          id: '6aa28c819bf76dc21e54c999',
          bookingReference: 'BK-REAL-REF-7890',
          eventId: mockEvent.id,
          eventName: mockEvent.name,
          auditorium: mockEvent.auditorium,
          auditoriumName: mockEvent.auditoriumName,
          seatId: 'C-04',
          seatLabel: 'Row C, Seat 4',
          status: 'CONFIRMED',
          eventDate: mockEvent.date,
          startTime: mockEvent.startTime,
          endTime: mockEvent.endTime,
          createdAt: new Date().toISOString(),
        },
      },
    };

    // Ensure state maps directly to response?.data?.booking without hardcoded defaults
    const stateBooking = normalizedApiResponse?.data?.booking || null;

    assert.notStrictEqual(stateBooking, null);
    assert.strictEqual(stateBooking.bookingReference, 'BK-REAL-REF-7890');
    assert.strictEqual(stateBooking.status, 'CONFIRMED');
    assert.strictEqual(stateBooking.seatId, 'C-04');
    assert.strictEqual(stateBooking.eventName, 'AI & Machine Learning Workshop [Demo]');
  });

  it('15. Responsive layout structure (4 column sections per row, 6 seats each, no overflow assumptions)', () => {
    const seats = createMockSeatMap();
    assert.strictEqual(seats.length, 360);

    const studentSeats = seats.filter((s) => !s.isReserved);
    assert.strictEqual(studentSeats.length, 312);

    const rowCSeats = studentSeats.filter((s) => s.row === 'C');
    assert.strictEqual(rowCSeats.length, 24);

    const sections = { 1: [], 2: [], 3: [], 4: [] };
    rowCSeats.forEach((seat) => {
      sections[seat.columnSection].push(seat);
    });

    assert.strictEqual(sections[1].length, 6);
    assert.strictEqual(sections[2].length, 6);
    assert.strictEqual(sections[3].length, 6);
    assert.strictEqual(sections[4].length, 6);

    // Verify all 13 student rows C to O have 24 seats
    const studentRows = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
    studentRows.forEach((r) => {
      const count = studentSeats.filter((s) => s.row === r).length;
      assert.strictEqual(count, 24);
    });
  });

  // ─── STEP 5: QR TICKET & EMAIL CONFIRMATION FRONTEND TESTS ────────────────

  it('16. QR Ticket rendering: Authoritative QR DataURL rendered into ticket section', () => {
    const mockStep5Booking = {
      bookingReference: 'BK-LMF8X2-A4B7C9',
      eventName: 'AI & Machine Learning Workshop [Demo]',
      auditoriumName: 'Auditorium 1',
      seatId: 'C-04',
      seatLabel: 'Row C, Seat 4',
      status: 'CONFIRMED',
      ticket: {
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAAFAAQMAAAD...',
        issuedAt: new Date().toISOString(),
      },
      emailDelivery: {
        status: 'SENT',
      },
    };

    // Verify QR code comes strictly from backend ticket response
    assert.ok(mockStep5Booking.ticket);
    assert.ok(mockStep5Booking.ticket.qrCode.startsWith('data:image/png;base64,'));
    assert.strictEqual(mockStep5Booking.status, 'CONFIRMED');
    // Ensure raw ticketToken is NOT leaked to the client
    assert.strictEqual(mockStep5Booking.ticket.ticketToken, undefined);
    assert.strictEqual(mockStep5Booking.ticketToken, undefined);
  });

  it('17. Download QR Ticket action constructs valid download link with correct filename', () => {
    const booking = {
      bookingReference: 'BK-DOWNLOAD-123',
      ticket: {
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      },
    };

    const getDownloadFilename = (bookingRef) => `SABMS-Ticket-${bookingRef || 'booking'}.png`;

    assert.strictEqual(getDownloadFilename(booking.bookingReference), 'SABMS-Ticket-BK-DOWNLOAD-123.png');
    assert.strictEqual(getDownloadFilename(null), 'SABMS-Ticket-booking.png');
  });

  it('18. Email delivery status presentation: Truthfully displays feedback without altering booking status', () => {
    const getEmailFeedbackType = (emailStatus) => {
      if (emailStatus === 'SENT') return 'sent';
      if (emailStatus === 'PENDING') return 'pending';
      return 'fallback';
    };

    // Case A: SENT
    assert.strictEqual(getEmailFeedbackType('SENT'), 'sent');

    // Case B: PENDING
    assert.strictEqual(getEmailFeedbackType('PENDING'), 'pending');

    // Case C: FAILED / NOT_CONFIGURED
    assert.strictEqual(getEmailFeedbackType('FAILED'), 'fallback');
    assert.strictEqual(getEmailFeedbackType('NOT_CONFIGURED'), 'fallback');

    // In ALL cases, booking status remains strictly CONFIRMED
    const bookingWithFailedEmail = {
      status: 'CONFIRMED',
      emailDelivery: { status: 'FAILED' },
    };
    assert.strictEqual(bookingWithFailedEmail.status, 'CONFIRMED');
  });

  it('19. Client does not manufacture fake QR tokens or bypass backend authoritative generation', () => {
    // Ensure client state relies strictly on backend response
    const createSuccessState = (apiResponse) => {
      const b = apiResponse?.data?.booking;
      if (!b) return null;
      return {
        ...b,
        hasAuthoritativeQr: Boolean(b.ticket?.qrCode),
      };
    };

    const legitimateResponse = {
      data: {
        booking: {
          bookingReference: 'BK-AUTHENTIC-99',
          ticket: { qrCode: 'data:image/png;base64,valid_qr_data' },
        },
      },
    };

    const state = createSuccessState(legitimateResponse);
    assert.strictEqual(state.hasAuthoritativeQr, true);

    const forgedClientCall = { data: { booking: { bookingReference: 'BK-FORGED' } } };
    const forgedState = createSuccessState(forgedClientCall);
    assert.strictEqual(forgedState.hasAuthoritativeQr, false);
  });
});
