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
} from '../shared/services/authService';

/**
 * @typedef {Object} User
 * @property {number}  id              - Backend DB primary key
 * @property {string}  username        - Login identifier (email veya kullanıcı adı)
 * @property {string}  email           - E-posta adresi
 * @property {string}  name            - Tam ad ("Ad Soyad")
 * @property {('admin'|'instructor'|'student')} role
 * @property {string} [department]     - Bölüm (öğrenci/öğretim üyesi)
 * @property {string} [student_number] - Öğrenci numarası (sadece role=student)
 * @property {boolean} is_active
 * @property {string}  created_at      - ISO 8601 timestamp
 *
 * @typedef {Object} UserContextValue
 * @property {User|null} user                 - Tek doğruluk kaynağı; null = giriş yok
 * @property {boolean}   isLoggedIn
 * @property {boolean}   isLoading
 * @property {string}    authError            - Son login hatası
 * @property {(username: string, password: string, expectedRole?: string) => Promise<{success: boolean, user?: User, error?: string}>} login
 * @property {() => Promise<void>} logout
 * @property {() => Promise<void>} checkAuthStatus
 */

const UserContext = createContext(/** @type {UserContextValue|undefined} */ (undefined));

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

  /** @type {UserContextValue} — Single Source of Truth: sadece user objesi ve auth state */
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
