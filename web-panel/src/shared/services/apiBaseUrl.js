/**
 * API origin for fetch calls.
 * - If REACT_APP_API_URL is set → always use it (production / custom backend).
 * - Else on localhost or 127.0.0.1 → same hostname as the page + port 8000
 *   so "localhost" vs "127.0.0.1" never splits cookies / session against the wrong host.
 */
export function getApiBaseUrl() {
  const fromEnv = process.env.REACT_APP_API_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/$/, '');
  }
  if (
    typeof window !== 'undefined'
    && window.location?.hostname
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    const port = process.env.REACT_APP_API_PORT || '8000';
    return `http://${window.location.hostname}:${port}`;
  }
  return 'http://localhost:8000';
}
