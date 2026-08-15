import { Check } from 'lucide-react';

const STEPS = [
  { id: 'account', label: 'Account', fullLabel: 'Account Created' },
  { id: 'email', label: 'Email', fullLabel: 'Email Verification' },
  { id: 'phone', label: 'Phone', fullLabel: 'Phone Verification' },
  { id: 'complete', label: 'Complete', fullLabel: 'Verification Complete' },
];

/**
 * Institutional Verification Step Progress Tracker.
 */
export const AuthProgress = ({ currentStepIndex = 0, className = '' }) => {
  return (
    <div
      className={`w-full py-3 ${className}`}
      aria-label="Onboarding Progress"
    >
      <ol className="flex w-full items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <li
              key={step.id}
              className={`flex flex-1 items-center ${
                index !== STEPS.length - 1
                  ? 'after:mx-2 after:h-0.5 after:w-full after:transition-colors after:content-[""]'
                  : ''
              } ${
                index < currentStepIndex
                  ? 'after:bg-emerald-500'
                  : 'after:bg-slate-200 dark:after:bg-slate-700'
              }`}
            >
              <div className="group flex flex-col items-center gap-1">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200 sm:h-8 sm:w-8 ${
                    isCompleted
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/30'
                      : isCurrent
                        ? 'bg-brand-navy text-white shadow-sm ring-4 ring-brand-blue/20 dark:bg-brand-blue'
                        : 'border border-slate-300 bg-slate-100 text-slate-400 dark:border-dark-border dark:bg-dark-surface2 dark:text-slate-500'
                  }`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4 stroke-[2.5] text-white" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={`hidden whitespace-nowrap text-[11px] font-medium tracking-tight sm:block sm:text-xs ${
                    isCurrent
                      ? 'font-bold text-brand-navy dark:text-dark-text'
                      : isCompleted
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-brand-muted dark:text-dark-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default AuthProgress;
