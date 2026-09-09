import { Link } from 'react-router-dom';
import { ArrowRight, Building, Sparkles } from 'lucide-react';
import { ASSETS } from '../../constants/landing.data';

export const CtaSection = () => {
  const scrollToVenues = () => {
    const el = document.getElementById('venues');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative overflow-hidden bg-miet-navyDark py-20 text-white sm:py-24">
      {/* Background: Verified Image or Intentional Institutional Treatment */}
      <div className="absolute inset-0 z-0">
        {ASSETS.ctaBg ? (
          <img
            src={ASSETS.ctaBg}
            alt="MIET Auditorium"
            className="h-full w-full object-cover object-center"
            loading="lazy"
          />
        ) : (
          <div className="relative h-full w-full bg-gradient-to-r from-miet-navyDark via-miet-navy to-black">
            {/* Subtle Brand Ambient Glows */}
            <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-miet-red/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
            {/* Architectural Grid Lines */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
                backgroundSize: '48px 48px',
              }}
            />
          </div>
        )}
        <div
          className="absolute inset-0 bg-gradient-to-r from-miet-navyDark/90 via-transparent to-black/90"
          aria-hidden="true"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 text-center sm:px-6 lg:px-8">
        <div className="inline-flex items-center space-x-2 rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-200">
          <Sparkles className="h-3.5 w-3.5 text-miet-red" />
          <span>BE A PART OF A VIBRANT CAMPUS</span>
        </div>

        <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
          Ready to Organize Your Next Event?
        </h2>

        <p className="mx-auto max-w-2xl text-base font-normal leading-relaxed text-gray-300 sm:text-lg">
          Find a venue, choose your preferred slot and submit your booking
          request through SABMS. Turn your ideas into memorable campus
          experiences.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
          <Link
            to="/login"
            className="group inline-flex w-full items-center justify-center rounded-lg bg-miet-red px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-red-900/40 transition-all duration-200 hover:-translate-y-0.5 hover:bg-miet-redHover focus:outline-none focus:ring-2 focus:ring-miet-red focus:ring-offset-2 focus:ring-offset-miet-navy sm:w-auto"
          >
            <span>Book an Auditorium</span>
            <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>

          <button
            type="button"
            onClick={scrollToVenues}
            className="inline-flex w-full items-center justify-center rounded-lg border border-white/20 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-miet-navy sm:w-auto"
          >
            <Building className="mr-2 h-4 w-4 text-gray-300" />
            <span>Explore Venues</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
