import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserProvider, useUser } from '@/context/UserContext';
import { isAuthenticated } from '@/services/authService';
import { QueryProvider } from '@/query/QueryProvider';
import InAppBanner from '@/components/InAppBanner';
import ErrorBoundary from '@/components/ErrorBoundary';
import NetworkToast from '@/components/NetworkToast';
import eventBus from '@/utils/eventBus';
import {
  setupPushNotifications,
  addNotificationListeners,
  removeNotificationListeners,
} from '@/services/notificationService';

// Push notifications are not supported in Expo Go (SDK 53+).
// Only enable in standalone/development builds.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

function AuthGuard() {
  const { isLoggedIn, isLoading, isFaceVerified, user } = useUser();
  const router = useRouter();
  const segments = useSegments();
  const role = user?.role;

  const routeGroup = useMemo(() => {
    if (segments.length === 0 || segments[0] === 'index') return 'login';
    if (segments[0] === '(tabs)') return 'tabs';
    return 'other';
  }, [segments[0], segments.length]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLoading) return;

    if (isLoggedIn) {
      // ── Authenticated ──────────────────────────────────────────────────────
      if (!isFaceVerified) {
        // Face not yet verified this session.
        // Block access to tabs — user must verify first.
        // If they're still on the login screen, leave them there so they can
        // enter credentials (handles cold-start / "friend's phone" scenario).
        if (routeGroup === 'tabs') {
          router.replace('/login-face-verify');
        }
        // routeGroup === 'login'  → stay on login panel, do nothing
        // routeGroup === 'other'  → login-face-verify / register-face, do nothing
        return;
      }

      // Face verified — if still on login screen, send to correct dashboard
      if (routeGroup === 'login') {
        router.replace(
          role === 'instructor' || role === 'admin'
            ? '/(tabs)/dashboard'
            : '/(tabs)/home',
        );
      }
    } else {
      // Not authenticated — push back to login if inside the app
      if (routeGroup === 'tabs') router.replace('/');
    }
  }, [isLoggedIn, isLoading, isFaceVerified, routeGroup, role]);

  return null;
}

function ForceLogoutManager() {
  const { logout } = useUser();
  useEffect(() => {
    const unsub = eventBus.on('FORCE_LOGOUT', () => { logout(); });
    return unsub;
  }, [logout]);
  return null;
}

function TokenRefreshManager() {
  const { isLoggedIn, logout, checkAuthStatus } = useUser();
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (!isLoggedIn) return;

    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        // App came to foreground — silently verify / refresh token
        const valid = await isAuthenticated();
        if (!valid) {
          logout();
        } else {
          // Re-sync user state in case token was refreshed
          checkAuthStatus();
        }
      }
      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, [isLoggedIn]);

  return null;
}

