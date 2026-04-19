import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, logoutUser, getMe } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      // Verify session by hitting /auth/me — the httpOnly access_token cookie
      // is sent automatically. No localStorage token to read.
      const profile = await getMe();
      if (profile) {
        setUser(profile);
        localStorage.setItem('user', JSON.stringify(profile));
      } else {
        localStorage.removeItem('user');
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const login = async (loginIdentifier, password) => {
    setError('');
    setIsLoading(true);

    try {
      const result = await loginUser(loginIdentifier, password);

      if (result.success) {
        setUser(result.user);
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
