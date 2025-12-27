/**
 * Environment configuration for web panel
 * Manages API URLs and environment-specific settings
 */

const ENV = {
    development: {
        API_URL: 'http://localhost:5000',
        ENABLE_DEVTOOLS: true,
        LOG_LEVEL: 'debug'
    },
    production: {
        API_URL: process.env.REACT_APP_API_URL || 'https://api.smartattendance.com',
        ENABLE_DEVTOOLS: false,
        LOG_LEVEL: 'error'
    }
};

export const config = ENV[process.env.NODE_ENV || 'development'];

// Export individual values for convenience
export const API_URL = config.API_URL;
export const ENABLE_DEVTOOLS = config.ENABLE_DEVTOOLS;
export const LOG_LEVEL = config.LOG_LEVEL;
