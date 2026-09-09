import { Users, MapPin, Check, ArrowRight, AlertCircle } from 'lucide-react';
import BrandedPlaceholder from './BrandedPlaceholder';

export const VenueCard = ({ venue, onSelect }) => {
  const placeholderType =
    venue.type === 'Auditorium'
      ? 'auditorium'
      : venue.type === 'Seminar Hall'
        ? 'seminar'
        : 'conference';

  return (
    <div className="group flex flex-col justify-between overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-card">
      {/* Venue Visual / Branded Fallback & Preview Badge */}
      <div className="relative h-48 w-full overflow-hidden bg-gray-100 sm:h-52">
        <BrandedPlaceholder
          src={venue.image}
          alt={venue.name}
          type={placeholderType}
          title={venue.name}
          subtitle={venue.location}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Development Preview Badge */}
        <div className="absolute right-3 top-3 z-10">
          <span className="inline-flex items-center rounded-full bg-amber-500/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-md">
            <AlertCircle className="mr-1 h-3 w-3" />
            {venue.badge || 'Development Preview'}
          </span>
        </div>

        {/* Venue Category Pill */}
        <div className="absolute bottom-3 left-3 z-10">
          <span className="rounded-md bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-miet-navy shadow-sm backdrop-blur-sm">
            {venue.type}
          </span>
        </div>
      </div>

      {/* Venue Details */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-gray-900 transition-colors group-hover:text-miet-navy">
              {venue.name}
            </h3>
          </div>

          <div className="mb-4 space-y-1.5 text-xs text-gray-600">
            <div className="flex items-center space-x-2">
              <Users className="h-3.5 w-3.5 shrink-0 text-miet-red" />
              <span className="font-medium text-gray-700">
                {venue.capacityLabel || 'Capacity: To be configured'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-miet-red" />
              <span className="truncate text-gray-500">{venue.location}</span>
            </div>
          </div>

          {/* Key Facilities Chips */}
          <div className="space-y-1.5 border-t border-gray-100 pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Facilities (Configurable)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {venue.facilities.slice(0, 3).map((facility) => (
                <span
                  key={facility}
                  className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700"
                >
                  <Check className="mr-1 h-3 w-3 shrink-0 text-miet-red" />
                  {facility}
                </span>
              ))}
              {venue.facilities.length > 3 && (
                <span className="px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                  +{venue.facilities.length - 3} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* View Details Action */}
        <div className="mt-5 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={(e) => onSelect(venue, e.currentTarget)}
            className="group/btn inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-miet-navy transition-colors hover:bg-miet-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-2 sm:text-sm"
          >
            <span>View Details</span>
            <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VenueCard;
