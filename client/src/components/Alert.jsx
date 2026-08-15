import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

/**
 * Contextual Alert Notification Banner.
 */
export const Alert = ({
  type = 'info',
  title,
  message,
  children,
  onDismiss,
  className = '',
}) => {
  const styles = {
    info: {
      container:
        'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-200',
      icon: Info,
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    success: {
      container:
        'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-200',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    warning: {
      container:
        'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-200',
      icon: AlertTriangle,
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    error: {
      container:
        'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-200',
      icon: AlertCircle,
      iconColor: 'text-red-600 dark:text-red-400',
    },
  };

  const current = styles[type] || styles.info;
  const Icon = current.icon;

  return (
    <div
      role="alert"
      className={`flex animate-fade-in items-start gap-3 rounded-lg border p-3.5 text-sm ${current.container} ${className}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${current.iconColor}`} />
      <div className="min-w-0 flex-1">
        {title && (
          <h4 className="mb-0.5 text-xs font-semibold uppercase tracking-wider">
            {title}
          </h4>
        )}
        <div className="text-xs leading-relaxed opacity-90">
          {message || children}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4 opacity-70" />
        </button>
      )}
    </div>
  );
};

export default Alert;
