import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { useUser } from '../_context/UserContext';
import { Colors } from '../shared/config/theme';

function TabIcon({ name, color, focused }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

const TAB_BAR_STYLE = {
  backgroundColor: Colors.card,
  borderTopWidth: 0,
  height: Platform.OS === 'ios' ? 88 : 64,
  paddingBottom: Platform.OS === 'ios' ? 28 : 10,
  paddingTop: 8,
  // shadow
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: -4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 12,
};

const SCREEN_OPTIONS = {
  headerShown: false,
  gestureEnabled: false,
  tabBarActiveTintColor: Colors.primary,
  tabBarInactiveTintColor: Colors.textMuted,
  tabBarStyle: TAB_BAR_STYLE,
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  tabBarHideOnKeyboard: true,
};

export default function TabLayout() {
  const { user } = useUser();
  const role = user?.role;

  if (role === 'instructor' || role === 'admin') {
    return (
      <Tabs screenOptions={SCREEN_OPTIONS}>
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Panel',
            tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'grid' : 'grid-outline'} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: 'Program',
            tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="attendance"
          options={{
            title: 'Yoklama',
            tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Raporlar',
            tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'Diğer',
            tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'menu' : 'menu-outline'} color={color} focused={focused} />,
          }}
        />
        <Tabs.Screen name="home"    options={{ href: null }} />
        <Tabs.Screen name="history" options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    );
  }

  return (
    <Tabs screenOptions={SCREEN_OPTIONS}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Geçmiş',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'time' : 'time-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen name="dashboard"  options={{ href: null }} />
      <Tabs.Screen name="schedule"   options={{ href: null }} />
      <Tabs.Screen name="attendance" options={{ href: null }} />
      <Tabs.Screen name="reports"    options={{ href: null }} />
      <Tabs.Screen name="more"       options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  iconWrapActive: {
    backgroundColor: Colors.primaryLight,
  },
});
