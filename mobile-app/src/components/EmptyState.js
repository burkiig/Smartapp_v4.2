import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/config/theme';

/**
 * Yeniden kullanılabilir boş durum bileşeni.
 * FlatList'in ListEmptyComponent'ı olarak veya bağımsız kullanılabilir.
 *
 * Props:
 *  - icon: Ionicons adı (ör. "calendar-outline")
 *  - title: Ana başlık metni
 *  - subtitle: İsteğe bağlı alt açıklama
 *  - onRetry: Fonksiyon varsa "Yenile" butonu göster
 *  - retryLabel: Buton etiketi (varsayılan "Yenile")
 */
export default function EmptyState({ icon = 'cube-outline', title, subtitle, onRetry, retryLabel }) {
  const { t } = useTranslation();
  const displayTitle = title ?? t('empty.defaultTitle');
  const displayRetryLabel = retryLabel ?? t('common.refresh');

  return (
    <View style={s.container}>
      <View style={s.iconWrap}>
        <Ionicons name={icon} size={52} color={Colors.border} />
      </View>
      <Text style={s.title}>{displayTitle}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      {onRetry && (
        <TouchableOpacity style={s.btn} onPress={onRetry}>
          <Ionicons name="refresh" size={15} color={Colors.primary} />
          <Text style={s.btnText}>{displayRetryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, paddingHorizontal: 32 },
  iconWrap:  { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:     { fontSize: 16, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center' },
  subtitle:  { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  btn:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary + '55', backgroundColor: Colors.primaryMuted },
  btnText:   { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
