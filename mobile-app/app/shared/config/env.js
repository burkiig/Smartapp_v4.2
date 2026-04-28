/**
 * Mobile App — Environment Configuration
 *
 * Development:
 *   Set EXPO_PUBLIC_API_URL in a .env file at the project root:
 *     EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
 *   Or use ngrok:
 *     EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.app
 *
 * Production:
 *   Set EXPO_PUBLIC_API_URL in EAS build secrets / app.config.js
 */

const FALLBACK_DEV_URL = 'http://192.168.1.101:8000';

const ENV = {
  development: {
    API_URL: process.env.EXPO_PUBLIC_API_URL || FALLBACK_DEV_URL,
    ENABLE_DEVTOOLS: true,
    LOG_LEVEL: 'debug',
  },
  production: {
    API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://api.smartattendance.com',
    ENABLE_DEVTOOLS: false,
    LOG_LEVEL: 'error',
  },
};

const getEnvVars = () => (__DEV__ ? ENV.development : ENV.production);

export const config = getEnvVars();
export const API_URL = config.API_URL;
export const ENABLE_DEVTOOLS = config.ENABLE_DEVTOOLS;
export const LOG_LEVEL = config.LOG_LEVEL;
