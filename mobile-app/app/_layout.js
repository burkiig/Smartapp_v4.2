import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Alert, View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { UserProvider, useUser } from './_context/UserContext';
import { isAuthenticated } from './shared/services/authService';
import {
  setupPushNotifications,
  addNotificationListeners,
  removeNotificationListeners,
} from './shared/services/notificationService';

function AuthGuard() {
  const { isLoggedIn, isLoading, userType } = useUser();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inTabsGroup = segments[0] === '(tabs)';
    const onLoginScreen = segments.length === 0 || segments[0] === 'index';

    if (isLoggedIn && onLoginScreen) {
      // On login screen but already authenticated — redirect to tabs
      const destination = (userType === 'instructor' || userType === 'admin')
        ? '/(tabs)/dashboard'
        : '/(tabs)/home';
      router.replace(destination);
    } else if (!isLoggedIn && inTabsGroup) {
      // Logged out but inside tabs — push back to login
      router.replace('/');
    }
    // Other screens (qr-scan, face-scan, gps-verify, etc.) — leave as-is
  }, [isLoggedIn, isLoading, segments, userType]);

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
  const { isLoggedIn, userType } = useUser();
  const router = useRouter();
  const listenersRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) return;

    setupPushNotifications();

    listenersRef.current = addNotificationListeners(
      // Uygulama açıkken gelen bildirim — banner olarak göster
      (notification) => {
        const { title, body, data } = notification.request.content;
        if (!title && !body) return;
        // Yoklama başladı bildirimi — öğrenciye direkt yönlendirme seçeneği sun
        if (data?.type === 'session_started' && userType === 'student') {
          Alert.alert(title, body, [
            { text: 'Sonra', style: 'cancel' },
            {
              text: 'Yoklama Al',
              onPress: () =>
                router.push({
                  pathname: '/qr-scan',
                  params: { session_id: data.session_id },
                }),
            },
          ]);
        } else if (title && body) {
          Alert.alert(title, body);
        }
      },
      // Kullanıcı bildirime tıkladı (uygulama kapalıyken veya arka plandayken)
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'session_started' && userType === 'student') {
          router.push({
            pathname: '/qr-scan',
            params: { session_id: data.session_id },
          });
        }
      }
    );

    return () => {
      removeNotificationListeners(listenersRef.current);
    };
  }, [isLoggedIn, userType]);

  return null;
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
      <NotificationManager />
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
    <UserProvider>
      <StatusBar style="light" />
      <AppShell />
    </UserProvider>
  );
}

const layoutStyles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
});
