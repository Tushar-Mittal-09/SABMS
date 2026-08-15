import { CheckCircle2, ArrowRight } from 'lucide-react';
import Button from '../Button';

/**
 * Reusable Intermediate Success State Card Content.
 */
export const SuccessState = ({
  title = 'Success',
  subtitle,
  maskedIdentifier,
  primaryActionLabel = 'Continue',
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  children,
}) => {
  return (
    <div className="flex animate-scale-up flex-col items-center py-4 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-600 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
        <CheckCircle2 className="h-10 w-10 stroke-[2]" />
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-brand-navy dark:text-dark-text">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-brand-muted dark:text-dark-muted">
          {subtitle}
        </p>
      )}

      {maskedIdentifier && (
        <div className="mt-3 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1.5 font-mono text-xs font-medium text-brand-text dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-text">
          {maskedIdentifier}
        </div>
      )}

      {children && <div className="my-6 w-full">{children}</div>}

      <div className="mt-6 flex w-full flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={onPrimaryAction}
          className="w-full"
        >
          <span>{primaryActionLabel}</span>
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>

        {secondaryActionLabel && onSecondaryAction && (
          <Button
            variant="ghost"
            size="md"
            onClick={onSecondaryAction}
            className="w-full"
          >
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </div>
  );
};

export default SuccessState;
