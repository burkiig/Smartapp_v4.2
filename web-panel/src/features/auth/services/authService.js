const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Login — supports email OR username.
 * Tokens are stored in httpOnly cookies by the server; we never touch localStorage for tokens.
 */
export const loginUser = async (login, password) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      credentials: 'include',   // send/receive httpOnly cookies
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.detail || data.message || 'Giriş başarısız' };
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
    await fetch(`${BASE_URL}/api/v1/auth/logout`, {
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${BASE_URL}/api/v1/auth/me`, {
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

/**
 * Refresh access token. The refresh_token cookie is sent automatically.
 * Server sets a new access_token cookie and returns a new refresh_token cookie.
 */
export const refreshToken = async () => {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    return response.ok;
  } catch {
    return false;
  }
};
