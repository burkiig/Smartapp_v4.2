import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage, normalizeLanguage } from '@/i18n';
import { Colors, Shadows } from '@/config/theme';

const LANG_OPTIONS = [
  { code: 'tr', labelKey: 'settings.languageTr', short: 'TR' },
  { code: 'en', labelKey: 'settings.languageEn', short: 'EN' },
];

/**
 * @param {'compact' | 'full'} variant — compact: header pill (TR/EN); full: labeled toggle (login/settings)
 */
export default function LanguageToggle({ variant = 'compact', style }) {
  const { t, i18n } = useTranslation();
  const activeLang = normalizeLanguage(i18n.language);

  const handleLanguage = useCallback(async (code) => {
    if (code !== activeLang) await changeAppLanguage(code);
  }, [activeLang]);

  const isCompact = variant === 'compact';

  return (
    <View style={[isCompact ? styles.compact : styles.full, style]}>
      {LANG_OPTIONS.map(({ code, labelKey, short }) => {
        const active = activeLang === code;
        return (
          <TouchableOpacity
            key={code}
            style={[
              isCompact ? styles.compactBtn : styles.fullBtn,
              active && (isCompact ? styles.compactBtnActive : styles.fullBtnActive),
            ]}
            onPress={() => handleLanguage(code)}
            accessibilityRole="button"
            accessibilityLabel={t(labelKey)}
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                isCompact ? styles.compactText : styles.fullText,
                active && (isCompact ? styles.compactTextActive : styles.fullTextActive),
              ]}
            >
              {isCompact ? short : t(labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 3,
    ...Shadows.sm,
  },
  compactBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    minWidth: 36,
    alignItems: 'center',
  },
  compactBtnActive: {
    backgroundColor: Colors.primaryMuted,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  compactTextActive: {
    color: Colors.primary,
  },

  full: {
    flexDirection: 'row',
    gap: 8,
  },
  fullBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.bgAlt,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  fullBtnActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  fullText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  fullTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
