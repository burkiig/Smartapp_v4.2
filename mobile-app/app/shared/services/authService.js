/**
 * Mobile Auth Service — Updated for FastAPI backend
 * Supports login with email OR username
 */
import * as SecureStore from 'expo-secure-store';
import { auth } from './api';

async function saveTokens(accessToken, refreshToken) {
  try {
    await SecureStore.setItemAsync('access_token', accessToken);
    if (refreshToken) {
      await SecureStore.setItemAsync('refresh_token', refreshToken);
    }
  } catch (e) {
    console.error('[authService] saveTokens error:', e);
  }
}

async function clearTokens() {
  try {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user');
  } catch {}
}

/**
 * Login — supports email OR username
 * @param {string} loginIdentifier - email or username
 * @param {string} password
 */
export const login = async (loginIdentifier, password) => {
  try {
    const data = await auth.login(loginIdentifier, password);

    if (data.access_token) {
      await saveTokens(data.access_token, data.refresh_token);
      await SecureStore.setItemAsync('user', JSON.stringify(data.user));
      return { success: true, user: data.user };
    }

    return { success: false, message: 'Giriş başarısız' };
  } catch (err) {
    const message = err?.message || 'Sunucuya bağlanılamadı.';
    return { success: false, message };
  }
};

/**
 * Logout
 */
export const logout = async () => {
  try {
    await auth.logout();
  } catch {}
  finally {
    await clearTokens();
  }
};

/**
 * Get stored user from SecureStore
 */
export const getStoredUser = async () => {
  try {
    const userStr = await SecureStore.getItemAsync('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

/**
 * Decode JWT payload without verification (used only for expiry check)
 */
function decodeJwtExpiry(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // base64url → base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(base64 + padding));
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

/**
 * Try to refresh the access token using the stored refresh token
 */
async function tryRefresh() {
  try {
    const refreshToken = await SecureStore.getItemAsync('refresh_token');
    if (!refreshToken) return false;
    const { API_URL } = await import('../config/env');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = await res.json();
    if (data.access_token) {
      await SecureStore.setItemAsync('access_token', data.access_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if user is authenticated.
 * Verifies token exists and is not expired; attempts a silent refresh if expired.
 */
export const isAuthenticated = async () => {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    if (!token) return false;

    const exp = decodeJwtExpiry(token);
    if (exp !== null) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (exp < nowSec) {
        // Token expired — try silent refresh
        return await tryRefresh();
      }
    }

    return true;
  } catch {
    return false;
  }
};
