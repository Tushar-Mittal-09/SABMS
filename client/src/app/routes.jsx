import { Routes, Route, Navigate } from 'react-router-dom';
import Register from '../pages/auth/Register';
import VerifyEmail from '../pages/auth/VerifyEmail';
import VerifyPhone from '../pages/auth/VerifyPhone';
import VerificationStatus from '../pages/auth/VerificationStatus';

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/verify-phone" element={<VerifyPhone />} />
      <Route path="/verification-status" element={<VerificationStatus />} />
      {/* Default redirect to registration */}
      <Route path="/" element={<Navigate to="/register" replace />} />
      <Route path="*" element={<Navigate to="/register" replace />} />
    </Routes>
  );
};

export default AppRoutes;
