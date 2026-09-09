import { useState } from 'react';
import {
  Building2,
  Presentation,
  Users2,
  Image as ImageIcon,
  MapPin,
} from 'lucide-react';
import mietLogo from '../../assets/miet-logo.png';

/**
 * Institutional Branded Placeholder & Image Fallback Component.
 *
 * Provides professional, intentional fallback states for venues, campus
 * views, and facility maps when official verified photography is pending.
 * If a valid image URL is supplied, it displays the image; if the image is
 * null or fails to load, it cleanly renders a deliberate institutional treatment.
 */
export const BrandedPlaceholder = ({
  src = null,
  alt = 'MIET Facility',
  type = 'auditorium', // 'auditorium' | 'seminar' | 'conference' | 'campus' | 'map'
  className = '',
  title = '',
  subtitle = '',
}) => {
  const [imgError, setImgError] = useState(false);

  // If a verified image source is provided and hasn't errored, display it.
  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        onError={() => setImgError(true)}
        loading="lazy"
      />
    );
  }

  // Icons based on facility category
  const icons = {
    auditorium: Building2,
    seminar: Presentation,
    conference: Users2,
    campus: Building2,
    map: MapPin,
  };

  const IconComponent = icons[type] || Building2;

  // Deliberate institutional schematic styling for campus map
  if (type === 'map') {
    return (
      <div
        className={`relative flex h-full min-h-[340px] w-full select-none flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-miet-navyDark to-slate-950 p-6 text-center ${className}`}
      >
        {/* Subtle architectural schematic grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px), linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: '24px 24px, 48px 48px, 48px 48px',
          }}
        />

        {/* Schematic Block Nodes Visual Representation */}
        <div className="relative z-10 my-4 w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 font-mono text-[11px] text-gray-300">
            <span className="font-bold text-miet-red">
              CAMPUS DIRECTORY PREVIEW
            </span>
            <span>NH-58 MEERUT</span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
            <div className="rounded border border-white/10 bg-white/10 p-2 font-medium text-white">
              Admin Block
            </div>
            <div className="rounded border border-red-500/40 bg-red-500/20 p-2 font-bold text-red-200">
              ★ Main Aud.
            </div>
            <div className="rounded border border-white/10 bg-white/10 p-2 font-medium text-white">
              Central Library
            </div>
            <div className="rounded border border-white/10 bg-white/10 p-2 font-medium text-white">
              IT Block
            </div>
            <div className="rounded border border-white/5 bg-white/5 p-2 font-medium text-gray-400">
              Campus Quad
            </div>
            <div className="rounded border border-white/10 bg-white/10 p-2 font-medium text-white">
              CS & AI Wing
            </div>
            <div className="rounded border border-white/10 bg-white/10 p-2 font-medium text-white">
              ECE & EE
            </div>
            <div className="rounded border border-white/10 bg-white/10 p-2 font-medium text-white">
              Mech / Civil
            </div>
            <div className="rounded border border-white/10 bg-white/10 p-2 font-medium text-white">
              Applied Sci.
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center space-x-2 text-xs text-gray-400">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span>Campus Directory Preview • Official campus layout pending</span>
        </div>
      </div>
    );
  }

  // Deliberate institutional styling for venue cards & hero/about
  return (
    <div
      className={`relative flex h-full min-h-[190px] w-full select-none flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-miet-navy to-miet-navyDark p-6 text-center ${className}`}
    >
      {/* Background geometric grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute h-36 w-36 rounded-full bg-miet-red/15 blur-2xl" />

      {/* Content */}
      <div className="relative z-10 flex max-w-xs flex-col items-center space-y-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-red-300 shadow-inner">
          <IconComponent className="h-6 w-6" />
        </div>

        {title && (
          <h4 className="text-sm font-bold tracking-wide text-white">
            {title}
          </h4>
        )}

        {subtitle ? (
          <p className="text-xs text-gray-300">{subtitle}</p>
        ) : (
          <div className="flex items-center space-x-1.5 text-[11px] text-gray-400">
            <ImageIcon className="h-3 w-3 text-miet-red" />
            <span>Official photography pending</span>
          </div>
        )}
      </div>

      {/* Institutional subtle watermark */}
      <div className="pointer-events-none absolute bottom-2 right-2 opacity-20">
        <img
          src={mietLogo}
          alt=""
          className="h-6 w-auto brightness-200 grayscale"
        />
      </div>
    </div>
  );
};

export default BrandedPlaceholder;
