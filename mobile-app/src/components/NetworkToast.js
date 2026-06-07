import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

/**
 * Ekranın en üstünde kayan bant.
 * İnternet bağlantısı kesilince kırmızı (kalıcı), geri gelince yeşil (2.5sn) gösterir.
 *
 * Düzeltilen hatalar:
 *  1. NetInfo aynı durumu art arda birden fazla kez bildirebilir; prevConnected ref'i ile
 *     yalnızca gerçek geçişlere (false→true, true→false) tepki verilir. Bu sayede
 *     clearTimeout+reset döngüsü kırılır ve banner 2.5sn sonra gerçekten kaybolur.
 *  2. setIsConnected güncelleyicisi içinden setFirstCheck çağrısı kaldırıldı
 *     (iç içe setState anti-pattern → ekstra yeniden render → timer iptali).
 */
export default function NetworkToast() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [isConnected, setIsConnected] = useState(null); // null → henüz bilinmiyor
  const [visible,     setVisible]     = useState(false); // animasyon aktifken mount'ta tut

  const slideY         = useRef(new Animated.Value(-80)).current;
  const hideTimer      = useRef(null);
  const prevConnected  = useRef(null); // son bilinen bağlantı durumu

  // NetInfo dinleyicisi — yalnızca gerçek connected değerini sakla
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const connected = !!(state.isConnected && state.isInternetReachable !== false);
      setIsConnected(connected);
    });
    return () => unsub();
  }, []);

  // Bağlantı değişince banner göster/gizle
  useEffect(() => {
    if (isConnected === null) return; // ilk durum henüz belli değil

    const prev = prevConnected.current;
    prevConnected.current = isConnected;

    // Aynı durum tekrar gelirse (NetInfo çoklu olay) hiçbir şey yapma —
    // bu, clearTimeout + sayaç sıfırlama döngüsünü engeller.
    if (prev === isConnected) return;

    clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setVisible(true);

    // Banner'ı ekrana kaydır
    Animated.spring(slideY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();

    if (isConnected) {
      // Bağlantı geldi → 2.5sn sonra ekrandan çık ve unmount et
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        Animated.timing(slideY, {
          toValue: -80,
          useNativeDriver: true,
          duration: 300,
        }).start(() => setVisible(false));
      }, 2500);
    }
    // Bağlantı yoksa → kalıcı kalsın (timer yok)

    return () => clearTimeout(hideTimer.current);
  }, [isConnected]);

  if (!visible || isConnected === null) return null;

  return (
    <Animated.View
      style={[
        s.toast,
        { top: insets.top, transform: [{ translateY: slideY }] },
        isConnected ? s.online : s.offline,
      ]}
      pointerEvents="none"
    >
      <Ionicons
        name={isConnected ? 'wifi-outline' : 'cloud-offline-outline'}
        size={15}
        color="#fff"
      />
      <Text style={s.text}>
        {isConnected ? t('network.online') : t('network.offline')}
      </Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast:   {
    position: 'absolute', left: 0, right: 0, zIndex: 9999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 10, paddingHorizontal: 20,
  },
  offline: { backgroundColor: '#DC2626' },
  online:  { backgroundColor: '#16A34A' },
  text:    { color: '#fff', fontWeight: '700', fontSize: 13 },
});
