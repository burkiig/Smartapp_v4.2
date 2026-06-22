import i18n from '../../i18n';

const DEFAULT_LOCALE = 'tr-TR';

export function getLocaleFromLanguage(language) {
  const normalized = (language || i18n?.resolvedLanguage || i18n?.language || 'tr').toLowerCase();
  if (normalized.startsWith('en')) return 'en-US';
  return DEFAULT_LOCALE;
}

export function formatLocaleDate(value, language, options) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(getLocaleFromLanguage(language), options);
}

export function formatLocaleDateTime(value, language, options) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(getLocaleFromLanguage(language), options);
}
