import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, ExternalLink, Compass } from 'lucide-react';
import {
  ASSETS,
  CAMPUS_MAP_BLOCKS,
  OTHER_FACILITIES,
} from '../../constants/landing.data';
import BrandedPlaceholder from './BrandedPlaceholder';

export const CampusMapSection = () => {
  const [interactiveModal, setInteractiveModal] = useState(false);
  const triggerButtonRef = useRef(null);
  const modalContainerRef = useRef(null);
  const modalCloseButtonRef = useRef(null);

  // Handle Focus Trap, Escape key, and body scroll lock for interactive map modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!interactiveModal) return;

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

    if (interactiveModal) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
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
  }, [interactiveModal]);

  const openModal = (e) => {
    triggerButtonRef.current = e.currentTarget;
    setInteractiveModal(true);
  };

  const closeModal = () => {
    setInteractiveModal(false);
    setTimeout(() => {
      triggerButtonRef.current?.focus();
    }, 50);
  };

  return (
    <section id="campus-map" className="bg-miet-bg py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-12 max-w-3xl space-y-3">
          <div className="inline-flex items-center rounded-full bg-red-100/70 px-3 py-1 text-xs font-bold uppercase tracking-wider text-miet-red">
            CAMPUS DIRECTORY PREVIEW
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-miet-navy sm:text-4xl">
            Find Your Venue
          </h2>
          <p className="text-base font-normal text-gray-600 sm:text-lg">
            Explore the MIET campus directory preview to locate auditoriums,
            seminar halls and important facilities across academic blocks.
            Official campus layout pending.
          </p>
        </div>

        {/* Polished Directory Card with Split View */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Campus Layout Display (Schematic Preview) */}
            <div className="flex flex-col justify-between border-b border-gray-200 bg-gray-50 p-4 sm:p-6 lg:col-span-8 lg:border-b-0 lg:border-r">
              <div className="group relative min-h-[340px] overflow-hidden rounded-xl border border-gray-300/80 bg-slate-900 shadow-sm">
                <BrandedPlaceholder
                  src={ASSETS.campusMap}
                  alt="Campus Directory Preview"
                  type="map"
                  className="h-full w-full"
                />

                {/* Campus Directory Watermark */}
                <div className="absolute left-3 top-3 z-10 flex items-center space-x-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-1.5 text-xs font-bold text-miet-navy shadow-sm backdrop-blur-md">
                  <Compass className="h-4 w-4 text-miet-red" />
                  <span>Campus Directory Preview</span>
                </div>

                <div className="absolute bottom-3 right-3 z-10 rounded-md bg-miet-navy/95 px-3 py-1 text-[11px] text-white backdrop-blur-md">
                  Official campus layout pending
                </div>
              </div>

              {/* Bottom Interactive Trigger */}
              <div className="mt-4 flex flex-col justify-between gap-3 border-t border-gray-200 pt-3 sm:flex-row sm:items-center">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <MapPin className="h-4 w-4 text-miet-red" />
                  <span>
                    Main Auditorium located at Central Academic Complex
                  </span>
                </div>

                <button
                  type="button"
                  onClick={openModal}
                  className="inline-flex items-center justify-center rounded-lg bg-miet-red px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-miet-redHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-2 sm:text-sm"
                >
                  <Navigation className="mr-1.5 h-3.5 w-3.5" />
                  <span>View Interactive Directory</span>
                </button>
              </div>
            </div>

            {/* Academic Blocks & Facilities Legend */}
            <div className="flex flex-col justify-between bg-white p-6 sm:p-8 lg:col-span-4">
              <div className="space-y-6">
                <div>
                  <h3 className="flex items-center justify-between border-b border-gray-100 pb-2 text-xs font-bold uppercase tracking-wider text-miet-navy">
                    <span>Academic Blocks (Preview)</span>
                    <span className="text-[11px] font-normal text-gray-500">
                      10 Blocks
                    </span>
                  </h3>
                  <div className="mt-3 space-y-1.5">
                    {CAMPUS_MAP_BLOCKS.map((block) => (
                      <div
                        key={block.id}
                        className="flex items-center rounded-md px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <span className="mr-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-miet-red">
                          {block.id}
                        </span>
                        <span className="font-medium">{block.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="border-b border-gray-100 pb-2 text-xs font-bold uppercase tracking-wider text-miet-navy">
                    Campus Facilities
                  </h3>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {OTHER_FACILITIES.map((facility) => (
                      <span
                        key={facility}
                        className="rounded bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700"
                      >
                        • {facility}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-gray-100 pt-4">
                <a
                  href="https://maps.google.com/?q=Meerut+Institute+of+Engineering+and+Technology"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 hover:text-miet-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-1"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  <span>Open MIET in Google Maps</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Map Modal with Focus Containment */}
      {interactiveModal && (
        <div
          className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            ref={modalContainerRef}
            className="max-h-[90vh] w-full max-w-3xl animate-scale-up overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-miet-navy">
                  Campus Directory Preview
                </h3>
                <p className="text-xs text-gray-500">
                  Schematic overview of academic blocks and event
                  infrastructure. Official campus layout pending.
                </p>
              </div>
              <button
                ref={modalCloseButtonRef}
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
                aria-label="Close directory preview"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-slate-900 p-2">
              <BrandedPlaceholder
                src={ASSETS.campusMap}
                alt="Campus Directory Preview"
                type="map"
                className="h-auto min-h-[300px] w-full"
              />
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
              >
                Close Directory
              </button>
              <a
                href="https://maps.google.com/?q=Meerut+Institute+of+Engineering+and+Technology"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg bg-miet-red px-4 py-2 text-xs font-semibold text-white hover:bg-miet-redHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-1"
              >
                <span>Navigate via Google Maps</span>
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CampusMapSection;
