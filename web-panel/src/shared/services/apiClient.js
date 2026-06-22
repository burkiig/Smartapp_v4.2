/**
 * Web Panel — Shared API Client
 *
 * Tokens are stored in httpOnly cookies set by the server.
 * We never read or write tokens from JavaScript — credentials: 'include'
 * causes the browser to attach the cookie automatically on every request.
 *
 * API prefix: /api/v1
 */

import { getApiBaseUrl } from './apiBaseUrl';
import i18n from '../../i18n';

const TIMEOUT_MS = 10000;

async function request(method, path, { body, params } = {}) {
  const baseUrl = getApiBaseUrl();
  let url = `${baseUrl}/api/v1${path}`;

  if (params && Object.keys(params).length) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const currentLang = i18n.resolvedLanguage || i18n.language || 'tr';
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept-Language': currentLang,
    };

    const response = await fetch(url, {
      method,
      credentials: 'include',   // browser sends httpOnly auth cookie automatically
      signal: controller.signal,
      headers: requestHeaders,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    clearTimeout(timer);

    // Handle 401 — try silent token refresh via cookie rotation
    if (response.status === 401) {
      const refreshed = await _tryRefreshToken(baseUrl);
      if (refreshed) {
        const retryResponse = await fetch(url, {
          method,
          credentials: 'include',
          headers: requestHeaders,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        if (!retryResponse.ok) {
          const errData = await retryResponse.json().catch(() => ({}));
          throw new Error(errData.detail || errData.message || `HTTP ${retryResponse.status}`);
        }
        return await retryResponse.json();
      }
      // Refresh failed — clear user profile from both storages and reload to login screen
      localStorage.removeItem('user');
      sessionStorage.removeItem('user');
      window.location.reload();
      throw new Error('Oturum süresi doldu, lütfen tekrar giriş yapın');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      let detail = data.detail || data.message || `HTTP ${response.status}`;
      // FastAPI validation errors: detail is [{loc, msg, type}, ...]
      if (Array.isArray(detail)) {
        detail = detail.map(e => e.msg || JSON.stringify(e)).join(', ');
      }
      let errorMessage = typeof detail === 'string' ? detail : JSON.stringify(detail);
      if (detail && typeof detail === 'object') {
        if (typeof detail.message === 'string' && detail.message.trim()) {
          errorMessage = detail.message;
        } else if (typeof data.message === 'string' && data.message.trim()) {
          errorMessage = data.message;
        }
      }
      const err = new Error(errorMessage);
      err.status = response.status;
      if (detail && typeof detail === 'object') {
        err.code = detail.code;
        err.details = detail;
      }
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function _tryRefreshToken(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

const apiClient = {
  get:    (path, options) => request('GET',    path, options),
  post:   (path, body)    => request('POST',   path, { body }),
  patch:  (path, body)    => request('PATCH',  path, { body }),
  put:    (path, body)    => request('PUT',    path, { body }),
  delete: (path)          => request('DELETE', path),
};

export default apiClient;
