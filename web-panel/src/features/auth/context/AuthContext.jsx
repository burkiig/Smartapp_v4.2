import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, logoutUser } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('access_token');

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }

    if (savedToken) {
      setAccessToken(savedToken);
    }

    setIsLoading(false);
  }, []);

  const login = async (username, password, role) => {
    setError('');
    setIsLoading(true);

    try {
      const result = await loginUser(username, password, role);

      if (result.success) {
        setUser(result.user);
        setAccessToken(result.access_token);
        localStorage.setItem('user', JSON.stringify(result.user));
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
    await logoutUser();
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  };

  /**
   * Returns Authorization header object for authenticated API calls.
   * Usage: fetch(url, { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } })
   */
  const getAuthHeader = () => {
    const token = accessToken || localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const value = {
    user,
    accessToken,
    isLoading,
    error,
    login,
    logout,
    getAuthHeader,
    isAuthenticated: !!user
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
