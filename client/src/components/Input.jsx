import { forwardRef } from 'react';

/**
 * Standard Accessible Input Component.
 */
export const Input = forwardRef(
  (
    {
      label,
      id,
      name,
      type = 'text',
      value,
      onChange,
      onBlur,
      placeholder,
      error,
      helperText,
      required = false,
      disabled = false,
      icon: Icon,
      rightElement,
      className = '',
      ...props
    },
    ref
  ) => {
    const inputId = id || name;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-brand-text/80 dark:text-dark-text/80"
          >
            <span>
              {label}
              {required && <span className="ml-0.5 text-red-500">*</span>}
            </span>
          </label>
        )}

        <div className="relative flex items-center">
          {Icon && (
            <div className="pointer-events-none absolute left-3.5 flex items-center text-brand-muted dark:text-dark-muted">
              <Icon className="h-4 w-4" />
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId || helperId}
            className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-brand-text transition-colors duration-150 placeholder:text-brand-muted/60 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 dark:bg-dark-surface dark:text-dark-text dark:placeholder:text-dark-muted/60 dark:disabled:bg-dark-surface2 ${
              Icon ? 'pl-10' : ''
            } ${rightElement ? 'pr-11' : ''} ${
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-brand-border focus:border-brand-blue focus:ring-brand-blue/20 dark:border-dark-border dark:focus:border-dark-blue dark:focus:ring-dark-blue/20'
            } ${className}`}
            {...props}
          />

          {rightElement && (
            <div className="absolute right-3 flex items-center">
              {rightElement}
            </div>
          )}
        </div>

        {error ? (
          <p
            id={errorId}
            className="mt-0.5 flex animate-fade-in items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        ) : helperText ? (
          <p
            id={helperId}
            className="mt-0.5 text-xs text-brand-muted dark:text-dark-muted"
          >
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
