import { Loader2 } from 'lucide-react';

/**
 * Centered Loading Spinner Component.
 */
export const Loading = ({
  text = 'Loading...',
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 p-6 ${className}`}
      role="status"
    >
      <Loader2
        className={`${sizeMap[size] || sizeMap.md} animate-spin text-brand-navy dark:text-dark-blue`}
      />
      {text && (
        <p className="text-xs font-medium text-brand-muted dark:text-dark-muted">
          {text}
        </p>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
};

export default Loading;
