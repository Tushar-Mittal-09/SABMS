import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes';
import { useAuthStore } from '../store/auth.store';

export function App() {
  const silentRefresh = useAuthStore((state) => state.silentRefresh);

  useEffect(() => {
    // Attempt silent session recovery on initial application mount
    silentRefresh();
  }, [silentRefresh]);

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
