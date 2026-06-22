import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, logoutUser, getMe } from '../services/authService';
import { useAppStore } from '../../../shared/state/useAppStore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const setSessionStore = useAppStore((s) => s.setSession);
  const clearSessionStore = useAppStore((s) => s.clearSession);

  const syncStore = useCallback((nextUser) => {
    if (nextUser) {
      setSessionStore(nextUser);
    } else {
      clearSessionStore();
    }
  }, [setSessionStore, clearSessionStore]);

  useEffect(() => {
    const init = async () => {
      const profile = await getMe();
      if (profile) {
        setUser(profile);
        // Persist to whichever storage was already used (rememberMe-aware restore)
        if (localStorage.getItem('user')) {
          localStorage.setItem('user', JSON.stringify(profile));
        } else {
          sessionStorage.setItem('user', JSON.stringify(profile));
        }
        syncStore(profile);
      } else {
        setUser(null);
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        syncStore(null);
      }
      setIsLoading(false);
    };
    init();
  }, [syncStore]);

  // Oturum sona erdiğinde (cookie expire) kullanıcı aktif olmasa bile UI temizlenir.
  // Her 5 dakikada bir /auth/me çağrısı yapılır; başarısız olursa logout.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const profile = await getMe();
      if (!profile) {
        setUser(null);
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        syncStore(null);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, syncStore]);

  const login = async (loginIdentifier, password, rememberMe = false) => {
    setError('');
    setIsLoading(true);

    try {
      const result = await loginUser(loginIdentifier, password);

      if (result.success) {
        setUser(result.user);
        syncStore(result.user);
        // rememberMe=true → localStorage (tarayıcı kapanırsa bile kalır)
        // rememberMe=false → sadece session için sessionStorage kullan
        if (rememberMe) {
          localStorage.setItem('user', JSON.stringify(result.user));
          sessionStorage.removeItem('user');
        } else {
          sessionStorage.setItem('user', JSON.stringify(result.user));
          localStorage.removeItem('user');
        }
        return { success: true };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch {
      const errorMessage = 'Beklenmeyen bir hata oluştu';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await logoutUser();  // server clears httpOnly cookies
    setUser(null);
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    syncStore(null);
  };

  const value = {
    user,
    isLoading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
