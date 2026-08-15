import { Calendar, Users, Bell, Shield, Award, BookOpen } from 'lucide-react';

/**
 * University Campus Branding & Feature Presentation Panel.
 */
export const AuthBranding = ({ className = '' }) => {
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden bg-gradient-to-b from-brand-deep via-brand-navy to-slate-900 p-8 text-white lg:p-12 ${className}`}
    >
      {/* Background Subtle Geometric Pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-5">
        <svg width="100%" height="100%">
          <pattern
            id="grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Top Brand Emblem */}
      <div className="relative z-10">
        <div className="mb-8 flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 text-brand-gold shadow-glow">
            <div className="relative">
              <Award className="h-7 w-7" />
              <BookOpen className="absolute inset-0 m-auto h-3.5 w-3.5 text-amber-200" />
            </div>
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
              SABMS
            </h1>
            <p className="text-xs font-medium tracking-wide text-slate-300">
              Smart Auditorium Booking & Event Management System
            </p>
          </div>
        </div>

        {/* Headline & Subtitle */}
        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white lg:text-4xl">
            Join Your University.{' '}
            <span className="text-brand-gold">Create Your Account.</span>
          </h2>
          <p className="mt-4 text-sm font-normal leading-relaxed text-slate-300/90">
            SABMS helps students, faculty, and staff seamlessly book auditoriums
            and manage events across campus.
          </p>
        </div>
      </div>

      {/* Campus Auditorium Architectural Visual (SVG Neoclassical University Facade) */}
      <div className="relative my-8 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-sm">
        <div className="relative flex h-44 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-blue-950/60 to-slate-900/80 sm:h-52">
          <svg
            className="h-full w-full text-slate-300/40"
            viewBox="0 0 400 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Sky backdrop */}
            <circle
              cx="200"
              cy="50"
              r="45"
              fill="currentColor"
              fillOpacity="0.08"
            />

            {/* Dome */}
            <path
              d="M170 80 Q200 35 230 80 Z"
              fill="currentColor"
              fillOpacity="0.3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="198"
              y="25"
              width="4"
              height="15"
              fill="currentColor"
              fillOpacity="0.6"
            />
            <circle cx="200" cy="22" r="3" fill="#D9A441" />

            {/* Pediment & Frieze */}
            <polygon
              points="140,80 260,80 200,55"
              fill="currentColor"
              fillOpacity="0.25"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect
              x="130"
              y="80"
              width="140"
              height="8"
              fill="currentColor"
              fillOpacity="0.4"
              stroke="currentColor"
              strokeWidth="1"
            />

            {/* Columns */}
            {[150, 170, 190, 210, 230, 250].map((x, i) => (
              <g key={i}>
                <rect
                  x={x - 2}
                  y="88"
                  width="4"
                  height="60"
                  fill="currentColor"
                  fillOpacity="0.5"
                />
                <rect
                  x={x - 4}
                  y="88"
                  width="8"
                  height="3"
                  fill="currentColor"
                  fillOpacity="0.7"
                />
                <rect
                  x={x - 4}
                  y="145"
                  width="8"
                  height="3"
                  fill="currentColor"
                  fillOpacity="0.7"
                />
              </g>
            ))}

            {/* Building Wings */}
            <rect
              x="60"
              y="95"
              width="80"
              height="55"
              fill="currentColor"
              fillOpacity="0.18"
              stroke="currentColor"
              strokeWidth="1"
            />
            <rect
              x="260"
              y="95"
              width="80"
              height="55"
              fill="currentColor"
              fillOpacity="0.18"
              stroke="currentColor"
              strokeWidth="1"
            />

            {/* Windows in Wings */}
            {[75, 95, 115, 275, 295, 315].map((wx, i) => (
              <g key={i}>
                <rect
                  x={wx}
                  y="105"
                  width="10"
                  height="15"
                  rx="1"
                  fill="currentColor"
                  fillOpacity="0.35"
                />
                <rect
                  x={wx}
                  y="128"
                  width="10"
                  height="15"
                  rx="1"
                  fill="currentColor"
                  fillOpacity="0.35"
                />
              </g>
            ))}

            {/* Central Portal Door */}
            <path
              d="M190 148 L190 120 Q200 115 210 120 L210 148 Z"
              fill="#071D3A"
              stroke="currentColor"
              strokeWidth="1"
            />

            {/* Plinth / Steps */}
            <polygon
              points="40,150 360,150 380,180 20,180"
              fill="currentColor"
              fillOpacity="0.35"
            />
            <line
              x1="30"
              y1="160"
              x2="370"
              y2="160"
              stroke="currentColor"
              strokeWidth="1"
              strokeOpacity="0.4"
            />
            <line
              x1="25"
              y1="170"
              x2="375"
              y2="170"
              stroke="currentColor"
              strokeWidth="1"
              strokeOpacity="0.4"
            />

            {/* Lawn / Ground */}
            <rect
              x="0"
              y="180"
              width="400"
              height="20"
              fill="currentColor"
              fillOpacity="0.5"
            />
          </svg>

          {/* Architectural Badge Overlay */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] font-medium text-slate-300 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            Campus Auditorium & Event Facility
          </div>
        </div>
      </div>

      {/* 4 Feature Items Grid */}
      <div className="relative z-10 mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-colors hover:bg-white/10">
          <div className="shrink-0 rounded-lg bg-blue-500/20 p-2 text-blue-300">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">
              Book Auditoriums
            </h4>
            <p className="text-[11px] leading-snug text-slate-300">
              Reserve spaces with ease
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-colors hover:bg-white/10">
          <div className="shrink-0 rounded-lg bg-indigo-500/20 p-2 text-indigo-300">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">Manage Events</h4>
            <p className="text-[11px] leading-snug text-slate-300">
              Organize & track events
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-colors hover:bg-white/10">
          <div className="shrink-0 rounded-lg bg-amber-500/20 p-2 text-amber-300">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">
              Real-time Updates
            </h4>
            <p className="text-[11px] leading-snug text-slate-300">
              Stay informed on approvals
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-colors hover:bg-white/10">
          <div className="shrink-0 rounded-lg bg-emerald-500/20 p-2 text-emerald-300">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">
              Secure & Reliable
            </h4>
            <p className="text-[11px] leading-snug text-slate-300">
              Institutional encryption
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthBranding;
