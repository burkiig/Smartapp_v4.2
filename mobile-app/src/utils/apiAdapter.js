import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/config/env';
import eventBus from '@/utils/eventBus';

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
      if (data.refresh_token) {
        await SecureStore.setItemAsync('refresh_token', data.refresh_token);
      }
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
        const retryController = new AbortController();
        const retryTimer = setTimeout(() => retryController.abort(), isUpload ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
        try {
          const retryResponse = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newToken}` },
            signal: retryController.signal,
            ...(body !== null ? { body: JSON.stringify(body) } : {}),
          });
          clearTimeout(retryTimer);
          if (!retryResponse.ok) {
            const err = await retryResponse.json().catch(() => ({}));
            throw new Error(err.detail || err.message || `HTTP ${retryResponse.status}`);
          }
          return await retryResponse.json();
        } catch (retryErr) {
          clearTimeout(retryTimer);
          if (retryErr.name === 'AbortError') throw new Error('İstek zaman aşımına uğradı');
          throw retryErr;
        }
      }
      // Token yenilenemedi → tüm uygulama katmanını bilgilendir
      await SecureStore.deleteItemAsync('access_token').catch(() => {});
      await SecureStore.deleteItemAsync('refresh_token').catch(() => {});
      eventBus.emit('FORCE_LOGOUT');
      const loginError = new Error('Oturum süresi doldu');
      loginError.requiresLogin = true;
      throw loginError;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // FastAPI validation errors: detail is an array of {loc, msg, type}
      let detail = data.detail || data.message;
      if (Array.isArray(detail)) {
        detail = detail.map(e => e.msg || JSON.stringify(e)).join(', ');
      }
      throw new Error(detail || `HTTP ${response.status}`);
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

/**
 * normalizeResponse — Backend'den gelen heterojen response/error formatlarını
 * mobil tarafın anlayacağı standart envelope'a dönüştürür.
 *
 * @typedef {Object} NormalizedResponse
 * @property {boolean} success
 * @property {*}       data
 * @property {string|null} message
 * @property {boolean} requiresLogin
 */
async function normalizeResponse(promiseFn) {
  try {
    const data = await promiseFn();
    return { success: true, data, message: null, requiresLogin: false };
  } catch (err) {
    return {
      success: false,
      data: null,
      message: err?.message || 'Bilinmeyen hata',
      requiresLogin: err?.requiresLogin === true,
    };
  }
}

async function uploadFile(path, fileUri, fileName, mimeType) {
  const token = await getStoredToken();
  const url = `${BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  const formData = new FormData();
  formData.append('file', { uri: fileUri, name: fileName, type: mimeType });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.message || `HTTP ${response.status}`);
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('İstek zaman aşımına uğradı');
    throw err;
  }
}

const apiAdapter = {
  // ── Raw API ──────────────────────────────────────────────────────────────
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  postWithToken: (path, body, token) => request('POST', path, body, token),
  uploadFile: (path, fileUri, fileName, mimeType) => uploadFile(path, fileUri, fileName, mimeType),

  // ── Normalized API ───────────────────────────────────────────────────────
  getNormalized:    (path)        => normalizeResponse(() => request('GET',    path)),
  postNormalized:   (path, body)  => normalizeResponse(() => request('POST',   path, body)),
  putNormalized:    (path, body)  => normalizeResponse(() => request('PUT',    path, body)),
  patchNormalized:  (path, body)  => normalizeResponse(() => request('PATCH',  path, body)),
  deleteNormalized: (path)        => normalizeResponse(() => request('DELETE', path)),
};

export { normalizeResponse };
export default apiAdapter;
