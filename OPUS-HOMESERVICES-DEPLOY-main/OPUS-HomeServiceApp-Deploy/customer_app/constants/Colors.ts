/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    // Additional colors for better theming
    cardBackground: '#ffffff',
    cardBorder: '#E5E7EB',
    cardShadow: '#000000',
    secondaryBackground: '#F9FAFB',
    secondaryText: '#6B7280',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    divider: '#E5E7EB',
    overlay: 'rgba(0, 0, 0, 0.5)',
    inputBackground: '#FFFFFF',
    inputBorder: '#D1D5DB',
    inputPlaceholder: '#9CA3AF',
  },
  dark: {
    text: '#ECEDEE',
    background: '#3b6d86ff',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    // Additional colors for better theming
    cardBackground: '#1F2937',
    cardBorder: '#374151',
    cardShadow: '#000000',
    secondaryBackground: '#111827',
    secondaryText: '#9CA3AF',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
    divider: '#374151',
    overlay: 'rgba(0, 0, 0, 0.7)',
    inputBackground: '#374151',
    inputBorder: '#4B5563',
    inputPlaceholder: '#6B7280',
  },
};
