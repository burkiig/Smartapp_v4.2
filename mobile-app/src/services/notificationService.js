/**
 * notificationService.js
 *
 * Expo Push Notification yönetimi:
 *  1. Kullanıcıdan bildirim izni isteme
 *  2. Expo push token alma (gerçek cihaz gerektirir)
 *  3. Token'ı backend'e kaydetme
 *  4. Gelen bildirimleri dinleme (uygulama açıkken)
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { auth } from '@/services/api';

// Uygulama ön plandayken bildirimlerin nasıl gösterileceğini ayarla
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getExpoProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    null
  );
}

/**
 * Bildirim izni ister ve Expo push token alır.
 * Sadece fiziksel cihazda çalışır (emülatörde token alınamaz).
 *
 * @returns {Promise<string|null>} ExponentPushToken[xxx] veya null
 */
export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.warn('[Notifications] Push bildirimler sadece gerçek cihazda çalışır.');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Bildirim izni reddedildi.');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Varsayılan',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });

      await Notifications.setNotificationChannelAsync('class_cancelled', {
        name: 'Ders İptalleri',
        description: 'Ders iptali bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#FF4444',
      });
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      console.warn(
        '[Notifications] Expo projectId bulunamadı. app.config.js -> extra.eas.projectId veya EXPO_PUBLIC_EAS_PROJECT_ID ayarlayın.'
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    return token;
  } catch (error) {
    console.error('[Notifications] Token alma hatası:', error);
    return null;
  }
}

/**
 * Push token'ı backend'e kaydeder.
 * Login sonrası çağrılır.
 *
 * @returns {Promise<boolean>} Kayıt başarılıysa true
 */
export async function setupPushNotifications() {
  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) return false;

    const response = await auth.savePushToken(token);
    if (response?.success) {
      return true;
    }
    return false;
  } catch (error) {
    console.warn('[Notifications] Push token kaydedilemedi:', error?.message || error);
    return false;
  }
}

/**
 * Bildirim dinleyicilerini başlatır.
 */
export function addNotificationListeners(onNotification, onResponseReceive) {
  const notificationListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      if (onNotification) onNotification(notification);
    }
  );

  const responseListener = Notifications.addNotificationResponseReceivedListener(
    async (response) => {
      const notifId = response?.notification?.request?.content?.data?.notificationId;
      if (notifId) {
        try {
          const { notifications } = await import('@/services/api');
          await notifications.markRead(notifId);
        } catch {
          // Non-critical — ignore silently
        }
      }
      if (onResponseReceive) onResponseReceive(response);
    }
  );

  return { notificationListener, responseListener };
}

/**
 * Bildirim dinleyicilerini temizler.
 */
export function removeNotificationListeners(listeners) {
  if (listeners?.notificationListener) {
    listeners.notificationListener.remove();
  }
  if (listeners?.responseListener) {
    listeners.responseListener.remove();
  }
}
