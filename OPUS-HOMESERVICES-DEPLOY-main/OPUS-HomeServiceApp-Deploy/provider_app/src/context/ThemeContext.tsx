import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Appearance, ColorSchemeName } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextType {
  themeMode: ThemeMode
  isDark: boolean
  setThemeMode: (mode: ThemeMode) => void
  colors: {
    background: string
    surface: string
    text: string
    textSecondary: string
    primary: string
    secondary: string
    border: string
    card: string
  }
}

const lightColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
  primary: '#004c8f',
  secondary: '#004c8f',
  border: '#e0e0e0',
  card: '#ffffff',
}

const darkColors = {
  background: '#121212',
  surface: '#1e1e1e',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  primary: '#004c8f',
  secondary: '#004c8f',
  border: '#333333',
  card: '#2a2a2a',
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light')
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>('light')

  useEffect(() => {
    // Load saved theme preference
    loadThemePreference()
    
    // Listen to system theme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme)
    })

    return () => subscription?.remove()
  }, [])

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme_preference')
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeModeState(savedTheme as ThemeMode)
      }
    } catch (error) {
      console.error('Error loading theme preference:', error)
    }
  }

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem('theme_preference', mode)
      setThemeModeState(mode)
    } catch (error) {
      console.error('Error saving theme preference:', error)
    }
  }

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark')
  const colors = isDark ? darkColors : lightColors

  const value: ThemeContextType = {
    themeMode,
    isDark,
    setThemeMode,
    colors,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
