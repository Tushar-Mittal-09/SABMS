import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Phone, RefreshCw } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthProgress from '../../components/auth/AuthProgress';
import OtpInput from '../../components/auth/OtpInput';
import SuccessState from '../../components/auth/SuccessState';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { authApi } from '../../services/auth.api';
import { maskPhone } from '../../utils/validators';

export const VerifyPhone = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Retrieve user & phone context
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

  const [phone] = useState(() => {
    if (location.state?.phone) return location.state.phone;
    if (currentUser?.phone) return currentUser.phone;
    return '';
  });

  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [alertSuccess, setAlertSuccess] = useState(null);
  const [verificationSuccess, setVerificationSuccess] = useState(null);

  // 60s cooldown timer
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Automatically request initial Phone OTP on page load if phone is provided
  useEffect(() => {
    if (phone && !currentUser?.isPhoneVerified && !verificationSuccess) {
      authApi
        .resendPhoneOtp({ phone })
        .then(() => {
          setAlertSuccess(
            'A 6-digit verification code has been dispatched via SMS.'
          );
          setCooldownRemaining(60);
        })
        .catch((err) => {
          const match = err.message?.match(/wait\s+(\d+)\s+seconds/i);
          if (match && match[1]) {
            setCooldownRemaining(parseInt(match[1], 10));
          }
        });
    }
  }, [phone]);

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

    if (!phone) {
      setApiError('Phone number is missing. Please restart registration.');
      return;
    }

    if (otp.length !== 6) {
      setApiError('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsVerifying(true);

    try {
      const response = await authApi.verifyPhoneOtp({ phone, otp });
      const updatedUser = response?.data;
      setVerificationSuccess(
        updatedUser || { ...currentUser, isPhoneVerified: true }
      );

      // Update session storage
      if (typeof window !== 'undefined') {
        const updated = {
          ...(currentUser || {}),
          ...(updatedUser || {}),
          isPhoneVerified: true,
        };
        sessionStorage.setItem(
          'sabms_onboarding_user',
          JSON.stringify(updated)
        );
        setCurrentUser(updated);
      }
    } catch (err) {
      if (err.status === 409) {
        // Phone already verified
        setVerificationSuccess(currentUser || { phone, isPhoneVerified: true });
      } else {
        setApiError(
          err.message ||
            'The verification code is incorrect. Please check and try again.'
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

    if (!phone) {
      setApiError('Phone number is missing.');
      return;
    }

    setIsResending(true);

    try {
      await authApi.resendPhoneOtp({ phone });
      setAlertSuccess(
        'A new 6-digit verification code has been dispatched via SMS.'
      );
      setCooldownRemaining(60);
      setOtp('');
    } catch (err) {
      const match = err.message?.match(/wait\s+(\d+)\s+seconds/i);
      if (match && match[1]) {
        setCooldownRemaining(parseInt(match[1], 10));
      }
      setApiError(
        err.message || 'Unable to send SMS verification code. Please try again.'
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleProceedToStatus = () => {
    navigate('/verification-status', {
      state: { user: verificationSuccess || currentUser },
    });
  };

  return (
    <AuthLayout>
      <AuthCard>
        {verificationSuccess ? (
          <SuccessState
            title="Phone Verified Successfully"
            subtitle="Your registered phone number has been verified for security notifications."
            maskedIdentifier={maskPhone(phone)}
            primaryActionLabel="View Verification Status"
            onPrimaryAction={handleProceedToStatus}
          >
            <AuthProgress currentStepIndex={3} className="my-2" />
          </SuccessState>
        ) : !phone ? (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/40">
              <Phone className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-brand-navy dark:text-dark-text">
              No Phone Number Registered
            </h2>
            <p className="mt-2 max-w-sm text-xs text-brand-muted dark:text-dark-muted sm:text-sm">
              You registered without providing a phone number. Phone
              verification can be completed later in your profile.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={handleProceedToStatus}
              className="mt-6 w-full"
            >
              Proceed to Verification Status
            </Button>
          </div>
        ) : (
          <>
            <AuthHeader
              icon={Phone}
              title="Verify Your Phone Number"
              subtitle="Enter the 6-digit code sent to your registered phone number"
            />

            {phone && (
              <div className="-mt-3 mb-6 flex justify-center">
                <span className="rounded-full border border-blue-200/80 bg-brand-lightBlue px-3.5 py-1 font-mono text-xs font-semibold text-brand-blue dark:border-dark-border dark:bg-dark-surface2 dark:text-dark-blue">
                  {maskPhone(phone)}
                </span>
              </div>
            )}

            <AuthProgress currentStepIndex={2} className="mb-6" />

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
                  Enter the 6 numbers from your SMS message
                </span>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isVerifying}
                loadingText="Verifying phone..."
                disabled={otp.length !== 6}
                className="w-full font-semibold"
              >
                Verify Phone Number
              </Button>

              {/* Resend Section */}
              <div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-2 text-xs dark:border-dark-border/60">
                <span className="text-brand-muted dark:text-dark-muted">
                  Didn't receive the SMS code?
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

export default VerifyPhone;
