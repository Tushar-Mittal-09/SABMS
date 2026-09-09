import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Mail, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthHeader from '../../components/auth/AuthHeader';
import PasswordInput from '../../components/auth/PasswordInput';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { authApi } from '../../services/auth.api';
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
} from '../../utils/validators';

export const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const initialEmail = location.state?.email || '';

  const [formData, setFormData] = useState({
    email: initialEmail,
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (apiError) setApiError(null);
  };

  const validateForm = () => {
    const errors = {};

    const emailErr = validateEmail(formData.email);
    if (emailErr) errors.email = emailErr;

    if (!formData.otp || !/^\d{6}$/.test(formData.otp.trim())) {
      errors.otp = 'Verification code must be exactly 6 digits';
    }

    const pwdErr = validatePassword(formData.newPassword);
    if (pwdErr) errors.newPassword = pwdErr;

    const confirmErr = validateConfirmPassword(
      formData.newPassword,
      formData.confirmPassword
    );
    if (confirmErr) errors.confirmPassword = confirmErr;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setApiError(null);

    try {
      await authApi.resetPassword({
        email: formData.email,
        otp: formData.otp,
        newPassword: formData.newPassword,
      });
      setIsSuccess(true);
    } catch (err) {
      setApiError(
        err.message || 'Password reset failed. Please check code and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Reset Account Password"
          subtitle="Enter your 6-digit recovery code and choose a strong new password"
        />

        {apiError && (
          <div className="mb-6">
            <Alert
              type="error"
              title="Reset Failed"
              message={apiError}
              onClose={() => setApiError(null)}
            />
          </div>
        )}

        {isSuccess ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Password Successfully Reset
              </h3>
              <p className="text-sm text-gray-600">
                All existing sessions have been terminated. Please sign in with
                your new credentials.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate('/login', { replace: true })}
            >
              Sign In Now
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <Input
              id="reset-email"
              name="email"
              type="email"
              label="Institutional Email"
              value={formData.email}
              onChange={handleInputChange}
              error={fieldErrors.email}
              placeholder="student@university.edu"
              icon={Mail}
              autoComplete="email"
              required
              disabled={isLoading}
            />

            <Input
              id="reset-otp"
              name="otp"
              type="text"
              label="6-Digit Verification Code"
              value={formData.otp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setFormData((prev) => ({ ...prev, otp: val }));
                if (fieldErrors.otp) {
                  setFieldErrors((prev) => ({ ...prev, otp: null }));
                }
              }}
              error={fieldErrors.otp}
              placeholder="123456"
              maxLength={6}
              autoComplete="one-time-code"
              required
              disabled={isLoading}
            />

            <PasswordInput
              id="reset-newPassword"
              name="newPassword"
              label="New Password"
              value={formData.newPassword}
              onChange={handleInputChange}
              error={fieldErrors.newPassword}
              placeholder="Create strong password"
              showStrengthBar={true}
              disabled={isLoading}
            />

            <PasswordInput
              id="reset-confirmPassword"
              name="confirmPassword"
              label="Confirm New Password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              error={fieldErrors.confirmPassword}
              placeholder="Re-enter password"
              showStrengthBar={false}
              disabled={isLoading}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              icon={ShieldCheck}
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password'}
            </Button>

            <div className="border-t border-gray-100 pt-4 text-center text-sm text-gray-600">
              <Link
                to="/login"
                className="text-primary-600 hover:text-primary-500 inline-flex items-center font-semibold transition-colors"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
};

export default ResetPassword;
