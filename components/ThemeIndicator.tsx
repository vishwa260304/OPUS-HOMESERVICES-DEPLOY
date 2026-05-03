import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export const ThemeIndicator = () => {
  const { themeMode, isDark } = useTheme();

  const getIconName = () => {
    if (themeMode === 'system') {
      return 'settings';
    }
    return isDark ? 'moon' : 'sunny';
  };

  const getIconColor = () => {
    if (themeMode === 'system') {
      return '#0a7ea4';
    }
    return isDark ? '#FFD700' : '#9B59B6';
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#4a5568' : '#f7fafc' }]}>
      <Ionicons 
        name={getIconName() as any} 
        size={16} 
        color={getIconColor()} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
