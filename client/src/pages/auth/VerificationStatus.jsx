import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthProgress from '../../components/auth/AuthProgress';
import VerificationSummary from '../../components/auth/VerificationSummary';
import Button from '../../components/Button';

export const VerificationStatus = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Retrieve authoritative user payload
  const [user] = useState(() => {
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
    return {
      name: 'University Member',
      email: 'user@university.edu',
      role: 'STUDENT',
      status: 'ACTIVE',
      isEmailVerified: true,
      isPhoneVerified: true,
    };
  });

  const handleStartNew = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('sabms_onboarding_user');
    }
    navigate('/register');
  };

  return (
    <AuthLayout>
      <AuthCard>
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 animate-scale-up items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-emerald-600 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-brand-navy dark:text-dark-text sm:text-3xl">
            You're All Set!
          </h2>
          <p className="mt-1.5 max-w-sm text-xs text-brand-muted dark:text-dark-muted sm:text-sm">
            Your SABMS university account verification is complete.
          </p>
        </div>

        <AuthProgress currentStepIndex={3} className="mb-6" />

        {/* Verification Summary */}
        <VerificationSummary user={user} className="mb-6" />

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            size="md"
            icon={ArrowLeft}
            onClick={handleStartNew}
            className="w-full"
          >
            Register Another Account
          </Button>

          <p className="mt-2 text-center text-[11px] text-brand-muted dark:text-dark-muted">
            Authentication services (Sprint 2.7+) will be enabled in upcoming
            releases.
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  );
};

export default VerificationStatus;
