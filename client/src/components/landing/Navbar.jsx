import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Menu, X, User } from 'lucide-react';
import { ASSETS, NAV_LINKS, INSTITUTION } from '../../constants/landing.data';
import { useAuthStore } from '../../store/auth.store';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('home');

  const { isAuthenticated, user } = useAuthStore();
  const searchInputRef = useRef(null);
  const hamburgerButtonRef = useRef(null);
  const drawerContainerRef = useRef(null);

  // Scroll listener for sticky styling and scroll-spy
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      const sections = [
        'home',
        'venues',
        'how-it-works',
        'guidelines',
        'about',
        'contact',
      ];
      const scrollPosition = window.scrollY + 120;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Global Escape key, Focus Trap, and body scroll lock for mobile menu and search modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (mobileMenuOpen) {
          e.preventDefault();
          closeMobileMenu();
        }
        if (searchOpen) {
          e.preventDefault();
          setSearchOpen(false);
        }
        return;
      }

      // Focus trap for Mobile Drawer
      if (mobileMenuOpen && drawerContainerRef.current && e.key === 'Tab') {
        const focusable = drawerContainerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

    if (mobileMenuOpen || searchOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      if (mobileMenuOpen) {
        setTimeout(() => {
          const firstLink =
            drawerContainerRef.current?.querySelector('a[href]');
          firstLink?.focus();
        }, 50);
      }
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen, searchOpen]);

  // Focus search input when search modal opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setTimeout(() => {
      hamburgerButtonRef.current?.focus();
    }, 50);
  };

  const handleNavClick = (href) => {
    closeMobileMenu();
    if (href.startsWith('#')) {
      const targetId = href.substring(1);
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          isScrolled
            ? 'border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur-md'
            : 'border-b border-gray-200 bg-white'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between sm:h-20">
            {/* MIET Logo & SABMS Brand */}
            <div className="flex items-center space-x-3">
              <a
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick('#home');
                }}
                className="group flex items-center space-x-3 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-2"
                aria-label="MIET SABMS Home"
              >
                <img
                  src={ASSETS.logo}
                  alt={`${INSTITUTION.shortName} - ${INSTITUTION.status}`}
                  className="h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02] sm:h-14"
                />
                <div className="hidden flex-col border-l border-gray-300 pl-3 sm:flex">
                  <span className="font-sans text-xs font-bold uppercase tracking-wider text-miet-navy">
                    SABMS
                  </span>
                  <span className="text-[10px] font-medium leading-tight text-gray-500">
                    Auditorium Booking System
                  </span>
                </div>
              </a>
            </div>

            {/* Desktop Navigation Links */}
            <nav
              className="hidden items-center space-x-1 lg:flex xl:space-x-2"
              aria-label="Primary Navigation"
            >
              {NAV_LINKS.map((link) => {
                const isActive = activeSection === link.href.replace('#', '');
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(link.href);
                    }}
                    className={`relative rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-1 ${
                      isActive
                        ? 'font-semibold text-miet-red'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-miet-red'
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-miet-red" />
                    )}
                  </a>
                );
              })}
            </nav>

            {/* Right Side: Search & Auth Actions */}
            <div className="flex items-center space-x-1.5 sm:space-x-3">
              {/* Quick Venue Search Trigger */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-miet-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-1"
                aria-label="Search venues or auditoriums"
              >
                <Search className="h-5 w-5" />
              </button>

              {/* Auth Controls: Displayed cleanly on desktop & tablet; accessible in mobile drawer on small screens */}
              {isAuthenticated ? (
                <Link
                  to="/sessions"
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-miet-navy px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-miet-navyLight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-navy focus-visible:ring-offset-2 sm:px-3.5 sm:py-2 sm:text-sm"
                >
                  <User className="h-4 w-4 shrink-0 text-miet-red" />
                  <span className="hidden sm:inline">
                    {user?.name?.split(' ')[0] || 'My Account'}
                  </span>
                  <span className="sm:hidden">Portal</span>
                </Link>
              ) : (
                <div className="hidden items-center space-x-2 sm:flex">
                  <Link
                    to="/login"
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-miet-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-1 sm:px-3.5 sm:py-2 sm:text-sm"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-miet-red px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-150 hover:bg-miet-redHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-2 sm:px-4 sm:py-2 sm:text-sm"
                  >
                    Sign Up
                  </Link>
                </div>
              )}

              {/* Mobile Hamburger Menu Button */}
              <button
                ref={hamburgerButtonRef}
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-miet-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-1 lg:hidden"
                aria-expanded={mobileMenuOpen}
                aria-label={
                  mobileMenuOpen
                    ? 'Close navigation menu'
                    : 'Open navigation menu'
                }
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer & Backdrop with Focus Trap */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 top-16 z-50 flex flex-col sm:top-20 lg:hidden">
            {/* Backdrop */}
            <div
              className="backdrop-blur-xs fixed inset-0 bg-black/50 transition-opacity"
              onClick={closeMobileMenu}
              aria-hidden="true"
            />

            {/* Drawer Content */}
            <div
              ref={drawerContainerRef}
              role="dialog"
              aria-label="Mobile Navigation Menu"
              aria-modal="true"
              className="relative z-10 max-h-[calc(100vh-4rem)] animate-fade-in space-y-2 overflow-y-auto border-t border-gray-200 bg-white px-4 pb-8 pt-3 shadow-xl"
            >
              {NAV_LINKS.map((link) => {
                const isActive = activeSection === link.href.replace('#', '');
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(link.href);
                    }}
                    className={`block rounded-lg px-3 py-2.5 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red ${
                      isActive
                        ? 'bg-red-50 font-semibold text-miet-red'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-miet-red'
                    }`}
                  >
                    {link.label}
                  </a>
                );
              })}

              <div className="flex flex-col gap-2 border-t border-gray-200 pt-4">
                {isAuthenticated ? (
                  <Link
                    to="/sessions"
                    onClick={closeMobileMenu}
                    className="w-full rounded-lg bg-miet-navy px-4 py-2.5 text-center font-medium text-white transition-colors hover:bg-miet-navyLight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-navy focus-visible:ring-offset-2"
                  >
                    Go to Portal / Sessions
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={closeMobileMenu}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center font-medium text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-2"
                    >
                      Login to SABMS
                    </Link>
                    <Link
                      to="/register"
                      onClick={closeMobileMenu}
                      className="w-full rounded-lg bg-miet-red px-4 py-2.5 text-center font-medium text-white transition-colors hover:bg-miet-redHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red focus-visible:ring-offset-2"
                    >
                      Create Account (Sign Up)
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Quick Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex animate-fade-in items-start justify-center bg-black/60 px-4 pt-20 backdrop-blur-sm sm:pt-24"
          role="dialog"
          aria-modal="true"
          aria-label="Venue search dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
                Search Venues & Auditoriums
              </h3>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
                aria-label="Close search"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-3.5 top-3 h-5 w-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by venue name, hall, or capacity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchOpen(false);
                  if (e.key === 'Enter') {
                    setSearchOpen(false);
                    handleNavClick('#venues');
                  }
                }}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-11 pr-4 text-sm focus:border-miet-red focus:outline-none focus:ring-2 focus:ring-miet-red"
              />
            </div>

            <div className="mt-4 flex flex-col items-start justify-between gap-2 text-xs text-gray-500 sm:flex-row sm:items-center">
              <span>Press [Enter] to browse venues or [Esc] to exit</span>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  handleNavClick('#venues');
                }}
                className="rounded font-semibold text-miet-red hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miet-red"
              >
                Browse All Venues →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
