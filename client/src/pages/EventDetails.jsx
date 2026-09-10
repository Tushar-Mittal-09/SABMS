import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Ticket,
} from 'lucide-react';
import { eventsApi } from '../services/events.api';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import Button from '../components/Button';

/**
 * Status display configuration.
 */
const STATUS_DISPLAY = {
  UPCOMING: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-brand-blue dark:text-dark-blue',
    label: 'Upcoming',
  },
  ONGOING: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-brand-success dark:text-dark-success',
    label: 'Ongoing',
  },
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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
 * Event Details Page
 *
 * Full detail view of a single event.
 * Primary CTA: "Choose Your Seat" → navigates to /events/:id/seats (Step 3).
 */
export const EventDetails = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await eventsApi.getEventById(eventId);
        setEvent(response?.data?.event || null);
      } catch (err) {
        if (err?.status === 404) {
          setError('Event not found or is no longer available.');
        } else {
          setError(err?.message || 'Failed to load event details.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  const statusStyle = event
    ? STATUS_DISPLAY[event.status] || STATUS_DISPLAY.UPCOMING
    : null;

  const isFullyBooked =
    typeof event?.availableSeats === 'number' && event.availableSeats <= 0;

  return (
    <div className="min-h-screen bg-brand-bg font-sans dark:bg-dark-bg">
      {/* ─── Top Bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-brand-border bg-brand-surface/95 backdrop-blur-sm dark:border-dark-border dark:bg-dark-surface/95">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/dashboard')}
            id="event-details-back-btn"
          >
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* ─── Main Content ──────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Loading */}
        {isLoading && (
          <div
            className="flex items-center justify-center py-20"
            id="event-details-loading"
          >
            <Loading text="Loading event details..." size="lg" />
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="mx-auto max-w-lg py-12" id="event-details-error">
            <Alert type="error" title="Error" message={error} />
            <div className="mt-4 flex justify-center">
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

        {/* Event Content */}
        {!isLoading && !error && event && (
          <div className="animate-fade-in" id="event-details-content">
            {/* Event Header */}
            <div className="mb-6">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text} mb-3`}
              >
                {statusStyle.label}
              </span>
              <h1 className="text-2xl font-bold text-brand-navy dark:text-dark-text sm:text-3xl">
                {event.name}
              </h1>
            </div>

            {/* Event Info Card */}
            <div className="mb-6 rounded-xl border border-brand-border bg-brand-surface p-6 shadow-card dark:border-dark-border dark:bg-dark-surface dark:shadow-card-dark">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue dark:text-dark-blue" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-brand-muted dark:text-dark-muted">
                      Venue
                    </p>
                    <p className="text-sm font-semibold text-brand-text dark:text-dark-text">
                      {event.auditoriumName}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue dark:text-dark-blue" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-brand-muted dark:text-dark-muted">
                      Date
                    </p>
                    <p className="text-sm font-semibold text-brand-text dark:text-dark-text">
                      {formatDate(event.date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue dark:text-dark-blue" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-brand-muted dark:text-dark-muted">
                      Time
                    </p>
                    <p className="text-sm font-semibold text-brand-text dark:text-dark-text">
                      {formatTime(event.startTime)} –{' '}
                      {formatTime(event.endTime)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue dark:text-dark-blue" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-brand-muted dark:text-dark-muted">
                      Availability
                    </p>
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text dark:text-dark-text">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isFullyBooked
                            ? 'bg-brand-error dark:bg-dark-error'
                            : 'bg-brand-success dark:bg-dark-success'
                        }`}
                        aria-hidden="true"
                      />
                      {isFullyBooked ? 'Fully Booked' : 'Seats Available'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              <h2 className="mb-3 text-base font-semibold text-brand-text dark:text-dark-text">
                About This Event
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-brand-muted dark:text-dark-muted">
                {event.description}
              </p>
            </div>

            {/* Primary CTA */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="primary"
                size="lg"
                icon={Ticket}
                className="flex-1 sm:flex-none"
                onClick={() => navigate(`/events/${event._id}/seats`)}
                id="choose-seat-btn"
              >
                Choose Your Seat
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/dashboard')}
              >
                Back to Events
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default EventDetails;
