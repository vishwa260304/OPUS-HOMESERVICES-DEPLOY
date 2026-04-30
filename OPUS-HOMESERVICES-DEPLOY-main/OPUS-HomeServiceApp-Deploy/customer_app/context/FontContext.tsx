import React, { createContext, useContext, ReactNode } from 'react';
import { useFonts } from 'expo-font';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

interface FontContextType {
  fontsLoaded: boolean;
  fontError: Error | null;
}

const FontContext = createContext<FontContextType>({
  fontsLoaded: false,
  fontError: null,
});

export const useFontContext = () => useContext(FontContext);

interface FontProviderProps {
  children: ReactNode;
}

export function FontProvider({ children }: FontProviderProps) {
  const [fontsLoaded, fontError] = useFonts({
    'SpaceMono-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Show loading screen until fonts are loaded
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading fonts...</Text>
      </View>
    );
  }

  // Show error screen if font loading failed
  if (fontError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load fonts</Text>
        <Text style={styles.errorSubtext}>{fontError.message}</Text>
      </View>
    );
  }

  return (
    <FontContext.Provider value={{ fontsLoaded, fontError }}>
      {children}
    </FontContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333333',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF0000',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});