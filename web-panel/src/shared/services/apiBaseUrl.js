/**
 * API origin for fetch calls.
 * - REACT_APP_API_URL set → always use it (production / custom backend).
 * - localhost / 127.0.0.1 → same hostname as the page + port 8000.
 * - Any other host (production server) → same origin, no port suffix.
 *   Assumes a reverse proxy (nginx/caddy) routes /api/... to the backend.
 */
export function getApiBaseUrl() {
  const fromEnv = process.env.REACT_APP_API_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { hostname, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = process.env.REACT_APP_API_PORT || '8000';
      return `http://${hostname}:${port}`;
    }
    // Production: same origin (proxy handles /api/... → backend)
    return `${protocol}//${hostname}`;
  }
  return 'http://localhost:8000';
}
