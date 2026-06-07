/** Same key as web panel — shared preference name if both clients sync storage later. */
export const LANGUAGE_STORAGE_KEY = 'i18nextLng';

export const SUPPORTED_LANGUAGES = ['tr', 'en'];

/**
 * @param {string | undefined | null} code
 * @returns {'tr' | 'en'}
 */
export function normalizeLanguage(code) {
  if (!code) return 'tr';
  const base = String(code).toLowerCase().split('-')[0];
  return base === 'en' ? 'en' : 'tr';
}
