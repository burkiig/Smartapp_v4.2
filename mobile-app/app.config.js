const fs = require('fs');
const path = require('path');

const root = __dirname;

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

const googleServicesFile = './google-services.json';
const notificationIcon = './assets/notification-icon.png';

const androidConfig = {
  package: 'com.smartattendance.app',
  permissions: [
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.VIBRATE',
    'android.permission.POST_NOTIFICATIONS',
  ],
};

// Only reference Firebase file when present (avoids "Could not parse Expo config" in dev).
if (fileExists(googleServicesFile)) {
  androidConfig.googleServicesFile = googleServicesFile;
}

const notificationPluginOptions = {
  color: '#2563EB',
  defaultChannel: 'default',
  androidMode: 'default',
  androidCollapsedTitle: 'Smart Attendance',
};
if (fileExists(notificationIcon)) {
  notificationPluginOptions.icon = notificationIcon;
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'Smart Attendance',
    slug: 'smart-attendance',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    scheme: 'smartattendance',
    splash: {
      resizeMode: 'contain',
      backgroundColor: '#5B7FFF',
    },
    assetBundlePatterns: ['**/*'],
    android: androidConfig,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.smartattendance.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Yoklama doğrulaması için konum bilginize ihtiyaç var.',
        NSLocationAlwaysUsageDescription:
          'Yoklama doğrulaması için konum bilginize ihtiyaç var.',
      },
    },
    web: {},
    plugins: [
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow Smart Attendance to access your camera for Face ID and QR code scanning.',
        },
      ],
      ['expo-notifications', notificationPluginOptions],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Yoklama doğrulaması için konumunuza erişmemiz gerekiyor.',
        },
      ],
      'expo-router',
    ],
    extra: {
      API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:5000/api',
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '',
      },
    },
  },
};
