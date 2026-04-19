import React, { createContext, useState, useContext, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout, isAuthenticated, getStoredUser } from '../shared/services/authService';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [userType, setUserType] = useState('student');   // 'student' | 'instructor' | 'admin'
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userDepartment, setUserDepartment] = useState('');
  const [userStudentNumber, setUserStudentNumber] = useState('');
  const [userDbId, setUserDbId] = useState(null);  // numeric DB id
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        const user = await getStoredUser();
        if (user) {
          setUserType(user.role || 'student');
          setUserRole(user.role || '');
          setUserName(user.name || user.username || '');
          setUserEmail(user.email || '');
          setUserId(user.username || '');
          setUserDbId(user.id || null);
          setUserDepartment(user.department || '');
          setUserStudentNumber(user.student_number || '');
        }
      }
      setIsLoggedIn(authenticated);
    } catch {
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Gerçek login — backend'e bağlanır, token kaydeder, state günceller.
   * @param {string} username
   * @param {string} password
   * @param {string} [expectedRole] - 'student' | 'instructor' | 'admin'
   * @returns {{ success: boolean, error?: string }}
   */
  const login = async (username, password, expectedRole = null) => {
    setAuthError('');
    setIsLoading(true);

    try {
      const result = await apiLogin(username, password);

      if (!result.success) {
        const err = result.message || 'Kullanıcı adı veya şifre hatalı';
        setAuthError(err);
        return { success: false, error: err };
      }

      const user = result.user;

      // Rol kontrolü (opsiyonel)
      if (expectedRole && user.role !== expectedRole) {
        const err = `Bu hesap ${expectedRole} olarak kayıtlı değil`;
        setAuthError(err);
        return { success: false, error: err };
      }

      // State güncelle
      setUserType(user.role);
      setUserRole(user.role);
      setUserName(user.name || user.username);
      setUserEmail(user.email || '');
      setUserId(user.username);
      setUserDbId(user.id || null);
      setUserDepartment(user.department || '');
      setUserStudentNumber(user.student_number || '');
      setIsLoggedIn(true);

      return { success: true, user };
    } catch (err) {
      const message = err?.message || 'Beklenmeyen bir hata oluştu';
      setAuthError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout — backend'i bilgilendirir, token'ları ve state'i temizler.
   */
  const logout = async () => {
    try {
      await apiLogout();
    } catch {
      // Hata olsa bile state'i temizle
    } finally {
      setUserType('student');
      setUserRole('');
      setUserEmail('');
      setUserName('');
      setUserId('');
      setUserDbId(null);
      setUserDepartment('');
      setUserStudentNumber('');
      setIsLoggedIn(false);
      setAuthError('');
    }
  };

  return (
    <UserContext.Provider value={{
      userType,
      userRole,
      userEmail,
      userName,
      userId,
      userDbId,
      userDepartment,
      userStudentNumber,
      isLoggedIn,
      isLoading,
      authError,
      login,
      logout,
      checkAuthStatus
    }}>
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
