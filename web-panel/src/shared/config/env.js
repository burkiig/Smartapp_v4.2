/**
 * Web Panel — Environment Configuration
 * New backend runs on port 8000 (FastAPI)
 */
const ENV = {
  development: {
    API_URL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
    ENABLE_DEVTOOLS: true,
    LOG_LEVEL: 'debug',
  },
  production: {
    API_URL: process.env.REACT_APP_API_URL || 'https://api.smartattendance.com',
    ENABLE_DEVTOOLS: false,
    LOG_LEVEL: 'error',
  },
};

const getEnvVars = () => {
  if (process.env.NODE_ENV === 'production') {
    return ENV.production;
  }
  return ENV.development;
};

export const config = getEnvVars();
export const API_URL = config.API_URL;
export const ENABLE_DEVTOOLS = config.ENABLE_DEVTOOLS;
export const LOG_LEVEL = config.LOG_LEVEL;
