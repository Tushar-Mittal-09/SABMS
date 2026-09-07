import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthHeader from '../../components/auth/AuthHeader';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { authApi } from '../../services/auth.api';
import { validateEmail } from '../../utils/validators';

export const ForgotPassword = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (fieldError) setFieldError(null);
    if (apiError) setApiError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) {
      setFieldError(err);
      return;
    }

    setIsLoading(true);
    setApiError(null);

    try {
      await authApi.forgotPassword({ email });
      setIsSuccess(true);
    } catch (err) {
      setApiError(
        err.message ||
          'Unable to process password reset request. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Forgot Password"
          subtitle="Enter your verified email to receive a recovery code"
        />

        {apiError && (
          <div className="mb-6">
            <Alert
              type="error"
              title="Request Failed"
              message={apiError}
              onClose={() => setApiError(null)}
            />
          </div>
        )}

        {isSuccess ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <KeyRound className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Recovery Code Sent
              </h3>
              <p className="text-sm text-gray-600">
                If an active account is associated with{' '}
                <span className="font-medium text-gray-800">{email}</span>, a
                6-digit recovery code has been dispatched.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate('/reset-password', { state: { email } })}
            >
              Enter Recovery Code
            </Button>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <Input
              id="forgot-email"
              name="email"
              type="email"
              label="Institutional Email"
              value={email}
              onChange={handleEmailChange}
              error={fieldError}
              placeholder="student@university.edu"
              icon={<Mail className="h-5 w-5 text-gray-400" />}
              autoComplete="email"
              required
              disabled={isLoading}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              icon={<KeyRound className="h-5 w-5" />}
            >
              {isLoading ? 'Sending Code...' : 'Send Recovery Code'}
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

export default ForgotPassword;
