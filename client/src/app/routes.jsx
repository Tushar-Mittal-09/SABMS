import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import Loading from '../components/Loading';

// Auth Pages
import Register from '../pages/auth/Register';
import VerifyEmail from '../pages/auth/VerifyEmail';
import VerifyPhone from '../pages/auth/VerifyPhone';
import VerificationStatus from '../pages/auth/VerificationStatus';
import Login from '../pages/auth/Login';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import ChangePassword from '../pages/auth/ChangePassword';
import Sessions from '../pages/auth/Sessions';

/**
 * Route guard requiring authenticated user session in memory.
 */
export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <Loading text="Verifying session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/**
 * Route guard for public-only auth routes (e.g., login, register).
 * Redirects already authenticated users to their active sessions/dashboard.
 */
export const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <Loading text="Loading..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/sessions" replace />;
  }

  return children;
};

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <Register />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPassword />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicOnlyRoute>
            <ResetPassword />
          </PublicOnlyRoute>
        }
      />

      {/* Verification Routes */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/verify-phone" element={<VerifyPhone />} />
      <Route path="/verification-status" element={<VerificationStatus />} />

      {/* Protected Routes */}
      <Route
        path="/sessions"
        element={
          <ProtectedRoute>
            <Sessions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Default Fallback Navigation */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
