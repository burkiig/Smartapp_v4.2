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
    const response = await fetch(url, {
      method,
      credentials: 'include',   // browser sends httpOnly auth cookie automatically
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
      const err = new Error(data.detail || data.message || `HTTP ${response.status}`);
      err.status = response.status;
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
