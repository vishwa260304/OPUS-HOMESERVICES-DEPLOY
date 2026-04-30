const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for asset resolution
config.resolver.assetExts.push(
  // Images
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  // Fonts
  'ttf', 'otf', 'woff', 'woff2',
  // Other assets
  'mp3', 'mp4', 'wav', 'aac', 'm4a'
);

// Ensure proper asset resolution
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;


