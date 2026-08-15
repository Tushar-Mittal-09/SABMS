/**
 * Standard Auth Card Container.
 */
export const AuthCard = ({ children, className = '' }) => {
  return (
    <div
      className={`w-full max-w-xl animate-scale-up rounded-2xl border border-brand-border bg-white p-6 shadow-card transition-colors duration-200 dark:border-dark-border dark:bg-dark-surface dark:shadow-card-dark sm:p-10 ${className}`}
    >
      {children}
    </div>
  );
};

export default AuthCard;
