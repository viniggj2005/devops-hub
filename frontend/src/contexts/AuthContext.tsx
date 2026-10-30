import toast from 'react-hot-toast';
import { Events } from '@wailsio/runtime';
import { isDetachedWindow } from '../features/appFrame/WindowContext';
import { AuthContextType, LoginResponse, UserDTO } from '../interfaces/AuthInterfaces';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { claimWindowSessionApi, loginApi, logoutApi, myInfo } from '../features/login/services/Auth';

const sessionKeepAliveIntervalMs = 15 * 60 * 1000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let tokenRef: { current: string | null } = { current: null };
export const getToken = () => tokenRef.current;

let windowSessionClaim: Promise<LoginResponse | null> | null = null;
const claimWindowSessionOnce = () => (windowSessionClaim ??= claimWindowSessionApi());

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [loading, setLoading] = useState(isDetachedWindow);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applySession = (session: LoginResponse) => {
    setToken(session.token);
    setUser(session.user);
    tokenRef.current = session.token;
  };

  const clearSession = () => {
    setUser(null);
    setToken(null);
    tokenRef.current = null;
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const loginResponse = await loginApi(email, password);
      if (!loginResponse) throw new Error('Falha no login');
      applySession(loginResponse);
    } catch (loginError: any) {
      const message = loginError?.message || loginError || 'Falha no login';
      setError(message);
      toast.error(message);
      clearSession();
      throw loginError;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) await logoutApi(token);
    } finally {
      clearSession();
      setError(null);
    }
  };

  useEffect(() => {
    if (!isDetachedWindow) return;
    claimWindowSessionOnce()
      .then(session => {
        if (session) applySession(session);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => Events.On('auth:changed', ({ data: isLogged }) => {
    if (!isLogged) clearSession();
  }), []);

  useEffect(() => {
    if (!token) return;
    const pingSession = () => {
      myInfo(token).catch((pingError) => {
        const message = String(pingError?.message ?? pingError ?? '').toLowerCase();
        if (message.includes('token inválido') || message.includes('sessão expirada')) {
          clearSession();
        }
      });
    };
    const intervalId = window.setInterval(pingSession, sessionKeepAliveIntervalMs);
    window.addEventListener('focus', pingSession);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', pingSession);
    };
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      error,
      login,
      token,
      logout,
      loading,
      isAuthenticated: Boolean(token),
    }),
    [token, user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
