const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fewer workers = less RAM during bundle (helps on low-memory Windows machines).
config.maxWorkers = 2;

module.exports = config;