function NotificationManager() {
  const { isLoggedIn, user } = useUser();
  const router = useRouter();
  const listenersRef = useRef(null);
  const processedNotificationIdsRef = useRef(new Set());
  const consumedResponseKeysRef = useRef(new Set());
  const bannerIdRef = useRef(0);
  const [bannerQueue, setBannerQueue] = useState([]);
  const [activeBanner, setActiveBanner] = useState(null);
  const role = user?.role;
  const insets = useSafeAreaInsets();
  // useLastNotificationResponse is a no-op in Expo Go (returns undefined)
  const lastNotificationResponse = IS_EXPO_GO ? undefined : Notifications.useLastNotificationResponse();

  const getNotificationDedupKey = useCallback((notificationLike) => {
    const identifier = notificationLike?.request?.identifier || notificationLike?.notification?.request?.identifier;
    if (identifier) return identifier;
    const data = notificationLike?.request?.content?.data || notificationLike?.notification?.request?.content?.data || {};
    const type = data?.type || 'unknown';
    const sessionId = data?.session_id ?? 'none';
    return `${type}:${String(sessionId)}`;
  }, []);

  /**
   * Returns true when notification id/key was already processed.
   */
  const hasProcessedNotification = useCallback((dedupKey) => {
    if (!dedupKey) return false;
    return processedNotificationIdsRef.current.has(dedupKey);
  }, []);

  /**
   * Marks a notification id/key as processed.
   * Keeps the set bounded to avoid unbounded memory growth.
   */
  const markNotificationProcessed = useCallback((dedupKey) => {
    if (!dedupKey) return;
    const cache = processedNotificationIdsRef.current;
    cache.add(dedupKey);
    if (cache.size > 100) {
      const oldest = cache.values().next().value;
      cache.delete(oldest);
    }
  }, []);

  /**
   * Marks a last-notification-response key as consumed.
   * Prevents re-processing same response object across remount/login cycles.
   */
  const markResponseConsumed = useCallback((dedupKey) => {
    if (!dedupKey) return;
    const cache = consumedResponseKeysRef.current;
    cache.add(dedupKey);
    if (cache.size > 100) {
      const oldest = cache.values().next().value;
      cache.delete(oldest);
    }
  }, []);

  const enqueueBanner = useCallback((payload) => {
    if (!payload?.message) return;
    bannerIdRef.current += 1;
    setBannerQueue(prev => [...prev, { id: bannerIdRef.current, ...payload }]);
  }, []);

  const processNotificationByType = useCallback((data = {}, mode = 'foreground', meta = {}) => {
    const { title, body } = meta;
    if (data?.type === 'session_started' && role === 'student') {
      if (mode === 'response') {
        router.push({
          pathname: '/qr-scan',
          params: { session_id: data.session_id },
        });
      } else {
        enqueueBanner({
          type: 'info',
          message: title || body || 'Yoklama basladi. Katilim icin QR dogrulamaya gidin.',
          actionLabel: 'Yoklama Al',
          onAction: () =>
            router.push({
              pathname: '/qr-scan',
              params: { session_id: data.session_id },
            }),
        });
      }
      return true;
    }

    if (data?.type === 'flagged_attendance' && (role === 'instructor' || role === 'admin')) {
      if (mode === 'response') {
        router.push({
          pathname: '/(tabs)/attendance',
          params: { filter: 'flagged', session_id: String(data.session_id) },
        });
      } else {
        enqueueBanner({
          type: 'warning',
          message: title || body || 'Supheli yoklama kaydi inceleme bekliyor.',
          actionLabel: 'Incele',
          onAction: () =>
            router.push({
              pathname: '/(tabs)/attendance',
              params: { filter: 'flagged', session_id: String(data.session_id) },
            }),
        });
      }
      return true;
    }

    if (data?.type === 'class_cancelled') {
      enqueueBanner({
        type: 'error',
        message: `Ders iptal edildi: ${data?.session_name || 'Bilinmeyen oturum'}`,
      });
      return true;
    }

    if (title && body && mode === 'foreground') {
      enqueueBanner({ type: 'info', message: `${title}: ${body}` });
      return true;
    }
    return false;
  }, [enqueueBanner, role, router]);

  const processResponse = useCallback(async (response) => {
    if (!isLoggedIn) return;
    const dedupKey = getNotificationDedupKey(response);
    if (consumedResponseKeysRef.current.has(dedupKey)) return;
    if (hasProcessedNotification(dedupKey)) return;
    markResponseConsumed(dedupKey);
    markNotificationProcessed(dedupKey);
    const data = response?.notification?.request?.content?.data || {};

    // Mark the corresponding DB notification as read.
    // This path covers the cold-start / killed-app scenario where
    // lastNotificationResponse fires directly, bypassing the listener in
    // notificationService.js that would otherwise call markRead.
    const notifId = data?.notificationId;
    if (notifId) {
      try {
        const { notifications: notifApi } = await import('@/services/api');
        await notifApi.markRead(notifId);
      } catch {
        // Non-critical — ignore silently
      }
    }

    processNotificationByType(data, 'response');
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch {
      // Notification center cleanup should never break navigation flow.
    }
  }, [
    getNotificationDedupKey,
    hasProcessedNotification,
    isLoggedIn,
    markNotificationProcessed,
    markResponseConsumed,
    processNotificationByType,
  ]);

  useEffect(() => {
    if (!isLoggedIn) return;

    // Skip push notification setup in Expo Go — not supported since SDK 53
    if (!IS_EXPO_GO) {
      setupPushNotifications();
    }

    listenersRef.current = addNotificationListeners(
      // Uygulama açıkken gelen bildirim — banner olarak göster
      (notification) => {
        const dedupKey = getNotificationDedupKey(notification);
        if (hasProcessedNotification(dedupKey)) return;
        markNotificationProcessed(dedupKey);
        const { title, body, data } = notification.request.content;
        if (!title && !body) return;
        const handled = processNotificationByType(data || {}, 'foreground', { title, body });
        if (!handled && title && body) {
          enqueueBanner({ type: 'info', message: `${title}: ${body}` });
        }
      },
      // Kullanıcı bildirime tıkladı (uygulama kapalıyken veya arka plandayken)
      (response) => { void processResponse(response); }
    );

    return () => {
      removeNotificationListeners(listenersRef.current);
    };
  }, [enqueueBanner, getNotificationDedupKey, hasProcessedNotification, isLoggedIn, markNotificationProcessed, processNotificationByType, processResponse]);

  useEffect(() => {
    if (!isLoggedIn || !lastNotificationResponse) return;
    void processResponse(lastNotificationResponse);
  }, [isLoggedIn, lastNotificationResponse, processResponse]);

  useEffect(() => {
    if (activeBanner || bannerQueue.length === 0) return;
    setActiveBanner(bannerQueue[0]);
    setBannerQueue(prev => prev.slice(1));
  }, [activeBanner, bannerQueue]);

  return (
    <InAppBanner
      item={activeBanner}
      visible={Boolean(activeBanner)}
      topInset={insets.top}
      durationMs={3000}
      onActionPress={(item) => {
        item?.onAction?.();
        setActiveBanner(null);
      }}
      onDone={() => setActiveBanner(null)}
    />
  );
}

function LoadingScreen() {
  return (
    <View style={layoutStyles.loading}>
      <ActivityIndicator size="large" color="#2563EB" />
    </View>
  );
}

function AppShell() {
  const { isLoading } = useUser();

  if (isLoading) return <LoadingScreen />;

  return (
    <>
      <AuthGuard />
      <TokenRefreshManager />
      <ForceLogoutManager />
      <NotificationManager />
      <NetworkToast />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="index"
          options={{ gestureEnabled: false, animation: 'none' }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{ gestureEnabled: false, headerShown: false }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <UserProvider>
          <StatusBar style="light" />
          <AppShell />
        </UserProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

const layoutStyles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
});
