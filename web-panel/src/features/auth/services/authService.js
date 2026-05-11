import { getApiBaseUrl } from '../../../shared/services/apiBaseUrl';

/**
 * Login — supports email OR username.
 * Tokens are stored in httpOnly cookies by the server; we never touch localStorage for tokens.
 */
function apiErrorMessage(data) {
  const d = data?.detail;
  if (Array.isArray(d) && d.length) {
    return d.map((x) => x?.msg || x?.detail || JSON.stringify(x)).join('; ');
  }
  if (typeof d === 'string') return d;
  return data?.message || 'Giriş başarısız';
}

export const loginUser = async (login, password) => {
  try {
    const baseUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      credentials: 'include',   // send/receive httpOnly cookies
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: apiErrorMessage(data) };
    }

    // Store only the user profile — NOT the tokens
    localStorage.setItem('user', JSON.stringify(data.user));

    return { success: true, user: data.user };
  } catch (error) {
    const msg = error.name === 'AbortError'
      ? 'Sunucu yanıt vermedi. Backend çalışıyor mu?'
      : 'Bağlantı hatası. Sunucu çalışıyor mu?';
    return { success: false, error: msg };
  }
};

/**
 * Logout — server clears the httpOnly auth cookies.
 */
export const logoutUser = async () => {
  try {
    const baseUrl = getApiBaseUrl();
    await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.removeItem('user');
  }
};

/**
 * Get current user profile. Uses the access_token cookie automatically.
 * 5 second timeout — if backend is unreachable we fail fast instead of hanging.
 */
export const getMe = async () => {
  try {
    const baseUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

export const forgotPassword = async (email) => {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: apiErrorMessage(data) };
    return { success: true, message: data.message };
  } catch {
    return { success: false, error: 'Bağlantı hatası' };
  }
};

export const resetPassword = async (token, new_password) => {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: apiErrorMessage(data) };
    return { success: true, message: data.message };
  } catch {
    return { success: false, error: 'Bağlantı hatası' };
  }
};

export const changePassword = async (current_password, new_password) => {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password, new_password }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: apiErrorMessage(data) };
    return { success: true, message: data.message };
  } catch {
    return { success: false, error: 'Bağlantı hatası' };
  }
};

/**
 * Refresh access token. The refresh_token cookie is sent automatically.
 * Server sets a new access_token cookie and returns a new refresh_token cookie.
 */
export const refreshToken = async () => {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    return response.ok;
  } catch {
    return false;
  }
};
