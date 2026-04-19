import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config/env';

const BASE_URL = `${API_URL}/api/v1`;
const TIMEOUT_MS = 30000;         // 30s — base64 fotoğraf upload için yeterli
const UPLOAD_TIMEOUT_MS = 60000;  // 60s — yüz kaydı / yüz doğrulama için

async function getStoredToken() {
  try {
    return await SecureStore.getItemAsync('access_token');
  } catch {
    return null;
  }
}

async function getRefreshToken() {
  try {
    return await SecureStore.getItemAsync('refresh_token');
  } catch {
    return null;
  }
}

async function tryRefreshToken() {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;

    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    if (!response.ok) return false;
    const data = await response.json();
    if (data.access_token) {
      await SecureStore.setItemAsync('access_token', data.access_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Yüz işlemleri için uzun timeout gerektiren path'ler
const UPLOAD_PATHS = ['/face/', '/attendance/verify-face'];

async function request(method, path, body = null, customToken = null) {
  const token = customToken || (await getStoredToken());
  const url = `${BASE_URL}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Upload timeout sadece POST/PATCH/PUT ile resim gönderilen path'lerde
  const isUpload = method !== 'GET' && UPLOAD_PATHS.some(p => path.includes(p));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), isUpload ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
      ...(body !== null ? { body: JSON.stringify(body) } : {}),
    });
    clearTimeout(timer);

    if (response.status === 401 && !customToken) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        const newToken = await getStoredToken();
        const retryResponse = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newToken}` },
          ...(body !== null ? { body: JSON.stringify(body) } : {}),
        });
        if (!retryResponse.ok) {
          const err = await retryResponse.json().catch(() => ({}));
          throw new Error(err.detail || err.message || `HTTP ${retryResponse.status}`);
        }
        return await retryResponse.json();
      }
      const loginError = new Error('Oturum süresi doldu');
      loginError.requiresLogin = true;
      throw loginError;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || data.message || `HTTP ${response.status}`);
    }
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('İstek zaman aşımına uğradı');
    }
    throw err;
  }
}

const apiAdapter = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  postWithToken: (path, body, token) => request('POST', path, body, token),
};

export default apiAdapter;
