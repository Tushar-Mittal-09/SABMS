import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthCard from '../../components/auth/AuthCard';
import AuthHeader from '../../components/auth/AuthHeader';
import PasswordInput from '../../components/auth/PasswordInput';
import Button from '../../components/Button';
import Alert from '../../components/Alert';
import { authApi } from '../../services/auth.api';
import {
  validatePassword,
  validateConfirmPassword,
} from '../../utils/validators';

export const ChangePassword = () => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (apiError) setApiError(null);
    if (successMessage) setSuccessMessage(null);
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    const pwdErr = validatePassword(formData.newPassword);
    if (pwdErr) errors.newPassword = pwdErr;

    const confirmErr = validateConfirmPassword(
      formData.newPassword,
      formData.confirmPassword
    );
    if (confirmErr) errors.confirmPassword = confirmErr;

    if (
      formData.currentPassword &&
      formData.newPassword &&
      formData.currentPassword === formData.newPassword
    ) {
      errors.newPassword =
        'New password must be different from current password';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setApiError(null);
    setSuccessMessage(null);

    try {
      const res = await authApi.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      setSuccessMessage(
        res.message || 'Password updated successfully across all sessions.'
      );
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setApiError(
        err.message ||
          'Failed to change password. Please verify current password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title="Change Account Password"
          subtitle="Update your security credentials"
        />

        {apiError && (
          <div className="mb-6">
            <Alert
              type="error"
              title="Update Failed"
              message={apiError}
              onClose={() => setApiError(null)}
            />
          </div>
        )}

        {successMessage && (
          <div className="mb-6">
            <Alert
              type="success"
              title="Success"
              message={successMessage}
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              onClose={() => setSuccessMessage(null)}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <PasswordInput
            id="change-currentPassword"
            name="currentPassword"
            label="Current Password"
            value={formData.currentPassword}
            onChange={handleInputChange}
            error={fieldErrors.currentPassword}
            placeholder="Enter current password"
            showStrengthBar={false}
            disabled={isLoading}
          />

          <PasswordInput
            id="change-newPassword"
            name="newPassword"
            label="New Password"
            value={formData.newPassword}
            onChange={handleInputChange}
            error={fieldErrors.newPassword}
            placeholder="Create strong new password"
            showStrengthBar={true}
            disabled={isLoading}
          />

          <PasswordInput
            id="change-confirmPassword"
            name="confirmPassword"
            label="Confirm New Password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            error={fieldErrors.confirmPassword}
            placeholder="Re-enter new password"
            showStrengthBar={false}
            disabled={isLoading}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            icon={<ShieldCheck className="h-5 w-5" />}
          >
            {isLoading ? 'Updating Password...' : 'Update Password'}
          </Button>

          <div className="flex justify-between border-t border-gray-100 pt-4 text-center text-sm text-gray-600">
            <Link
              to="/sessions"
              className="text-primary-600 hover:text-primary-500 inline-flex items-center font-semibold transition-colors"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Manage Sessions
            </Link>
            <Link
              to="/sessions"
              className="text-xs text-gray-500 transition-colors hover:text-gray-700"
            >
              Dashboard
            </Link>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

export default ChangePassword;
