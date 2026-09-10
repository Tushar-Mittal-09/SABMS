import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes';
import { useAuthStore } from '../store/auth.store';
import { fetchCsrfToken } from '../utils/api';

export function App() {
  const silentRefresh = useAuthStore((state) => state.silentRefresh);

  useEffect(() => {
    // Eagerly initialize CSRF protection and attempt silent session recovery
    const initAuth = async () => {
      await fetchCsrfToken();
      await silentRefresh();
    };
    initAuth();
  }, [silentRefresh]);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
