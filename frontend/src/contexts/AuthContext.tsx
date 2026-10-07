import iziToast from 'izitoast';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { loginApi, logoutApi } from '../features/login/services/Auth';
import { AuthContextType, LoginResponse, UserDTO } from '../interfaces/AuthInterfaces';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let tokenRef: { current: string | null } = { current: null };
export const getToken = () => tokenRef.current;

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<UserDTO | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const loginResponse: LoginResponse = await loginApi(email, password);
      setToken(loginResponse.token);
      setUser(loginResponse.user);
      tokenRef.current = loginResponse.token;
    } catch (error: any) {
      const msg = error?.message || error || 'Falha no login';
      setError(msg);
      iziToast.error({
        title: 'Erro',
        message: msg,
        position: 'bottomRight',
      });
      setToken(null);
      setUser(null);
      tokenRef.current = null;
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) await logoutApi(token);
    } finally {
      setToken(null);
      setUser(null);
      tokenRef.current = null;
      setError(null);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).runtime) {
      const off = EventsOn('auth:changed', (isLogged: boolean) => {
        if (!isLogged) {
          setUser(null);
          setToken(null);
          tokenRef.current = null;
        }
      });
      return () => {
        if (typeof off === 'function') off();
      };
    }
  }, []);

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
