import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthHeader from '../../components/auth/AuthHeader';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { authApi } from '../../services/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { validateEmail } from '../../utils/validators';

export const Login = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

    if (!formData.password) {
      errors.password = 'Password is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setApiError(null);

    try {
      const response = await authApi.login({
        email: formData.email,
        password: formData.password,
      });

      const { user, accessToken } = response.data || {};
      if (user && accessToken) {
        setAuth({ user, accessToken });

        if (!user.isEmailVerified) {
          navigate('/verify-email', {
            state: { email: user.email, name: user.name },
            replace: true,
          });
          return;
        }

        navigate('/sessions', { replace: true });
      }
    } catch (err) {
      const msg =
        err.message || 'Login failed. Please verify credentials and try again.';
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Sign in to your account"
          subtitle="Smart Auditorium Booking & Management System"
        />

        {apiError && (
          <div className="mb-6">
            <Alert
              type="error"
              title="Authentication Failed"
              message={apiError}
              onClose={() => setApiError(null)}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <Input
            id="login-email"
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

          <div>
            <div className="relative">
              <Input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                label="Password"
                value={formData.password}
                onChange={handleInputChange}
                error={fieldErrors.password}
                placeholder="Enter your password"
                icon={Lock}
                autoComplete="current-password"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            <div className="mt-2 text-right">
              <Link
                to="/forgot-password"
                className="text-primary-600 hover:text-primary-500 text-xs font-medium transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            icon={LogIn}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>

          <div className="border-t border-gray-100 pt-4 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="text-primary-600 hover:text-primary-500 font-semibold transition-colors"
            >
              Register here
            </Link>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

export default Login;
