import { Platform } from 'react-native';

export const Fonts = {
  // Roboto font family for different weights with fallbacks
  regular: Platform.select({
    ios: 'Roboto-Regular',
    android: 'Roboto-Regular',
    default: 'Roboto-Regular',
  }),
  medium: Platform.select({
    ios: 'Roboto-Medium',
    android: 'Roboto-Medium',
    default: 'Roboto-Medium',
  }),
  bold: Platform.select({
    ios: 'Roboto-Bold',
    android: 'Roboto-Bold',
    default: 'Roboto-Bold',
  }),
  light: Platform.select({
    ios: 'Roboto-Light',
    android: 'Roboto-Light',
    default: 'Roboto-Light',
  }),
  thin: Platform.select({
    ios: 'Roboto-Thin',
    android: 'Roboto-Thin',
    default: 'Roboto-Thin',
  }),
};

// Fallback fonts when Roboto is not loaded
export const FallbackFonts = {
  regular: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  medium: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  light: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  thin: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
};

// Default font family for the app
export const defaultFontFamily = Fonts.regular;