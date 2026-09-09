import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  X,
  Users,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { VENUES_DATA } from '../../constants/landing.data';
import VenueCard from './VenueCard';
import BrandedPlaceholder from './BrandedPlaceholder';

export const ExploreVenuesSection = () => {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [activeModalVenue, setActiveModalVenue] = useState(null);

  const filters = ['All', 'Auditorium', 'Seminar Hall', 'Conference Hall'];
  const triggerButtonRef = useRef(null);
  const modalContainerRef = useRef(null);
  const modalCloseButtonRef = useRef(null);

  const filteredVenues =
    selectedFilter === 'All'
      ? VENUES_DATA
      : VENUES_DATA.filter((v) => v.type === selectedFilter);

  const modalPlaceholderType =
    activeModalVenue?.type === 'Auditorium'
      ? 'auditorium'
      : activeModalVenue?.type === 'Seminar Hall'
        ? 'seminar'
        : 'conference';

  // Modal Focus Trap, Escape Key Listener, and Scroll Lock
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!activeModalVenue) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }

      if (e.key === 'Tab' && modalContainerRef.current) {
        const focusable = modalContainerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    if (activeModalVenue) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      // Auto-focus the close button upon opening
      setTimeout(() => {
        modalCloseButtonRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeModalVenue]);

  const openModal = (venue, triggerEl) => {
    triggerButtonRef.current = triggerEl;
    setActiveModalVenue(venue);
  };

  const closeModal = () => {
    setActiveModalVenue(null);
    // Explicitly return focus to the exact triggering element
    setTimeout(() => {
      triggerButtonRef.current?.focus();
    }, 50);
  };

  return (
    <section id="venues" className="bg-miet-bg py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col justify-between gap-6 border-b border-gray-200 pb-8 md:flex-row md:items-end">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center space-x-1.5 rounded-full bg-red-100/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-miet-red">
              <span>VENUE INVENTORY PREVIEW</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-miet-navy sm:text-4xl">
              Explore Our Venues
            </h2>
            <p className="text-base font-normal text-gray-600 sm:text-lg">
              Browse institutional spaces designed for academic seminars,
              workshops, conferences, and cultural events.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedFilter(filter)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-2 sm:text-sm ${
                  selectedFilter === filter
                    ? 'bg-miet-navy text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Development Preview Advisory Banner */}
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Development Preview:</strong> The venues listed below
            represent preview schemas. Individual capacities, room numbers, and
            facility matrices will connect to official MIET venue
            configurations.
          </span>
        </div>

        {/* Venues Grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredVenues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              onSelect={(v, triggerEl) => openModal(v, triggerEl)}
            />
          ))}
        </div>

        {/* Bottom Action Link */}
        <div className="mt-12 text-center">
          <Link
            to="/login"
            className="group inline-flex items-center rounded-lg border border-miet-red px-6 py-3 text-sm font-bold text-miet-red transition-all duration-200 hover:bg-miet-red hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-2"
          >
            <span>View All Auditoriums & Schedule</span>
            <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      {/* Venue Detail Modal with Strict Focus Containment */}
      {activeModalVenue && (
        <div
          className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-venue-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={modalContainerRef}
            className="max-h-[90vh] w-full max-w-lg animate-scale-up overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            {/* Modal Image / Branded Fallback */}
            <div className="relative h-48 w-full shrink-0 sm:h-56">
              <BrandedPlaceholder
                src={activeModalVenue.image}
                alt={activeModalVenue.name}
                type={modalPlaceholderType}
                title={activeModalVenue.name}
                subtitle={activeModalVenue.location}
                className="h-full w-full object-cover"
              />
              <button
                ref={modalCloseButtonRef}
                type="button"
                onClick={closeModal}
                className="absolute right-3 top-3 z-20 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Close venue details"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-3 z-10">
                <span className="rounded-md bg-white/95 px-3 py-1 text-xs font-semibold text-miet-navy shadow">
                  {activeModalVenue.type}
                </span>
              </div>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 p-6">
              <div>
                <div className="flex items-center justify-between">
                  <h3
                    id="modal-venue-title"
                    className="text-xl font-bold text-miet-navy"
                  >
                    {activeModalVenue.name}
                  </h3>
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Development Preview
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users className="h-4 w-4 text-miet-red" />
                    {activeModalVenue.capacityLabel ||
                      'Capacity: To be configured'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-miet-red" />
                    {activeModalVenue.location}
                  </span>
                </div>
              </div>

              {/* Facilities Included */}
              <div className="border-t border-gray-100 pt-3">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Facilities (Configurable)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {activeModalVenue.facilities.map((f) => (
                    <div
                      key={f}
                      className="flex items-center space-x-1.5 text-xs text-gray-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-miet-red" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Booking Policy (Neutral Statement) */}
              <div className="flex items-start space-x-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-miet-navy" />
                <span>
                  Booking requirements will follow the configured institutional
                  policy.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
                >
                  Close
                </button>
                <Link
                  to="/login"
                  className="inline-flex items-center rounded-lg bg-miet-red px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-miet-redHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-2"
                >
                  <span>Request Booking</span>
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ExploreVenuesSection;
