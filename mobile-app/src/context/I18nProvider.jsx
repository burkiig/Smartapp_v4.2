import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import { initI18n, i18n } from '@/i18n';

/**
 * Waits for AsyncStorage + device locale before rendering the app shell.
 */
export function I18nProvider({ children }) {
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    if (i18n.isInitialized) {
      setReady(true);
      return undefined;
    }

    let cancelled = false;
    initI18n()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
});
