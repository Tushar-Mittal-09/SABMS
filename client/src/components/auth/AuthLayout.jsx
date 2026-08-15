import { useState, useEffect } from 'react';
import { Sun, Moon, HelpCircle, Shield } from 'lucide-react';
import AuthBranding from './AuthBranding';

/**
 * Split Screen Institutional Authentication Layout.
 * Includes theme toggle and university support header.
 */
export const AuthLayout = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sabms_theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('sabms_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('sabms_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-brand-bg text-brand-text transition-colors duration-200 dark:bg-dark-bg dark:text-dark-text">
      {/* Top Utility Header */}
      <header className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-brand-border/40 bg-white/60 px-6 py-3.5 backdrop-blur-md dark:border-dark-border/40 dark:bg-dark-surface/60">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-brand-navy dark:text-dark-text">
            SABMS Portal
          </span>
          <span className="rounded-full border border-blue-200/60 bg-brand-lightBlue px-2 py-0.5 text-[11px] font-semibold text-brand-blue dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-blue">
            University Auth
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-brand-muted dark:text-dark-muted">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 rounded-lg p-1.5 text-brand-muted transition-colors hover:bg-slate-100 hover:text-brand-text dark:text-dark-muted dark:hover:bg-dark-surface2 dark:hover:text-dark-text"
            aria-label="Toggle color theme"
          >
            {isDarkMode ? (
              <>
                <Sun className="h-4 w-4 text-amber-400" />
                <span className="hidden sm:inline">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-slate-600" />
                <span className="hidden sm:inline">Dark Mode</span>
              </>
            )}
          </button>

          <a
            href="mailto:support@sabms.edu"
            className="flex items-center gap-1 transition-colors hover:text-brand-blue dark:hover:text-dark-blue"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Need help?</span> Contact Support
          </a>
        </div>
      </header>

      {/* Main Split Grid */}
      <main className="flex w-full flex-1 flex-col lg:flex-row">
        {/* Left University Branding Panel (Desktop) */}
        <div className="hidden shrink-0 lg:flex lg:w-[42%] xl:w-[38%]">
          <AuthBranding className="w-full" />
        </div>

        {/* Right Form Container */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-4 sm:p-8 lg:p-12">
          {children}

          {/* Institutional Footer */}
          <footer className="mt-8 flex flex-col items-center gap-1 text-center text-xs text-brand-muted dark:text-dark-muted">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-brand-navy/60 dark:text-dark-muted" />
              <span>
                © {new Date().getFullYear()} SABMS. All rights reserved.
              </span>
            </div>
            <p className="text-[11px] opacity-75">
              Official University Auditorium Booking & Event Management System.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
