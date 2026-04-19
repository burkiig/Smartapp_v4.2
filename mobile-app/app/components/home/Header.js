import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadows } from '../../shared/config/theme';

export default function Header({ userName, hasNotification = false, onRefresh }) {
  const firstName = userName?.split(' ')[0] || 'Öğrenci';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name}>{firstName} 👋</Text>
      </View>
      <View style={styles.actions}>
        {onRefresh && (
          <TouchableOpacity style={styles.notifBtn} onPress={onRefresh} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.notifBtn} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={22} color={Colors.text} />
          {hasNotification && <View style={styles.dot} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  left:    { gap: 2, flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  greeting:{ fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  name:    { fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  notifBtn:{
    width: 42, height: 42,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  dot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.card,
  },
});
