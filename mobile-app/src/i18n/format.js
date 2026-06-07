import i18n from 'i18next';
import { normalizeLanguage } from './constants';

/**
 * BCP 47 locale for Date.prototype.toLocale* (device-independent).
 * @param {string} [language] i18n language code; defaults to active language
 */
export function getDateLocale(language) {
  const lng = normalizeLanguage(language ?? i18n.language);
  return lng === 'en' ? 'en-US' : 'tr-TR';
}
