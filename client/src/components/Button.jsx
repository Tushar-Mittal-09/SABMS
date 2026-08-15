import { Loader2 } from 'lucide-react';

/**
 * Institutional Primary / Secondary / Ghost Button Component.
 */
export const Button = ({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText,
  disabled = false,
  icon: Icon,
  className = '',
  onClick,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-5 py-3 text-base gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-brand-navy hover:bg-brand-deep active:bg-slate-900 text-white focus:ring-brand-blue shadow-sm dark:bg-brand-blue dark:hover:bg-blue-600 dark:focus:ring-brand-blue',
    secondary:
      'bg-brand-lightBlue hover:bg-blue-100 text-brand-navy border border-blue-200 focus:ring-brand-blue dark:bg-dark-surface2 dark:text-dark-text dark:border-dark-border dark:hover:bg-slate-800',
    outline:
      'bg-transparent hover:bg-slate-100 text-brand-text border border-brand-border focus:ring-brand-blue dark:text-dark-text dark:border-dark-border dark:hover:bg-dark-surface2',
    ghost:
      'bg-transparent hover:bg-slate-100 text-brand-muted hover:text-brand-text focus:ring-brand-blue dark:text-dark-muted dark:hover:text-dark-text dark:hover:bg-dark-surface2',
    gold: 'bg-brand-gold hover:bg-amber-600 active:bg-amber-700 text-slate-900 font-semibold focus:ring-amber-400 shadow-sm',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-current" />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

export default Button;
