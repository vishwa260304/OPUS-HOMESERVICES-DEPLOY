export type Palette = {
  // Brand
  primary: string;
  primarySoft: string;
  gradientStart: string;
  gradientEnd: string;

  // Surfaces
  background: string; // whole app background
  card: string; // cards/tiles
  surface: string; // generic surface
  border: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  textOnCard: string;

  // Accents
  success: string;
  danger: string;
  warning: string;

  // Misc UI
  chipBlueBg: string;
  chipBlueText: string;
  bellBg: string;
};

// iPhone-first visual spec based on the screenshot:
// - Brand header: deep blue gradient that stays the same in light/dark
// - Page background: light gray (light) → black (dark)
// - Cards: white in both modes
export const lightPalette: Palette = {
  primary: '#3B5BFD',
  primarySoft: '#e6edff',
  gradientStart: '#0b1960',
  gradientEnd: '#001973',

  background: '#F2F4F7', // light gray page background
  card: '#FFFFFF',
  surface: '#FFFFFF',
  border: '#E5E7EB',

  textPrimary: '#0F172A',
  textSecondary: '#6B7280',
  textOnPrimary: '#FFFFFF',
  textOnCard: '#0F172A',

  success: '#26e07f',
  danger: '#ff3b30',
  warning: '#F59E0B',

  chipBlueBg: '#e6edff',
  chipBlueText: '#3B5BFD',
  bellBg: '#13235d',
};

export const darkPalette: Palette = {
  primary: '#3B5BFD',
  primarySoft: '#2E3A8C',
  gradientStart: '#0b1960',
  gradientEnd: '#001973',

  background: '#0B0B0B', // black page background
  card: '#1F2937', // dark gray cards/search/bottom bar
  surface: '#111111',
  border: '#334155',

  textPrimary: '#E5E7EB',
  textSecondary: '#9CA3AF',
  textOnPrimary: '#FFFFFF',
  textOnCard: '#E5E7EB',

  success: '#26e07f',
  danger: '#ff3b30',
  warning: '#F59E0B',

  chipBlueBg: '#1E2A78',
  chipBlueText: '#C7D2FE',
  bellBg: '#13235d',
};

export const colors = lightPalette;


