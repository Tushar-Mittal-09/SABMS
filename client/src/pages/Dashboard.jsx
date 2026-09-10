import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, CalendarDays, Sparkles, SearchX } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { eventsApi } from '../services/events.api';
import EventCard from '../components/events/EventCard';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import Button from '../components/Button';

/**
 * Student Dashboard Page
 *
 * Authenticated student-only page serving as the primary hub for event discovery.
 * Fetches events from the backend API and splits into Upcoming / Ongoing sections.
 *
 * States: Loading → Data (with events) → Empty (no events) → Error (API failure)
 */
export const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await eventsApi.listEvents({ limit: 50 });
      setEvents(response?.data?.events || []);
    } catch (err) {
      setError(err?.message || 'Failed to load events. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Split events by status for sectioned display
  const upcomingEvents = events.filter((e) => e.status === 'UPCOMING');
  const ongoingEvents = events.filter((e) => e.status === 'ONGOING');

  return (
    <div className="min-h-screen bg-brand-bg font-sans dark:bg-dark-bg">
      {/* ─── Dashboard Header ──────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-brand-border bg-brand-surface/95 backdrop-blur-sm dark:border-dark-border dark:bg-dark-surface/95">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Branding */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy text-xs font-bold text-white dark:bg-brand-blue">
              S
            </div>
            <span className="text-base font-bold tracking-tight text-brand-navy dark:text-dark-text">
              SABMS
            </span>
          </div>

          {/* Student identity + controls */}
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-lightBlue text-xs font-semibold text-brand-navy dark:bg-dark-surface2 dark:text-dark-text">
                <User className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-brand-text dark:text-dark-text">
                {user?.name || 'Student'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={LogOut}
              onClick={handleLogout}
              id="dashboard-logout-btn"
            >
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ──────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Banner */}
        <div className="mb-8">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-gold" />
            <h1 className="text-2xl font-bold text-brand-navy dark:text-dark-text">
              Welcome to SABMS
            </h1>
          </div>
          <p className="text-sm text-brand-muted dark:text-dark-muted">
            Discover upcoming events and reserve your seat.
          </p>
        </div>

        {/* ─── Loading State ──────────────────────────────────────── */}
        {isLoading && (
          <div
            className="flex items-center justify-center py-20"
            id="dashboard-loading"
          >
            <Loading text="Loading events..." size="lg" />
          </div>
        )}

        {/* ─── Error State ────────────────────────────────────────── */}
        {!isLoading && error && (
          <div className="mx-auto max-w-lg py-12" id="dashboard-error">
            <Alert type="error" title="Error" message={error} />
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" size="sm" onClick={fetchEvents}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* ─── Empty State ────────────────────────────────────────── */}
        {!isLoading && !error && events.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-20 text-center"
            id="dashboard-empty"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-lightBlue dark:bg-dark-surface2">
              <SearchX className="h-8 w-8 text-brand-blue dark:text-dark-blue" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-brand-text dark:text-dark-text">
              No Events Available
            </h2>
            <p className="max-w-sm text-sm text-brand-muted dark:text-dark-muted">
              There are no upcoming or ongoing events at the moment. Check back
              later for new events!
            </p>
          </div>
        )}

        {/* ─── Events Sections ────────────────────────────────────── */}
        {!isLoading && !error && events.length > 0 && (
          <div className="space-y-10" id="dashboard-events">
            {/* Ongoing Events */}
            {ongoingEvents.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-brand-success" />
                  <h2 className="text-lg font-semibold text-brand-text dark:text-dark-text">
                    Ongoing Events
                  </h2>
                  <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-brand-success dark:bg-emerald-950/40 dark:text-dark-success">
                    {ongoingEvents.length}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {ongoingEvents.map((event) => (
                    <EventCard key={event._id} event={event} />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <CalendarDays className="h-4.5 w-4.5 text-brand-blue dark:text-dark-blue" />
                  <h2 className="text-lg font-semibold text-brand-text dark:text-dark-text">
                    Upcoming Events
                  </h2>
                  <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-brand-blue dark:bg-blue-950/40 dark:text-dark-blue">
                    {upcomingEvents.length}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcomingEvents.map((event) => (
                    <EventCard key={event._id} event={event} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-brand-border py-6 text-center text-xs text-brand-muted dark:border-dark-border dark:text-dark-muted">
        &copy; {new Date().getFullYear()} SABMS — Smart Auditorium Booking &amp;
        Management System
      </footer>
    </div>
  );
};

export default Dashboard;
