import { useRef, useEffect } from 'react';

/**
 * 6-Digit Accessible OTP Input Component.
 * Supports auto-focus, paste distribution, arrow navigation, and backspace.
 */
export const OtpInput = ({
  length = 6,
  value = '',
  onChange,
  disabled = false,
  autoFocus = true,
  hasError = false,
  className = '',
}) => {
  const inputRefs = useRef([]);

  // Ensure digits array matches exact length
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus, disabled]);

  const handleChange = (index, e) => {
    const rawVal = e.target.value;
    // Only accept numeric digits
    const cleanDigit = rawVal.replace(/\D/g, '');

    if (!cleanDigit) {
      // Cleared or empty
      const nextDigits = [...digits];
      nextDigits[index] = '';
      onChange(nextDigits.join(''));
      return;
    }

    const lastDigit = cleanDigit.slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = lastDigit;
    const newOtp = nextDigits.join('');
    onChange(newOtp);

    // Auto advance to next input
    if (index < length - 1 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0 && inputRefs.current[index - 1]) {
        // Current box is empty, move backward and clear previous box
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        onChange(nextDigits.join(''));
        inputRefs.current[index - 1].focus();
      } else {
        const nextDigits = [...digits];
        nextDigits[index] = '';
        onChange(nextDigits.join(''));
      }
    } else if (
      e.key === 'ArrowLeft' &&
      index > 0 &&
      inputRefs.current[index - 1]
    ) {
      e.preventDefault();
      inputRefs.current[index - 1].focus();
    } else if (
      e.key === 'ArrowRight' &&
      index < length - 1 &&
      inputRefs.current[index + 1]
    ) {
      e.preventDefault();
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text/plain');
    const numericOnly = pasteData.replace(/\D/g, '').slice(0, length);
    if (numericOnly) {
      onChange(numericOnly);
      const focusIndex = Math.min(numericOnly.length, length - 1);
      if (inputRefs.current[focusIndex]) {
        inputRefs.current[focusIndex].focus();
      }
    }
  };

  return (
    <div
      className={`flex w-full items-center justify-center gap-2 sm:gap-3 ${className}`}
      role="group"
      aria-label="Verification Code Input"
    >
      {Array.from({ length }).map((_, index) => {
        const isFilled = Boolean(digits[index]);
        return (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d*"
            maxLength={1}
            value={digits[index]}
            disabled={disabled}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            aria-label={`Digit ${index + 1} of ${length}`}
            className={`h-13 sm:w-13 w-11 rounded-xl border text-center font-mono text-xl font-bold transition-all duration-150 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-dark-surface2 sm:h-14 sm:text-2xl ${
              hasError
                ? 'border-red-500 bg-red-50/50 text-red-600 focus:ring-red-500/20 dark:bg-red-950/20 dark:text-red-400'
                : isFilled
                  ? 'border-brand-blue bg-blue-50/30 text-brand-navy focus:border-brand-blue focus:ring-brand-blue/20 dark:border-dark-blue dark:bg-dark-surface2 dark:text-dark-text'
                  : 'border-brand-border bg-white text-brand-text focus:border-brand-blue focus:ring-brand-blue/20 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text dark:focus:border-dark-blue'
            }`}
          />
        );
      })}
    </div>
  );
};

export default OtpInput;
