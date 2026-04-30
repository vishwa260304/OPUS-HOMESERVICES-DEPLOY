import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import { lightPalette, darkPalette, type Palette } from './colors';

export const spacing = (n: number) => n;
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

export type Theme = { colors: Palette; spacing: typeof spacing; radius: typeof radius; isDark: boolean };

const defaultTheme: Theme = { colors: lightPalette, spacing, radius, isDark: false };

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
} | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const system = Appearance.getColorScheme();
  const prefersDark = system === 'dark';
  const [isDark, setIsDark] = useState<boolean>(prefersDark);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setIsDark(colorScheme === 'dark');
    });
    return () => sub.remove();
  }, []);

  const theme = useMemo<Theme>(() => {
    return { colors: isDark ? darkPalette : lightPalette, spacing, radius, isDark };
  }, [isDark]);

  const value = useMemo(() => ({ theme, toggle: () => setIsDark((d) => !d) }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
export const theme = defaultTheme;
export default defaultTheme;


