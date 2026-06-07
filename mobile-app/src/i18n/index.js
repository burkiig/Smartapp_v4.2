import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mergeLocales } from './merge';
import trCommon from './locales/tr/common.json';
import trAuth from './locales/tr/auth.json';
import trAttendance from './locales/tr/attendance.json';
import trScreens from './locales/tr/screens.json';
import trFlows from './locales/tr/flows.json';
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enAttendance from './locales/en/attendance.json';
import enScreens from './locales/en/screens.json';
import enFlows from './locales/en/flows.json';
import { LANGUAGE_STORAGE_KEY, normalizeLanguage } from './constants';

export { LANGUAGE_STORAGE_KEY, normalizeLanguage, SUPPORTED_LANGUAGES } from './constants';
export { getDateLocale } from './format';
export * from './helpers';

const tr = mergeLocales(trCommon, trAuth, trAttendance, trScreens, trFlows);
const en = mergeLocales(enCommon, enAuth, enAttendance, enScreens, enFlows);

let initPromise = null;

export async function resolveInitialLanguage() {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return normalizeLanguage(stored);
  } catch {
    // Non-critical
  }

  const locales = Localization.getLocales?.() ?? [];
  const deviceCode = locales[0]?.languageCode
    ?? (typeof Localization.locale === 'string' ? Localization.locale.split('-')[0] : null);
  return normalizeLanguage(deviceCode);
}

export async function initI18n() {
  if (i18n.isInitialized) return i18n;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const lng = await resolveInitialLanguage();
    await i18n.use(initReactI18next).init({
      resources: {
        tr: { translation: tr },
        en: { translation: en },
      },
      lng,
      fallbackLng: 'tr',
      supportedLngs: ['tr', 'en'],
      nonExplicitSupportedLngs: true,
      compatibilityJSON: 'v4',
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    return i18n;
  })();

  return initPromise;
}

export async function changeAppLanguage(code) {
  const lng = normalizeLanguage(code);
  await i18n.changeLanguage(lng);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    // Non-critical
  }
  return lng;
}

export { i18n };
export default i18n;
