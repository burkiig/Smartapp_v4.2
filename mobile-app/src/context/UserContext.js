import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  isAuthenticated,
  getStoredUser,
} from '@/services/authService';

/**
 * @typedef {Object} User
 * @property {number}  id
 * @property {string}  username
 * @property {string}  email
 * @property {string}  name
 * @property {('admin'|'instructor'|'student')} role
 * @property {string} [department]
 * @property {string} [student_number]
 * @property {boolean} is_active
 * @property {string}  created_at
 */

const UserContext = createContext(undefined);

const EMPTY_USER = null;

export function UserProvider({ children }) {
  const [user, setUser] = useState(EMPTY_USER);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const checkAuthStatus = useCallback(async () => {
    try {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        const storedUser = await getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
      } else {
        setUser(EMPTY_USER);
      }
      setIsLoggedIn(authenticated);
    } catch {
      setUser(EMPTY_USER);
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback(async (username, password, expectedRole = null) => {
    setAuthError('');
    setIsLoading(true);

    try {
      const result = await apiLogin(username, password);

      if (!result.success) {
        const err = result.message || 'Kullanıcı adı veya şifre hatalı';
        setAuthError(err);
        return { success: false, error: err };
      }

      const loggedInUser = result.user;

      if (expectedRole && loggedInUser.role !== expectedRole) {
        const err = `Bu hesap ${expectedRole} olarak kayıtlı değil`;
        setAuthError(err);
        return { success: false, error: err };
      }

      setUser(loggedInUser);
      setIsLoggedIn(true);
      return { success: true, user: loggedInUser };
    } catch (err) {
      const message = err?.message || 'Beklenmeyen bir hata oluştu';
      setAuthError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Hata olsa bile state'i temizle
    } finally {
      setUser(EMPTY_USER);
      setIsLoggedIn(false);
      setAuthError('');
    }
  }, []);

  const value = useMemo(() => ({
    user,
    isLoggedIn,
    isLoading,
    authError,
    login,
    logout,
    checkAuthStatus,
  }), [user, isLoggedIn, isLoading, authError, login, logout, checkAuthStatus]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
