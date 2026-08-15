import { useState, forwardRef } from 'react';
import { Eye, EyeOff, Lock, Check, Circle } from 'lucide-react';
import { getPasswordStrength } from '../../utils/validators';

/**
 * University-grade PasswordInput Component with dynamic strength indicator & requirement checklist.
 */
export const PasswordInput = forwardRef(
  (
    {
      label = 'Password',
      id = 'password',
      name = 'password',
      value = '',
      onChange,
      onBlur,
      placeholder = 'Create a strong password',
      error,
      required = true,
      disabled = false,
      showRequirements = true,
      className = '',
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const strength = getPasswordStrength(value);
    const { checks } = strength;

    const requirementsList = [
      { id: 'length', label: '8–128 characters', met: checks.length },
      {
        id: 'uppercase',
        label: 'Uppercase letter (A–Z)',
        met: checks.uppercase,
      },
      {
        id: 'lowercase',
        label: 'Lowercase letter (a–z)',
        met: checks.lowercase,
      },
      { id: 'number', label: 'Number (0–9)', met: checks.number },
      {
        id: 'special',
        label: 'Special character (@$!%*?&#^~_-)',
        met: checks.special,
      },
    ];

    return (
      <div className="flex w-full flex-col gap-1.5">
        <label
          htmlFor={id}
          className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-brand-text/80 dark:text-dark-text/80"
        >
          <span>
            {label}
            {required && <span className="ml-0.5 text-red-500">*</span>}
          </span>
        </label>

        <div className="relative flex items-center">
          <div className="pointer-events-none absolute left-3.5 flex items-center text-brand-muted dark:text-dark-muted">
            <Lock className="h-4 w-4" />
          </div>

          <input
            ref={ref}
            id={id}
            name={name}
            type={showPassword ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
              setIsFocused(false);
              if (onBlur) onBlur(e);
            }}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-11 text-sm text-brand-text transition-colors duration-150 placeholder:text-brand-muted/60 focus:outline-none focus:ring-2 disabled:bg-slate-50 dark:bg-dark-surface dark:text-dark-text dark:placeholder:text-dark-muted/60 dark:disabled:bg-dark-surface2 ${
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-brand-border focus:border-brand-blue focus:ring-brand-blue/20 dark:border-dark-border dark:focus:border-dark-blue dark:focus:ring-dark-blue/20'
            } ${className}`}
            {...props}
          />

          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 rounded p-1 text-brand-muted transition-colors hover:text-brand-text dark:text-dark-muted dark:hover:text-dark-text"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {error && (
          <p
            className="mt-0.5 animate-fade-in text-xs font-medium text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Dynamic Strength Meter & Checklist */}
        {showRequirements && (value.length > 0 || isFocused) && (
          <div className="mt-2 animate-fade-in rounded-lg border border-slate-200/80 bg-slate-50 p-3 text-xs dark:border-dark-border/80 dark:bg-dark-surface2/60">
            {/* Strength Bar */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-brand-muted dark:text-dark-muted">
                Password strength:{' '}
                <span className={`font-semibold ${strength.textClass}`}>
                  {strength.label}
                </span>
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-1.5 w-7 rounded-full transition-all duration-300 ${
                      strength.score >= step
                        ? strength.colorClass
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Checklist Grid */}
            <div className="grid grid-cols-1 gap-1.5 border-t border-slate-200/60 pt-1.5 dark:border-dark-border/60 sm:grid-cols-2">
              {requirementsList.map((req) => (
                <div
                  key={req.id}
                  className={`flex items-center gap-1.5 transition-colors duration-150 ${
                    req.met
                      ? 'font-medium text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {req.met ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
                  )}
                  <span className="text-[11px]">{req.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
