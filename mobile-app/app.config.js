export default {
  expo: {
    name: "Smart Attendance",
    slug: "smart-attendance",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    scheme: "smartattendance",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#5B7FFF"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.smartattendance.app"
    },
    android: {
      package: "com.smartattendance.app",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO"
      ]
    },
    web: {},
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission: "Allow Smart Attendance to access your camera for Face ID and QR code scanning."
        }
      ],
      "expo-router"
    ],
    extra: {
      // Environment variables - accessible via Constants.expoConfig.extra
      API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:5000/api',
    }
  }
};
