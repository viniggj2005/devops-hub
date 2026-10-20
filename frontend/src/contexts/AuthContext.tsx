import iziToast from 'izitoast';
import { Events } from '@wailsio/runtime';
import { isDetachedWindow } from '../features/appFrame/WindowContext';
import { AuthContextType, LoginResponse, UserDTO } from '../interfaces/AuthInterfaces';
import { claimWindowSessionApi, loginApi, logoutApi } from '../features/login/services/Auth';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
    } catch (error: any) {
      const msg = error?.message || error || 'Falha no login';
      setError(msg);
      iziToast.error({
        title: 'Erro',
        message: msg,
        position: 'bottomRight',
      });
      clearSession();
      throw error;
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
