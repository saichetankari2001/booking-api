import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { login as apiLogin, refresh as apiRefresh, logout as apiLogout } from '../api/auth';
import { setAuthHandlers, clearAuthHandlers } from '../api/apiClient';

export const REFRESH_TOKEN_KEY = 'booking_admin_refresh_token';

type AuthStatus = 'pending' | 'authenticated' | 'unauthenticated';

interface AdminAuthContextValue {
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('pending');
  const accessTokenRef = useRef<string | null>(null);

  const doRefresh = useCallback(async (): Promise<string | null> => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) return null;
    try {
      const { accessToken } = await apiRefresh(storedRefreshToken);
      accessTokenRef.current = accessToken;
      return accessToken;
    } catch {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      accessTokenRef.current = null;
      return null;
    }
  }, []);

  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    accessTokenRef.current = null;
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    setAuthHandlers({
      getAccessToken: () => accessTokenRef.current,
      refreshAccessToken: doRefresh,
      onAuthFailure: handleAuthFailure,
    });
    return () => clearAuthHandlers();
  }, [doRefresh, handleAuthFailure]);

  useEffect(() => {
    let cancelled = false;
    doRefresh().then((token) => {
      if (!cancelled) setStatus(token ? 'authenticated' : 'unauthenticated');
    });
    return () => {
      cancelled = true;
    };
    // Runs once on mount only — doRefresh is stable (empty dep array via useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const { accessToken, refreshToken } = await apiLogin(email, password);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    accessTokenRef.current = accessToken;
    setStatus('authenticated');
  }

  function logout(): void {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (storedRefreshToken) {
      apiLogout(storedRefreshToken).catch(() => {});
    }
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    accessTokenRef.current = null;
    setStatus('unauthenticated');
  }

  return (
    <AdminAuthContext.Provider value={{ status, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- useAdminAuth hook is intentionally colocated with its provider.
export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return ctx;
}
