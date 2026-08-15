import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  Building2,
  UserPlus,
  GraduationCap,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthHeader from '../../components/auth/AuthHeader';
import AuthProgress from '../../components/auth/AuthProgress';
import PasswordInput from '../../components/auth/PasswordInput';
import SuccessState from '../../components/auth/SuccessState';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { authApi } from '../../services/auth.api';
import {
  validateName,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  maskEmail,
} from '../../utils/validators';

const COMMON_DEPARTMENTS = [
  'Computer Science & Engineering',
  'Information Technology',
  'Electronics & Communication',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical Engineering',
  'Management & Business Studies',
  'School of Architecture',
  'Biotechnology',
  'Applied Sciences & Humanities',
];

export const Register = () => {
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    password: '',
    confirmPassword: '',
    agreedToTerms: false,
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(null);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextVal = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: nextVal,
    }));

    // Clear field-level error on edit
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (apiError) setApiError(null);
  };

  const validateForm = () => {
    const errors = {};

    const nameErr = validateName(formData.name);
    if (nameErr) errors.name = nameErr;

    const emailErr = validateEmail(formData.email);
    if (emailErr) errors.email = emailErr;

    const phoneErr = validatePhone(formData.phone, false);
    if (phoneErr) errors.phone = phoneErr;

    const pwdErr = validatePassword(formData.password);
    if (pwdErr) errors.password = pwdErr;

    const confirmErr = validateConfirmPassword(
      formData.password,
      formData.confirmPassword
    );
    if (confirmErr) errors.confirmPassword = confirmErr;

    if (!formData.agreedToTerms) {
      errors.agreedToTerms =
        'You must agree to the Terms of Service to continue';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await authApi.registerUser({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        department: formData.department,
        password: formData.password,
      });

      const user = response?.data;
      setRegistrationSuccess(user);

      // Store non-sensitive onboarding context in sessionStorage for smooth multi-step navigation
      if (typeof window !== 'undefined' && user) {
        sessionStorage.setItem(
          'sabms_onboarding_user',
          JSON.stringify({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            department: user.department,
            role: user.role,
            status: user.status,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
          })
        );
      }
    } catch (err) {
      setApiError(
        err.message || 'Registration failed. Please check your details.'
      );
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...err.fieldErrors }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToEmail = () => {
    navigate('/verify-email', {
      state: {
        email: registrationSuccess?.email || formData.email,
        user: registrationSuccess,
      },
    });
  };

  return (
    <AuthLayout>
      <AuthCard>
        {registrationSuccess ? (
          <SuccessState
            title="Account Created Successfully"
            subtitle="Your SABMS university profile has been created. Please verify your official email address to proceed."
            maskedIdentifier={maskEmail(registrationSuccess.email)}
            primaryActionLabel="Continue to Email Verification"
            onPrimaryAction={handleProceedToEmail}
          >
            <AuthProgress currentStepIndex={1} className="my-2" />
          </SuccessState>
        ) : (
          <>
            <AuthHeader
              icon={GraduationCap}
              title="Create Your Account"
              subtitle="Fill in the details below to get started with SABMS"
            />

            <AuthProgress currentStepIndex={0} className="mb-6" />

            {apiError && (
              <Alert
                type="error"
                message={apiError}
                onDismiss={() => setApiError(null)}
                className="mb-5"
              />
            )}

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              noValidate
            >
              {/* Full Name & University Email - 2 Column on Desktop */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Full Name"
                  id="name"
                  name="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleInputChange}
                  error={fieldErrors.name}
                  icon={User}
                  required
                />

                <Input
                  label="University Email"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@university.edu"
                  value={formData.email}
                  onChange={handleInputChange}
                  error={fieldErrors.email}
                  icon={Mail}
                  required
                />
              </div>

              {/* Phone Number & Department - 2 Column on Desktop */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Phone Number"
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+91 9876543210"
                  value={formData.phone}
                  onChange={handleInputChange}
                  error={fieldErrors.phone}
                  helperText="Optional, E.164 format with country code"
                  icon={Phone}
                />

                <div className="flex w-full flex-col gap-1.5">
                  <label
                    htmlFor="department"
                    className="text-xs font-semibold uppercase tracking-wider text-brand-text/80 dark:text-dark-text/80"
                  >
                    Department
                  </label>
                  <div className="relative flex items-center">
                    <div className="pointer-events-none absolute left-3.5 flex items-center text-brand-muted dark:text-dark-muted">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <input
                      id="department"
                      name="department"
                      list="departments-list"
                      placeholder="Select or enter department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full rounded-lg border border-brand-border bg-white py-2.5 pl-10 pr-3.5 text-sm text-brand-text placeholder:text-brand-muted/60 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text dark:placeholder:text-dark-muted/60 dark:focus:border-dark-blue dark:focus:ring-dark-blue/20"
                    />
                    <datalist id="departments-list">
                      {COMMON_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Password with Strength Indicator */}
              <PasswordInput
                label="Password"
                id="password"
                name="password"
                placeholder="Create a strong password"
                value={formData.password}
                onChange={handleInputChange}
                error={fieldErrors.password}
                required
              />

              {/* Confirm Password */}
              <div className="flex w-full flex-col gap-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-brand-text/80 dark:text-dark-text/80"
                >
                  <span>
                    Confirm Password <span className="text-red-500">*</span>
                  </span>
                </label>

                <div className="relative flex items-center">
                  <div className="pointer-events-none absolute left-3.5 flex items-center text-brand-muted dark:text-dark-muted">
                    <Lock className="h-4 w-4" />
                  </div>

                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Re-enter your password"
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    className={`w-full rounded-lg border bg-white py-2.5 pl-10 pr-11 text-sm text-brand-text transition-colors duration-150 placeholder:text-brand-muted/60 focus:outline-none focus:ring-2 dark:bg-dark-surface dark:text-dark-text dark:placeholder:text-dark-muted/60 ${
                      fieldErrors.confirmPassword
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-brand-border focus:border-brand-blue focus:ring-brand-blue/20 dark:border-dark-border dark:focus:border-dark-blue dark:focus:ring-dark-blue/20'
                    }`}
                  />

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 rounded p-1 text-brand-muted transition-colors hover:text-brand-text dark:text-dark-muted dark:hover:text-dark-text"
                    aria-label={
                      showConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {fieldErrors.confirmPassword && (
                  <p
                    className="mt-0.5 animate-fade-in text-xs font-medium text-red-600 dark:text-red-400"
                    role="alert"
                  >
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Terms Checkbox */}
              <div className="mt-1 flex flex-col gap-1">
                <label className="flex cursor-pointer select-none items-start gap-2.5">
                  <input
                    type="checkbox"
                    name="agreedToTerms"
                    checked={formData.agreedToTerms}
                    onChange={handleInputChange}
                    className="mt-0.5 h-4 w-4 rounded border-brand-border text-brand-blue focus:ring-brand-blue dark:border-dark-border dark:bg-dark-surface"
                  />
                  <span className="text-xs leading-snug text-brand-muted dark:text-dark-muted">
                    I agree to the{' '}
                    <span className="font-semibold text-brand-navy hover:underline dark:text-dark-blue">
                      Terms of Service
                    </span>{' '}
                    and{' '}
                    <span className="font-semibold text-brand-navy hover:underline dark:text-dark-blue">
                      Privacy Policy
                    </span>
                  </span>
                </label>
                {fieldErrors.agreedToTerms && (
                  <p className="ml-6 animate-fade-in text-xs text-red-600 dark:text-red-400">
                    {fieldErrors.agreedToTerms}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                loadingText="Creating your account..."
                icon={UserPlus}
                className="mt-2 w-full font-semibold"
              >
                Create Account
              </Button>

              {/* Login Note */}
              <p className="mt-2 text-center text-xs text-brand-muted dark:text-dark-muted">
                Already have an account?{' '}
                <span className="cursor-not-allowed font-semibold text-brand-navy opacity-80 dark:text-dark-blue">
                  Login (coming soon)
                </span>
              </p>
            </form>
          </>
        )}
      </AuthCard>
    </AuthLayout>
  );
};

export default Register;
