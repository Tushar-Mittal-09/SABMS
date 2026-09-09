import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Building, CheckCircle } from 'lucide-react';
import { ASSETS } from '../../constants/landing.data';

export const HeroSection = () => {
  const scrollToVenues = () => {
    const el = document.getElementById('venues');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      id="home"
      className="relative flex min-h-[560px] items-center overflow-hidden bg-[#071A2B] text-white lg:min-h-[620px]"
    >
      {/* Background: Professional Architectural Visual Treatment (No Stock / AI Photos) */}
      <div className="absolute inset-0 z-0 select-none overflow-hidden">
        {ASSETS.campusHero ? (
          <img
            src={ASSETS.campusHero}
            alt="MIET Campus"
            className="h-full w-full object-cover object-center"
            loading="eager"
          />
        ) : (
          <div className="relative h-full w-full bg-gradient-to-br from-[#071A2B] via-[#082038] to-[#040E1A]">
            {/* Restrained Architectural Grid */}
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
                backgroundSize: '36px 36px',
              }}
            />

            {/* Abstract Auditorium & Architectural Line-Art (SVG) */}
            <svg
              className="pointer-events-none absolute bottom-0 right-0 h-full w-full opacity-20 lg:w-2/3"
              viewBox="0 0 800 600"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Auditorium Seating Tier Contours */}
              <path
                d="M100 600 C 250 480, 550 480, 700 600"
                stroke="#ED1C24"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <path
                d="M150 600 C 280 500, 520 500, 650 600"
                stroke="#FFFFFF"
                strokeWidth="1"
              />
              <path
                d="M200 600 C 310 520, 490 520, 600 600"
                stroke="#ED1C24"
                strokeWidth="1.5"
                strokeDasharray="6 6"
              />
              <path
                d="M250 600 C 340 540, 460 540, 550 600"
                stroke="#FFFFFF"
                strokeWidth="1"
              />

              {/* Stage & Acoustic Perspective Vectors */}
              <path
                d="M400 240 L 400 480"
                stroke="#ED1C24"
                strokeWidth="1"
                strokeOpacity="0.4"
              />
              <path
                d="M300 280 L 100 600"
                stroke="#FFFFFF"
                strokeWidth="1"
                strokeOpacity="0.3"
              />
              <path
                d="M500 280 L 700 600"
                stroke="#FFFFFF"
                strokeWidth="1"
                strokeOpacity="0.3"
              />
              <line
                x1="280"
                y1="280"
                x2="520"
                y2="280"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeOpacity="0.4"
              />
              <line
                x1="320"
                y1="340"
                x2="480"
                y2="340"
                stroke="#ED1C24"
                strokeWidth="1.5"
                strokeOpacity="0.6"
              />

              {/* Geometric Architectural Canopy Lines */}
              <polygon
                points="400,120 620,200 620,260 400,180"
                stroke="#FFFFFF"
                strokeWidth="1"
                strokeOpacity="0.25"
              />
              <polygon
                points="400,120 180,200 180,260 400,180"
                stroke="#ED1C24"
                strokeWidth="1"
                strokeOpacity="0.3"
              />
            </svg>

            {/* Subtle Institutional Red Glow Accents */}
            <div className="pointer-events-none absolute right-1/4 top-1/3 h-80 w-80 rounded-full bg-[#ED1C24]/10 blur-3xl" />
            <div className="pointer-events-none absolute bottom-10 left-10 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
          </div>
        )}

        {/* Gradient Overlay for Text Legibility */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#071A2B] via-[#071A2B]/90 to-transparent"
          aria-hidden="true"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="max-w-3xl space-y-6">
          {/* Eyebrow & Venue Availability Preview Badge */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center space-x-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-200 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-miet-red" />
              <span>SMART AUDITORIUM BOOKING & MANAGEMENT SYSTEM</span>
            </div>

            {/* Availability Indicator (Preview Mode) */}
            <div className="inline-flex items-center space-x-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Venue Availability Preview</span>
            </div>
          </div>

          {/* Main Headings */}
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Book. Manage. Host.
            </h1>
            <p className="text-xl font-medium text-gray-200 sm:text-2xl">
              Organize Ideas.{' '}
              <span className="text-miet-red">Create Impact.</span>
            </p>
          </div>

          {/* Supporting Text */}
          <p className="max-w-2xl text-base font-normal leading-relaxed text-gray-300 sm:text-lg">
            A centralized platform for discovering, requesting and managing
            auditorium and event-space bookings at MIET. Streamline approvals,
            prevent scheduling conflicts, and empower academic excellence.
          </p>

          {/* Primary & Secondary Call to Actions */}
          <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4">
            <Link
              to="/login"
              className="group inline-flex items-center justify-center rounded-lg bg-miet-red px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-red-900/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-miet-redHover focus:outline-none focus:ring-2 focus:ring-miet-red focus:ring-offset-2 focus:ring-offset-miet-navy"
            >
              <span>Book an Auditorium</span>
              <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <button
              type="button"
              onClick={scrollToVenues}
              className="inline-flex items-center justify-center rounded-lg border border-white/25 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-miet-navy"
            >
              <Building className="mr-2 h-4 w-4 text-gray-300" />
              <span>Explore Venues</span>
            </button>
          </div>

          {/* Institutional Trust Highlights */}
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6 text-xs text-gray-300 sm:grid-cols-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 shrink-0 text-miet-red" />
              <span>Official MIET Digital Service</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 shrink-0 text-miet-red" />
              <span>Conflict Prevention Engine</span>
            </div>
            <div className="hidden items-center space-x-2 sm:flex">
              <CheckCircle className="h-4 w-4 shrink-0 text-miet-red" />
              <span>Institutional Approvals</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
