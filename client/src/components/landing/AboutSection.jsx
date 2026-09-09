import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  CalendarCheck,
  BarChart3,
} from 'lucide-react';
import { ASSETS } from '../../constants/landing.data';
import BrandedPlaceholder from './BrandedPlaceholder';

export const AboutSection = () => {
  return (
    <section id="about" className="border-y border-gray-200 bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left Column: Branded Institutional Visual Card */}
          <div className="relative lg:col-span-6">
            <div className="group relative overflow-hidden rounded-2xl border border-gray-200 shadow-card">
              <BrandedPlaceholder
                src={ASSETS.campusLawn}
                alt="MIET Institutional Infrastructure"
                type="campus"
                className="h-80 w-full object-cover sm:h-96 lg:h-[460px]"
                title="MIET Academic Infrastructure"
                subtitle="Centralized Auditorium & Hall Booking Services"
              />
              <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-gray-200 bg-white/95 p-4 text-gray-900 shadow-sm backdrop-blur-md">
                <p className="text-xs font-bold uppercase tracking-wider text-miet-red">
                  MIET Campus Infrastructure
                </p>
                <p className="mt-0.5 text-xs font-medium text-gray-600">
                  Official photography pending • Centralized Booking Services
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: About Content & Pillars */}
          <div className="space-y-6 lg:col-span-6">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-miet-red">
                ABOUT SABMS
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-miet-navy sm:text-4xl">
                A Centralized Platform for MIET Events
              </h2>
            </div>

            <p className="text-base font-normal leading-relaxed text-gray-600 sm:text-lg">
              SABMS provides a unified digital platform for discovering and
              managing auditorium and event-space bookings at MIET. The system
              is designed to simplify venue discovery, availability checking,
              booking requests, status tracking and confirmation.
            </p>

            {/* Three Institutional Benefits */}
            <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
              <div className="flex flex-col items-start rounded-xl border border-gray-200/80 bg-gray-50 p-4">
                <div className="mb-3 rounded-lg bg-red-100 p-2 text-miet-red">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">
                  Transparent Process
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Verifiable status & clear approval workflows.
                </p>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-gray-200/80 bg-gray-50 p-4">
                <div className="mb-3 rounded-lg bg-blue-100 p-2 text-miet-navy">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">
                  Centralized Booking
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Single digital portal for campus venues.
                </p>
              </div>

              <div className="flex flex-col items-start rounded-xl border border-gray-200/80 bg-gray-50 p-4">
                <div className="mb-3 rounded-lg bg-emerald-100 p-2 text-emerald-700">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">
                  Better Campus Utilization
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Optimized slot allocation without clashes.
                </p>
              </div>
            </div>

            {/* Call to Action Link */}
            <div className="pt-2">
              <a
                href="#how-it-works"
                className="group inline-flex items-center text-sm font-bold text-miet-red hover:text-miet-redHover"
              >
                <span>Learn More About SABMS</span>
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>

            <div className="flex items-center space-x-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-miet-red" />
              <span>
                Dedicated to academic seminars, guest talks, cultural fests, and
                conferences.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
