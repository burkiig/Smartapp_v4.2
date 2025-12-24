import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { UserProvider } from './context/UserContext';

export default function RootLayout() {
  return (
    <UserProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen 
          name="index" 
          options={{ 
            gestureEnabled: false,
            animation: 'none'
          }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            gestureEnabled: false,
            headerShown: false
          }} 
        />
      </Stack>
    </UserProvider>
  );
}
