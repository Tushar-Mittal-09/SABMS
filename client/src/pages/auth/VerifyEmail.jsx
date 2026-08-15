import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, RefreshCw } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthProgress from '../../components/auth/AuthProgress';
import OtpInput from '../../components/auth/OtpInput';
import SuccessState from '../../components/auth/SuccessState';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { authApi } from '../../services/auth.api';
import { maskEmail } from '../../utils/validators';

export const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Retrieve user context from route state or session storage
  const [email] = useState(() => {
    if (location.state?.email) return location.state.email;
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('sabms_onboarding_user');
      if (stored) {
        try {
          return JSON.parse(stored).email || '';
        } catch {
          // ignore
        }
      }
    }
    return '';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    if (location.state?.user) return location.state.user;
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('sabms_onboarding_user');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // ignore
        }
      }
    }
    return null;
  });

  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [alertSuccess, setAlertSuccess] = useState(null);
  const [verificationSuccess, setVerificationSuccess] = useState(null);

  // Cooldown countdown timer (60s default aligned with backend policy)
  const [cooldownRemaining, setCooldownRemaining] = useState(60);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setApiError(null);
    setAlertSuccess(null);

    if (!email) {
      setApiError('Email address is missing. Please return to registration.');
      return;
    }

    if (otp.length !== 6) {
      setApiError('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsVerifying(true);

    try {
      const response = await authApi.verifyEmailOtp({ email, otp });
      const updatedUser = response?.data;
      setVerificationSuccess(
        updatedUser || { ...currentUser, isEmailVerified: true }
      );

      // Update session storage
      if (typeof window !== 'undefined') {
        const updated = {
          ...(currentUser || {}),
          ...(updatedUser || {}),
          isEmailVerified: true,
          status: 'ACTIVE',
        };
        sessionStorage.setItem(
          'sabms_onboarding_user',
          JSON.stringify(updated)
        );
        setCurrentUser(updated);
      }
    } catch (err) {
      if (err.status === 409) {
        // Email already verified, proceed
        setVerificationSuccess(currentUser || { email, isEmailVerified: true });
      } else {
        setApiError(
          err.message || 'The verification code is incorrect. Please try again.'
        );
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldownRemaining > 0 || isResending) return;
    setApiError(null);
    setAlertSuccess(null);

    if (!email) {
      setApiError('Email address is missing. Please restart registration.');
      return;
    }

    setIsResending(true);

    try {
      await authApi.resendEmailOtp({ email });
      setAlertSuccess(
        'A new 6-digit verification code has been dispatched to your email.'
      );
      setCooldownRemaining(60);
      setOtp('');
    } catch (err) {
      // Check if backend returned specific cooldown in message
      const match = err.message?.match(/wait\s+(\d+)\s+seconds/i);
      if (match && match[1]) {
        setCooldownRemaining(parseInt(match[1], 10));
      }
      setApiError(
        err.message || 'Unable to send verification code. Please try again.'
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleProceedNext = () => {
    const hasPhone = Boolean(currentUser?.phone);
    if (hasPhone) {
      navigate('/verify-phone', {
        state: {
          phone: currentUser.phone,
          user: currentUser,
        },
      });
    } else {
      navigate('/verification-status', {
        state: { user: currentUser },
      });
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        {verificationSuccess ? (
          <SuccessState
            title="Email Verified Successfully"
            subtitle="Your university email address has been confirmed and verified."
            maskedIdentifier={maskEmail(email)}
            primaryActionLabel={
              currentUser?.phone
                ? 'Continue to Phone Verification'
                : 'View Verification Status'
            }
            onPrimaryAction={handleProceedNext}
          >
            <AuthProgress
              currentStepIndex={currentUser?.phone ? 2 : 3}
              className="my-2"
            />
          </SuccessState>
        ) : (
          <>
            <AuthHeader
              icon={Mail}
              title="Verify Your University Email"
              subtitle="We sent a 6-digit verification code to"
            />

            {email && (
              <div className="-mt-3 mb-6 flex justify-center">
                <span className="rounded-full border border-blue-200/80 bg-brand-lightBlue px-3.5 py-1 font-mono text-xs font-semibold text-brand-blue dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-blue">
                  {maskEmail(email)}
                </span>
              </div>
            )}

            <AuthProgress currentStepIndex={1} className="mb-6" />

            {apiError && (
              <Alert
                type="error"
                message={apiError}
                onDismiss={() => setApiError(null)}
                className="mb-5"
              />
            )}

            {alertSuccess && (
              <Alert
                type="success"
                message={alertSuccess}
                onDismiss={() => setAlertSuccess(null)}
                className="mb-5"
              />
            )}

            <form onSubmit={handleVerify} className="flex flex-col gap-6">
              {/* 6-Digit OTP Box */}
              <div className="flex flex-col items-center gap-2">
                <OtpInput
                  length={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={isVerifying}
                  hasError={Boolean(apiError)}
                />
                <span className="text-[11px] text-brand-muted dark:text-dark-muted">
                  Enter the 6 numbers from your email inbox
                </span>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isVerifying}
                loadingText="Verifying email..."
                disabled={otp.length !== 6}
                className="w-full font-semibold"
              >
                Verify Email
              </Button>

              {/* Resend Cooldown Section */}
              <div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-2 text-xs dark:border-dark-border/60">
                <span className="text-brand-muted dark:text-dark-muted">
                  Didn't receive the email code?
                </span>

                {cooldownRemaining > 0 ? (
                  <span className="flex items-center gap-1.5 font-medium text-brand-muted dark:text-dark-muted">
                    Resend code in{' '}
                    <strong className="font-mono text-brand-navy dark:text-dark-text">
                      {cooldownRemaining}s
                    </strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="flex items-center gap-1.5 font-semibold text-brand-blue transition-colors hover:text-blue-700 focus:underline focus:outline-none dark:text-dark-blue dark:hover:text-blue-400"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isResending ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {isResending
                        ? 'Sending new code...'
                        : 'Resend verification code'}
                    </span>
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </AuthCard>
    </AuthLayout>
  );
};

export default VerifyEmail;
