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
import i18n from '@/i18n';

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
  // In-memory only — intentionally NOT persisted to SecureStore.
  // Cleared on every cold start, forcing face re-verification each new session.
  const [isFaceVerified, setIsFaceVerified] = useState(false);

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

  // Do not toggle global `isLoading` here — that unmounts the entire Stack in AppShell
  // and wipes LoginScreen state (modal, etc.). Bootstrap-only loading stays in checkAuthStatus.
  const login = useCallback(async (username, password, expectedRole = null) => {
    setAuthError('');

    try {
      const result = await apiLogin(username, password);

      if (!result.success) {
        const err = result.message || i18n.t('auth.loginFailed');
        setAuthError(err);
        return { success: false, error: err };
      }

      const loggedInUser = result.user;

      if (expectedRole && loggedInUser.role !== expectedRole) {
        const err = i18n.t('auth.wrongRole', { role: expectedRole });
        setAuthError(err);
        return { success: false, error: err };
      }

      setUser(loggedInUser);
      setIsLoggedIn(true);
      return { success: true, user: loggedInUser };
    } catch (err) {
      const message = err?.message || i18n.t('common.unexpectedError');
      setAuthError(message);
      return { success: false, error: message };
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
      setIsFaceVerified(false);
      setAuthError('');
    }
  }, []);

  const value = useMemo(() => ({
    user,
    isLoggedIn,
    isLoading,
    authError,
    isFaceVerified,
    setFaceVerified: setIsFaceVerified,
    login,
    logout,
    checkAuthStatus,
  }), [user, isLoggedIn, isLoading, authError, isFaceVerified, login, logout, checkAuthStatus]);

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
