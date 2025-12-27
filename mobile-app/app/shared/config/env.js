import Constants from 'expo-constants';

/**
 * Environment configuration for mobile app
 * Manages API URLs and environment-specific settings
 */

const ENV = {
    development: {
        // IMPORTANT: Use your local network IP, not localhost!
        // Find your IP: ipconfig (Windows) or ifconfig (Mac/Linux)
        API_URL: 'http://192.168.1.102:5000',
        ENABLE_DEVTOOLS: true,
        LOG_LEVEL: 'debug'
    },
    production: {
        API_URL: 'https://api.smartattendance.com',
        ENABLE_DEVTOOLS: false,
        LOG_LEVEL: 'error'
    }
};

const getEnvVars = () => {
    if (__DEV__) {
        return ENV.development;
    }
    return ENV.production;
};

export const config = getEnvVars();
export const API_URL = config.API_URL;
export const ENABLE_DEVTOOLS = config.ENABLE_DEVTOOLS;
export const LOG_LEVEL = config.LOG_LEVEL;
