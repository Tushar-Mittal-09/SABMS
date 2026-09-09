import { MapPin, Phone, Mail } from 'lucide-react';
import { INSTITUTION } from '../../constants/landing.data';
import { Link } from 'react-router-dom';

export const TopUtilityBar = () => {
  return (
    <div
      className="select-none border-b border-miet-navyLight/60 bg-miet-navy text-xs text-gray-300"
      role="region"
      aria-label="Campus Quick Access and Institutional Contact"
    >
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Side: Institutional Contact & Location */}
        <div className="flex items-center space-x-4 overflow-hidden sm:space-x-6">
          <div className="flex shrink-0 items-center space-x-1.5 truncate">
            <MapPin
              className="h-3.5 w-3.5 shrink-0 text-miet-red"
              aria-hidden="true"
            />
            <span className="hidden truncate font-normal md:inline">
              {INSTITUTION.address}
            </span>
            <span className="inline truncate md:hidden">MIET, Meerut (UP)</span>
          </div>

          <div className="hidden shrink-0 items-center space-x-1.5 lg:flex">
            <Phone
              className="h-3.5 w-3.5 shrink-0 text-miet-red"
              aria-hidden="true"
            />
            <a
              href={`tel:${INSTITUTION.phone.replace(/\s+/g, '')}`}
              className="rounded transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-miet-red"
            >
              {INSTITUTION.phone}
            </a>
          </div>

          <div className="hidden shrink-0 items-center space-x-1.5 xl:flex">
            <Mail
              className="h-3.5 w-3.5 shrink-0 text-miet-red"
              aria-hidden="true"
            />
            <a
              href={`mailto:${INSTITUTION.email}`}
              className="rounded transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-miet-red"
            >
              {INSTITUTION.email}
            </a>
          </div>
        </div>

        {/* Right Side: Institutional Portals & Help */}
        <div className="flex shrink-0 items-center space-x-3 text-gray-300 sm:space-x-4">
          <nav
            aria-label="Audience Portals"
            className="flex items-center space-x-3"
          >
            <Link
              to="/login"
              className="rounded font-medium transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-miet-red"
            >
              Students
            </Link>
            <span className="text-gray-600" aria-hidden="true">
              |
            </span>
            <Link
              to="/login"
              className="rounded font-medium transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-miet-red"
            >
              Faculty
            </Link>
            <span className="hidden text-gray-600 sm:inline" aria-hidden="true">
              |
            </span>
            <Link
              to="/login"
              className="hidden rounded font-medium transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-miet-red sm:inline"
            >
              Staff
            </Link>
            <span className="hidden text-gray-600 sm:inline" aria-hidden="true">
              |
            </span>
            <a
              href="#contact"
              className="hidden rounded font-medium transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-miet-red sm:inline"
            >
              Help & Support
            </a>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default TopUtilityBar;
