import { GraduationCap } from 'lucide-react';

/**
 * Academic Auth Card Header with icon badge.
 */
export const AuthHeader = ({
  icon: Icon = GraduationCap,
  title,
  subtitle,
  className = '',
}) => {
  return (
    <div className={`mb-6 flex flex-col items-center text-center ${className}`}>
      <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-brand-lightBlue text-brand-blue shadow-sm dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-blue">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-brand-navy dark:text-dark-text sm:text-3xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1.5 max-w-sm text-xs text-brand-muted dark:text-dark-muted sm:text-sm">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default AuthHeader;
