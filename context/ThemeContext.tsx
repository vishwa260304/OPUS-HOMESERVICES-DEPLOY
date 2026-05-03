import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Animated, Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  card: string;
  header: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  
  // Border and divider colors
  border: string;
  divider: string;
  
  // Accent colors (these stay the same in both modes)
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  secondaryDark: string;
  secondaryLight: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Special colors
  shadow: string;
  overlay: string;
}

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  transitionValue: Animated.Value;
  isTransitioning: boolean;
  themeMode: 'light' | 'dark' | 'system';
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
}

const lightTheme: ThemeColors = {
  // Background colors
  background: '#F1F3F4',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  header: '#FFFFFF',
  
  // Text colors
  text: '#000000',
  textSecondary: '#666666',
  textTertiary: '#999999',
  
  // Border and divider colors
  border: '#E0E0E0',
  divider: '#E0E0E0',
  
  // Accent colors (teal for index, blue for services)
  primary: '#26A69A',
  primaryDark: '#00897B',
  primaryLight: '#4DB6AC',
  secondary: '#004c8f',
  secondaryDark: '#0c1a5d',
  secondaryLight: '#1976D2',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // Special colors
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

const darkTheme: ThemeColors = {
  // Background colors - One shade darker
  background: '#151515',
  surface: '#1E1E1E',
  card: '#262626',
  header: '#1E1E1E',
  
  // Text colors
  text: '#FFFFFF',
  textSecondary: '#C8C8C8',
  textTertiary: '#969696',
  
  // Border and divider colors
  border: '#2E2E2E',
  divider: '#262626',
  
  // Accent colors (same as light mode)
  primary: '#26A69A',
  primaryDark: '#00897B',
  primaryLight: '#4DB6AC',
  secondary: '#004c8f',
  secondaryDark: '#0c1a5d',
  secondaryLight: '#1976D2',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // Special colors
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

const ThemeContext = createContext<Theme | undefined>(undefined);

// Helper function to interpolate between two colors
export const interpolateColor = (transitionValue: Animated.Value, lightColor: string, darkColor: string) => {
  return transitionValue.interpolate({
    inputRange: [0, 1],
    outputRange: [lightColor, darkColor],
  });
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system');
  const transitionValue = useRef(new Animated.Value(0)).current;

  // Function to determine the actual theme based on mode and system settings
  const getActualTheme = (mode: 'light' | 'dark' | 'system', systemScheme: 'light' | 'dark' | null | undefined) => {
    if (mode === 'system') {
      return systemScheme === 'dark';
    }
    return mode === 'dark';
  };

  // Load theme preference from storage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedThemeMode = await AsyncStorage.getItem('theme_mode');
        
        if (savedThemeMode !== null) {
          const mode = savedThemeMode as 'light' | 'dark' | 'system';
          setThemeMode(mode);
          
          // Determine the actual theme based on mode and system settings
          const actualIsDark = getActualTheme(mode, systemColorScheme);
          setIsDark(actualIsDark);
          transitionValue.setValue(actualIsDark ? 1 : 0);
        } else {
          // Default to system mode
          const actualIsDark = getActualTheme('system', systemColorScheme);
          setIsDark(actualIsDark);
          transitionValue.setValue(actualIsDark ? 1 : 0);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
        // Fallback to system theme
        const actualIsDark = getActualTheme('system', systemColorScheme);
        setIsDark(actualIsDark);
        transitionValue.setValue(actualIsDark ? 1 : 0);
      }
    };
    loadTheme();
  }, []);

  // Listen for system appearance changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (themeMode === 'system') {
        const actualIsDark = getActualTheme('system', colorScheme);
        setIsDark(actualIsDark);
        transitionValue.setValue(actualIsDark ? 1 : 0);
      }
    });

    return () => subscription?.remove();
  }, [themeMode]);

  // Save theme preference to storage with smooth transition
  const toggleTheme = async () => {
    const newTheme = !isDark;
    setIsTransitioning(true);
    
    // Animate the transition
    Animated.timing(transitionValue, {
      toValue: newTheme ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setIsTransitioning(false);
    });
    
    setIsDark(newTheme);
    try {
      await AsyncStorage.setItem('theme_mode', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  // Handle theme mode changes
  const handleSetThemeMode = async (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
    
    try {
      await AsyncStorage.setItem('theme_mode', mode);
      
      // Determine the actual theme based on the new mode
      const actualIsDark = getActualTheme(mode, systemColorScheme);
      setIsDark(actualIsDark);
      transitionValue.setValue(actualIsDark ? 1 : 0);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  };

  const theme: Theme = {
    colors: isDark ? darkTheme : lightTheme,
    isDark,
    toggleTheme,
    transitionValue,
    isTransitioning,
    themeMode,
    setThemeMode: handleSetThemeMode,
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
