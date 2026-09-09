import {
  MapPin,
  Phone,
  Mail,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  ArrowUp,
} from 'lucide-react';
import {
  ASSETS,
  INSTITUTION,
  FOOTER_QUICK_LINKS,
  FOOTER_RESOURCES,
} from '../../constants/landing.data';

export const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      id="contact"
      className="border-t border-gray-800 bg-miet-dark text-sm text-gray-400"
    >
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Institutional Branding & Overview */}
          <div className="space-y-4 lg:col-span-4">
            <div className="flex max-w-fit items-center space-x-3 rounded-xl bg-white p-2.5 shadow-sm">
              <img
                src={ASSETS.logo}
                alt={`${INSTITUTION.shortName} Logo`}
                className="h-12 w-auto object-contain"
              />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white">
                {INSTITUTION.name}
              </h3>
              <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
                {INSTITUTION.status}
              </p>
              <p className="max-w-sm text-xs leading-relaxed text-gray-400">
                Committed to academic excellence, innovation, and holistic
                development. SABMS streamlines scheduling and resource
                management across all campus venues.
              </p>
            </div>

            {/* Social Icons */}
            <div className="flex items-center space-x-3 pt-2">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-gray-300 transition-colors hover:bg-miet-red hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
                aria-label="MIET Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-gray-300 transition-colors hover:bg-miet-red hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
                aria-label="MIET Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-gray-300 transition-colors hover:bg-miet-red hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
                aria-label="MIET LinkedIn"
              >
                <Linkedin className="h-4 w-4" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-gray-300 transition-colors hover:bg-miet-red hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
                aria-label="MIET YouTube"
              >
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3 lg:col-span-2">
            <h4 className="border-b border-gray-800 pb-2 text-xs font-bold uppercase tracking-wider text-white">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs">
              {FOOTER_QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="rounded transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-miet-red"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources & Policies */}
          <div className="space-y-3 lg:col-span-3">
            <h4 className="border-b border-gray-800 pb-2 text-xs font-bold uppercase tracking-wider text-white">
              Useful Resources
            </h4>
            <ul className="space-y-2 text-xs">
              {FOOTER_RESOURCES.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="rounded transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-miet-red"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Institutional Contact */}
          <div className="space-y-3 lg:col-span-3">
            <h4 className="border-b border-gray-800 pb-2 text-xs font-bold uppercase tracking-wider text-white">
              Institutional Contact
            </h4>
            <div className="space-y-2.5 text-xs text-gray-400">
              <div className="flex items-start space-x-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-miet-red" />
                <span>{INSTITUTION.address}</span>
              </div>

              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 shrink-0 text-miet-red" />
                <a
                  href={`tel:${INSTITUTION.phone.replace(/\s+/g, '')}`}
                  className="rounded transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-miet-red"
                >
                  {INSTITUTION.phone}
                </a>
              </div>

              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 shrink-0 text-miet-red" />
                <a
                  href={`mailto:${INSTITUTION.email}`}
                  className="rounded transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-miet-red"
                >
                  {INSTITUTION.email}
                </a>
              </div>
            </div>

            {/* Back to top button */}
            <div className="pt-3">
              <button
                type="button"
                onClick={scrollToTop}
                className="inline-flex items-center space-x-1.5 rounded text-xs text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
              >
                <ArrowUp className="h-3.5 w-3.5" />
                <span>Back to Top</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & System Identification */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-800 pt-8 text-xs text-gray-500 sm:flex-row">
          <p>© 2026 MIET. All rights reserved.</p>
          <p className="font-medium text-gray-400">
            Smart Auditorium Booking & Management System (SABMS)
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
