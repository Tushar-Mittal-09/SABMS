import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Lock,
  CheckCircle,
  AlertCircle,
  Shield,
  Loader2,
  Download,
  Mail,
} from 'lucide-react';
import { bookingsApi } from '../services/bookings.api';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import Button from '../components/Button';

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

/**
 * Interactive Auditorium Seat Selection Page
 *
 * Implements BookMyShow-inspired interaction patterns:
 * - Real-time seat map rendering from authoritative auditorium config minus active bookings
 * - Distinct Faculty/Organizer Reserved section (Rows A & B)
 * - 4 Column Sections with accessible aisles for Student Seating (Rows C to O)
 * - Memory-only single seat selection
 * - Double-submission prevention with button locking
 * - Controlled HTTP 409 Conflict handling with auto-refresh
 * - Persistent booking success state
 * - Zero page-level horizontal overflow
 */
export const SeatSelection = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [seatData, setSeatData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conflictMessage, setConflictMessage] = useState(null);

  // Client-only in-memory selection state
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  const fetchSeatMap = useCallback(
    async (isSilent = false) => {
      if (!isSilent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const response = await bookingsApi.getSeatMap(eventId);
        setSeatData(response?.data || null);
      } catch (err) {
        if (err?.status === 404) {
          setError('Event not found or is no longer available.');
        } else {
          setError(err?.message || 'Failed to load auditorium seat map.');
        }
      } finally {
        if (!isSilent) {
          setIsLoading(false);
        }
      }
    },
    [eventId]
  );

  useEffect(() => {
    fetchSeatMap();
  }, [fetchSeatMap]);

  // Group seats by row
  const rows = useMemo(() => {
    if (!seatData?.seats) return {};
    const grouped = {};
    seatData.seats.forEach((seat) => {
      if (!grouped[seat.row]) {
        grouped[seat.row] = [];
      }
      grouped[seat.row].push(seat);
    });
    return grouped;
  }, [seatData]);

  // Separate reserved rows (A & B) and student rows (C to O)
  const reservedRowLetters = ['A', 'B'];
  const studentRowLetters = useMemo(() => {
    return Object.keys(rows).filter((r) => !reservedRowLetters.includes(r));
  }, [rows]);

  const handleSeatClick = (seat) => {
    if (
      seat.isReserved ||
      seat.status === 'BOOKED' ||
      seatData?.event?.isBookingClosed
    ) {
      return;
    }

    setConflictMessage(null);

    // Toggle selection
    if (selectedSeat?.seatId === seat.seatId) {
      setSelectedSeat(null);
    } else {
      setSelectedSeat(seat);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSeat || isBooking || seatData?.event?.isBookingClosed) return;

    setIsBooking(true);
    setConflictMessage(null);
    setError(null);

    try {
      const response = await bookingsApi.bookSeat(eventId, selectedSeat.seatId);
      setBookingSuccess(response?.data?.booking || null);
      setSelectedSeat(null);
    } catch (err) {
      if (err?.status === 409) {
        setConflictMessage(
          'That seat was just booked by another student. Please select another seat.'
        );
        setSelectedSeat(null);
        // Refresh seat map silently to reflect newest availability
        await fetchSeatMap(true);
      } else if (err?.status === 401) {
        setError('Your session has expired. Please log in again.');
      } else if (err?.status === 404) {
        setError('Event not found or is no longer available.');
      } else if (err?.status === 422 || err?.status === 400) {
        setError(
          err?.message ||
            'Invalid booking request. Please check your seat selection.'
        );
      } else {
        setError(
          err?.message || 'An error occurred while confirming your booking.'
        );
      }
    } finally {
      setIsBooking(false);
    }
  };

  const handleDownloadTicket = () => {
    if (!bookingSuccess?.ticket?.qrCode) return;
    const link = document.createElement('a');
    link.href = bookingSuccess.ticket.qrCode;
    link.download = `SABMS-Ticket-${bookingSuccess.bookingReference || 'booking'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const event = seatData?.event;
  const isReadOnly = Boolean(event?.isBookingClosed);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-brand-bg font-sans text-brand-text dark:bg-dark-bg dark:text-dark-text">
      {/* ─── Top Bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-brand-border bg-brand-surface/95 backdrop-blur-sm dark:border-dark-border dark:bg-dark-surface/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              onClick={() => navigate(`/events/${eventId}`)}
              id="seat-map-back-btn"
            >
              Back to Event
            </Button>
          </div>

          {event && (
            <div className="hidden text-right sm:block">
              <h1 className="max-w-xs truncate text-sm font-bold text-brand-navy dark:text-dark-text md:max-w-md">
                {event.name}
              </h1>
              <p className="text-xs text-brand-muted dark:text-dark-muted">
                {event.auditoriumName} • {formatDate(event.date)} •{' '}
                {formatTime(event.startTime)}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* ─── Main Content Container ───────────────────────────────── */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Loading State */}
        {isLoading && (
          <div
            className="flex flex-1 items-center justify-center py-20"
            id="seat-map-loading"
          >
            <Loading text="Loading auditorium layout..." size="lg" />
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="mx-auto max-w-lg py-12" id="seat-map-error">
            <Alert
              type="error"
              title="Unable to load seat map"
              message={error}
            />
            <div className="mt-4 flex justify-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={fetchSeatMap}
                id="seat-map-retry-btn"
              >
                Retry
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/dashboard')}
              >
                Return to Dashboard
              </Button>
            </div>
          </div>
        )}

        {/* Empty / Invalid Seat Data State */}
        {!isLoading &&
          !error &&
          !bookingSuccess &&
          (!seatData || !seatData.seats || seatData.seats.length === 0) && (
            <div className="mx-auto max-w-lg py-12" id="seat-map-empty">
              <Alert
                type="error"
                title="Unable to load seat map"
                message="Auditorium seating layout data is unavailable for this event. Please try again."
              />
              <div className="mt-4 flex justify-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={fetchSeatMap}
                  id="seat-map-empty-retry-btn"
                >
                  Retry
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/dashboard')}
                >
                  Return to Dashboard
                </Button>
              </div>
            </div>
          )}

        {/* Success Confirmation Card */}
        {bookingSuccess && (
          <div
            className="mx-auto w-full max-w-lg animate-fade-in py-8"
            id="booking-success-card"
          >
            <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xl dark:border-emerald-900/50 dark:bg-dark-surface">
              <div className="mb-4 flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="h-8 w-8 shrink-0" />
                <div>
                  <h2 className="text-xl font-bold">Booking Confirmed!</h2>
                  <p className="text-xs text-brand-muted dark:text-dark-muted">
                    Your seat reservation has been saved to your account.
                  </p>
                </div>
              </div>

              <div className="mb-6 space-y-3 rounded-xl border border-brand-border bg-gray-50 p-4 text-sm dark:border-dark-border dark:bg-dark-bg/60">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-800">
                  <span className="text-brand-muted dark:text-dark-muted">
                    Booking Reference
                  </span>
                  <span
                    className="font-mono font-bold text-brand-navy dark:text-dark-blue"
                    id="success-booking-ref"
                  >
                    {bookingSuccess.bookingReference}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-brand-muted dark:text-dark-muted">
                    Event
                  </span>
                  <span
                    className="max-w-[200px] truncate text-right font-medium"
                    id="success-event-name"
                  >
                    {bookingSuccess.eventName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-brand-muted dark:text-dark-muted">
                    Auditorium
                  </span>
                  <span className="font-medium" id="success-auditorium-name">
                    {bookingSuccess.auditoriumName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-brand-muted dark:text-dark-muted">
                    Seat
                  </span>
                  <span
                    className="font-bold text-brand-blue dark:text-dark-blue"
                    id="success-seat-label"
                  >
                    {bookingSuccess.seatLabel} ({bookingSuccess.seatId})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-brand-muted dark:text-dark-muted">
                    Date
                  </span>
                  <span className="font-medium" id="success-event-date">
                    {formatDate(bookingSuccess.eventDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-brand-muted dark:text-dark-muted">
                    Time
                  </span>
                  <span className="font-medium" id="success-event-time">
                    {formatTime(bookingSuccess.startTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-2 dark:border-gray-800">
                  <span className="text-brand-muted dark:text-dark-muted">
                    Status
                  </span>
                  <span
                    className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                    id="success-booking-status"
                  >
                    {bookingSuccess.status || 'CONFIRMED'}
                  </span>
                </div>
              </div>

              {/* Authoritative QR E-Ticket Section */}
              {bookingSuccess.ticket?.qrCode && (
                <div
                  className="mb-6 flex flex-col items-center justify-center rounded-xl border border-brand-border bg-gray-50 p-5 text-center dark:border-dark-border dark:bg-dark-bg/60"
                  id="success-ticket-section"
                >
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-dark-blue">
                    Official Digital Entry Ticket
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-white">
                    <img
                      src={bookingSuccess.ticket.qrCode}
                      alt="Booking QR Ticket"
                      id="booking-qr-code"
                      className="h-44 w-44 object-contain sm:h-48 sm:w-48"
                    />
                  </div>
                  <p className="mt-2 text-xs text-brand-muted dark:text-dark-muted">
                    Scan this secure QR code at the auditorium entrance.
                  </p>
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Download}
                      onClick={handleDownloadTicket}
                      id="download-ticket-btn"
                    >
                      Download QR Ticket
                    </Button>
                  </div>
                </div>
              )}

              {/* Email Delivery Feedback */}
              {bookingSuccess.emailDelivery?.status === 'SENT' && (
                <div
                  className="mb-6 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                  id="email-status-sent"
                >
                  <Mail className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    A confirmation email with your QR ticket has been sent to
                    your registered email address.
                  </span>
                </div>
              )}
              {bookingSuccess.emailDelivery?.status === 'PENDING' && (
                <div
                  className="mb-6 flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
                  id="email-status-pending"
                >
                  <Mail className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>
                    Your booking is confirmed! Confirmation email is being
                    dispatched.
                  </span>
                </div>
              )}
              {(bookingSuccess.emailDelivery?.status === 'FAILED' ||
                bookingSuccess.emailDelivery?.status === 'NOT_CONFIGURED') && (
                <div
                  className="mb-6 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                  id="email-status-fallback"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Your seat is confirmed! Please download or screenshot your
                    QR ticket above.
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => navigate('/dashboard')}
                  id="success-dashboard-btn"
                >
                  Back to Dashboard
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(`/events/${eventId}`)}
                >
                  View Event Details
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Seat Map View */}
        {!isLoading &&
          !error &&
          !bookingSuccess &&
          seatData &&
          seatData.seats?.length > 0 && (
            <div className="flex flex-1 flex-col pb-36 sm:pb-40">
              {/* Event Summary Bar on Mobile */}
              <div className="mb-4 rounded-lg border border-brand-border bg-brand-surface p-3 text-center dark:border-dark-border dark:bg-dark-surface sm:hidden">
                <h2 className="truncate text-sm font-bold">{event.name}</h2>
                <p className="mt-0.5 text-xs text-brand-muted dark:text-dark-muted">
                  {event.auditoriumName} • {formatDate(event.date)} •{' '}
                  {formatTime(event.startTime)}
                </p>
              </div>

              {/* Read-Only Status Banner */}
              {isReadOnly && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold">
                      {event.status === 'ONGOING'
                        ? 'Booking Closed — Event In Progress'
                        : event.status === 'COMPLETED'
                          ? 'Booking Closed — Event Completed'
                          : event.status === 'CANCELLED'
                            ? 'Booking Closed — Event Cancelled'
                            : 'Booking Closed — Event has already started'}
                    </p>
                    <p className="mt-0.5 text-xs opacity-90">
                      Seats are displayed in read-only mode for informational
                      reference.
                    </p>
                  </div>
                </div>
              )}

              {/* Conflict Alert */}
              {conflictMessage && (
                <div className="mb-4">
                  <Alert
                    type="warning"
                    title="Seat Unavailable"
                    message={conflictMessage}
                  />
                </div>
              )}

              {/* Stage Presentation Banner */}
              <div className="my-6 flex flex-col items-center">
                <div className="relative flex h-10 w-full max-w-2xl items-center justify-center">
                  {/* Curved Stage Visual */}
                  <div className="absolute inset-x-8 top-0 h-4 rounded-[100%] border-t-2 border-brand-blue/50 dark:border-dark-blue/50" />
                  <div className="z-10 bg-brand-bg px-6 dark:bg-dark-bg">
                    <span className="text-xs font-bold uppercase tracking-[0.25em] text-brand-muted dark:text-dark-muted">
                      STAGE
                    </span>
                  </div>
                </div>
              </div>

              {/* Legend Bar */}
              <div className="mb-6 flex flex-wrap items-center justify-center gap-4 rounded-xl border border-brand-border bg-brand-surface p-3 text-xs text-brand-muted shadow-sm dark:border-dark-border dark:bg-dark-surface dark:text-dark-muted sm:gap-6">
                <div className="flex items-center gap-1.5">
                  <span className="h-4 w-4 rounded-md border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-md bg-emerald-600 text-[10px] font-bold text-white shadow-sm">
                    ✓
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Selected
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-md border border-red-200 bg-red-100 text-[10px] font-bold text-red-500 dark:border-red-900/50 dark:bg-red-950/40">
                    ✕
                  </span>
                  <span>Booked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-md bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                    <Lock className="h-2.5 w-2.5" />
                  </span>
                  <span>Reserved (Faculty)</span>
                </div>
              </div>

              {/* Seating Layout Scrollable Container */}
              <div className="w-full flex-1 overflow-x-auto rounded-2xl border border-brand-border bg-white/60 p-4 pb-6 pt-2 shadow-inner dark:border-dark-border dark:bg-dark-surface/40 sm:p-6">
                <div className="flex min-w-[640px] flex-col items-center">
                  {/* ─── Faculty / Organizer Reserved Section (Rows A & B) ─── */}
                  <div className="mb-8 w-full">
                    <div className="mb-3 flex items-center justify-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-slate-500" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Faculty & Organizer Reserved Seating
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {reservedRowLetters.map((rowLetter) => {
                        const rowSeats = rows[rowLetter] || [];
                        return (
                          <div
                            key={rowLetter}
                            className="flex items-center justify-center gap-2"
                          >
                            <span className="w-6 select-none text-right text-xs font-bold text-slate-400">
                              {rowLetter}
                            </span>

                            <div className="flex items-center gap-3 sm:gap-4">
                              {[1, 2, 3, 4].map((sectionNum) => {
                                const sectionSeats = rowSeats.filter(
                                  (s) => s.columnSection === sectionNum
                                );
                                return (
                                  <div
                                    key={sectionNum}
                                    className="flex items-center gap-1 rounded-lg bg-slate-100/70 p-1 dark:bg-slate-800/40"
                                  >
                                    {sectionSeats.map((seat) => (
                                      <button
                                        key={seat.seatId}
                                        type="button"
                                        disabled
                                        aria-label={`${seat.label}, Reserved`}
                                        className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md bg-slate-200 text-[11px] text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                                      >
                                        <Lock className="h-3 w-3" />
                                      </button>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>

                            <span className="w-6 select-none text-left text-xs font-bold text-slate-400">
                              {rowLetter}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ─── Student Seating Section (Rows C to O) ─── */}
                  <div className="w-full">
                    <div className="mb-3 flex items-center justify-center gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-blue dark:text-dark-blue">
                        Student Seating (Rows C – O)
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {studentRowLetters.map((rowLetter) => {
                        const rowSeats = rows[rowLetter] || [];
                        return (
                          <div
                            key={rowLetter}
                            className="flex items-center justify-center gap-2"
                          >
                            <span className="w-6 select-none text-right text-xs font-bold text-brand-muted dark:text-dark-muted">
                              {rowLetter}
                            </span>

                            <div className="flex items-center gap-3 sm:gap-4">
                              {[1, 2, 3, 4].map((sectionNum) => {
                                const sectionSeats = rowSeats.filter(
                                  (s) => s.columnSection === sectionNum
                                );
                                return (
                                  <div
                                    key={sectionNum}
                                    className="flex items-center gap-1 rounded-lg p-1"
                                  >
                                    {sectionSeats.map((seat) => {
                                      const isSelected =
                                        selectedSeat?.seatId === seat.seatId;
                                      const isBooked = seat.status === 'BOOKED';
                                      const isDisabled = isBooked || isReadOnly;

                                      let buttonStyle =
                                        'border border-gray-300 bg-white text-gray-700 hover:border-brand-blue hover:bg-blue-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-dark-blue';

                                      if (isSelected) {
                                        buttonStyle =
                                          'bg-emerald-600 border-emerald-600 text-white font-bold ring-2 ring-emerald-400 dark:ring-emerald-500 shadow-md scale-105';
                                      } else if (isBooked) {
                                        buttonStyle =
                                          'bg-red-100/80 border-red-200 text-red-500 dark:bg-red-950/40 dark:border-red-900/40 dark:text-red-400 cursor-not-allowed opacity-80';
                                      }

                                      return (
                                        <button
                                          key={seat.seatId}
                                          type="button"
                                          disabled={isDisabled}
                                          onClick={() => handleSeatClick(seat)}
                                          aria-label={`${seat.label}, ${
                                            isSelected
                                              ? 'Selected'
                                              : isBooked
                                                ? 'Booked'
                                                : 'Available'
                                          }`}
                                          className={`flex h-7 w-7 select-none items-center justify-center rounded-md text-[10px] transition-all duration-150 ${buttonStyle}`}
                                        >
                                          {isSelected
                                            ? '✓'
                                            : isBooked
                                              ? '✕'
                                              : seat.number}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>

                            <span className="w-6 select-none text-left text-xs font-bold text-brand-muted dark:text-dark-muted">
                              {rowLetter}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Scroll Affordance Hint */}
              <div className="mt-2 text-center text-[11px] text-brand-muted dark:text-dark-muted sm:hidden">
                ← Scroll horizontally to view all auditorium sections →
              </div>
            </div>
          )}
      </main>

      {/* ─── Sticky Bottom Action Bar with Booking Summary & Submission Lock ─── */}
      {!isLoading &&
        !error &&
        !bookingSuccess &&
        seatData &&
        seatData.seats?.length > 0 && (
          <aside
            aria-label="Booking Confirmation Bar"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-border bg-white/95 p-4 shadow-2xl backdrop-blur-md transition-all duration-200 dark:border-dark-border dark:bg-dark-surface/95"
          >
            <div className="mx-auto max-w-7xl px-2 sm:px-6">
              {/* Booking Summary Section (Active when a seat is selected) */}
              {selectedSeat && !isReadOnly && (
                <div
                  className="mb-3 animate-fade-in border-b border-brand-border/60 pb-3 dark:border-dark-border/60"
                  id="booking-summary-section"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-blue dark:text-dark-blue">
                        Booking Summary
                      </span>
                      <span className="hidden text-[11px] text-brand-muted dark:text-dark-muted sm:inline">
                        (Fixed event details cannot be modified)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSeat(null)}
                      className="cursor-pointer text-xs text-brand-muted underline hover:text-brand-navy dark:text-dark-muted dark:hover:text-dark-text"
                      id="deselect-seat-btn"
                    >
                      Change Seat
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-brand-border/50 bg-brand-bg/70 p-3 text-xs dark:border-dark-border/50 dark:bg-dark-bg/60 sm:grid-cols-5 sm:gap-4">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase text-brand-muted dark:text-dark-muted">
                        Event
                      </span>
                      <span
                        className="block truncate font-semibold text-brand-navy dark:text-dark-text"
                        title={event.name}
                        id="summary-event-name"
                      >
                        {event.name}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold uppercase text-brand-muted dark:text-dark-muted">
                        Auditorium
                      </span>
                      <span
                        className="block truncate font-semibold text-brand-navy dark:text-dark-text"
                        id="summary-auditorium-name"
                      >
                        {event.auditoriumName}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold uppercase text-brand-muted dark:text-dark-muted">
                        Date
                      </span>
                      <span
                        className="block font-semibold text-brand-navy dark:text-dark-text"
                        id="summary-event-date"
                      >
                        {formatDate(event.date)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold uppercase text-brand-muted dark:text-dark-muted">
                        Time
                      </span>
                      <span
                        className="block font-semibold text-brand-navy dark:text-dark-text"
                        id="summary-event-time"
                      >
                        {formatTime(event.startTime)}
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <span className="block text-[10px] font-semibold uppercase text-brand-muted dark:text-dark-muted">
                        Selected Seat
                      </span>
                      <span
                        className="block truncate font-bold text-emerald-600 dark:text-emerald-400"
                        id="summary-selected-seat"
                      >
                        {selectedSeat.label} ({selectedSeat.seatId})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Bar Controls */}
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-brand-muted dark:text-dark-muted">
                      Your Selection
                    </p>
                    <p className="text-base font-bold text-brand-navy dark:text-dark-text">
                      {selectedSeat ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {selectedSeat.label} ({selectedSeat.seatId})
                        </span>
                      ) : (
                        <span className="font-normal text-brand-muted dark:text-dark-muted">
                          No seat selected
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex w-full items-center gap-3 sm:w-auto">
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={!selectedSeat || isBooking || isReadOnly}
                    onClick={handleConfirmBooking}
                    className="w-full min-w-[200px] sm:w-auto"
                    id="confirm-booking-btn"
                  >
                    {isBooking ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Booking...
                      </span>
                    ) : isReadOnly ? (
                      'Booking Closed'
                    ) : selectedSeat ? (
                      'Confirm Booking'
                    ) : (
                      'Select a Seat'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        )}
    </div>
  );
};

export default SeatSelection;
