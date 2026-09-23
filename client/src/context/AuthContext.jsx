import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/endpoints.js';
import { setGenderTheme } from '../theme.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('rafiqa_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('rafiqa_token')));

  const persist = (data) => {
    localStorage.setItem('rafiqa_token', data.token);
    localStorage.setItem('rafiqa_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = useCallback(() => {
    localStorage.removeItem('rafiqa_token');
    localStorage.removeItem('rafiqa_user');
    setUser(null);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      localStorage.removeItem('rafiqa_token');
      localStorage.removeItem('rafiqa_user');
      setUser(null);
    };
    window.addEventListener('rafiqa:unauthorized', onUnauthorized);
    return () => window.removeEventListener('rafiqa:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('rafiqa_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(({ user: fresh }) => {
        setUser(fresh);
        localStorage.setItem('rafiqa_user', JSON.stringify(fresh));
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  useEffect(() => {
    if (!user || user.role !== 'mother') setGenderTheme(null);
  }, [user]);

  const login = async (payload) => {
    const data = await authApi.login(payload);
    persist(data);
    return data.user;
  };

  const register = async (payload) => {
    const data = await authApi.register(payload);
    persist(data);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const roleHome = (role) => {
  if (role === 'doctor') return '/doctor';
  if (role === 'health_unit') return '/unit';
  return '/mother';
};
