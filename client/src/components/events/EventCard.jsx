import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import Button from '../Button';

/**
 * Status badge color mapping.
 * Colors use existing brand design tokens.
 */
const STATUS_STYLES = {
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

/**
 * Formats a date string to a readable format.
 * @param {string} dateStr - ISO date string.
 * @returns {string}
 */
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Formats HH:mm time string to 12-hour format.
 * @param {string} time - Time in HH:mm format.
 * @returns {string}
 */
const formatTime = (time) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
};

/**
 * Event Card Component
 *
 * Displays event summary information in a card format for the dashboard.
 * Uses existing design system tokens and Button component.
 */
export const EventCard = ({ event }) => {
  const navigate = useNavigate();
  const statusStyle = STATUS_STYLES[event.status] || STATUS_STYLES.UPCOMING;

  return (
    <div
      className="group flex flex-col overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-dark-border dark:bg-dark-surface dark:shadow-card-dark"
      id={`event-card-${event._id}`}
    >
      {/* Card Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
          >
            {statusStyle.label}
          </span>
          <span className="text-xs font-medium text-brand-muted dark:text-dark-muted">
            <Users className="mr-1 inline h-3.5 w-3.5" />
            {event.availableSeats} / {event.totalSeats} seats
          </span>
        </div>

        {/* Event Name */}
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-brand-text dark:text-dark-text">
          {event.name}
        </h3>

        {/* Event Metadata */}
        <div className="flex flex-col gap-1.5 text-xs text-brand-muted dark:text-dark-muted">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{event.auditoriumName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              {formatTime(event.startTime)} – {formatTime(event.endTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="border-t border-brand-border px-5 py-3 dark:border-dark-border">
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => navigate(`/events/${event._id}`)}
          id={`view-event-${event._id}`}
        >
          View Event
        </Button>
      </div>
    </div>
  );
};

export default EventCard;
