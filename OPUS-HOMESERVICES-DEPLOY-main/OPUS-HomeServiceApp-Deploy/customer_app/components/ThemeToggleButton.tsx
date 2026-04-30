import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggleButton = () => {
  const { themeMode, toggleTheme, isDark } = useTheme();

  const getIconName = () => {
    if (themeMode === 'system') {
      return 'settings';
    }
    return isDark ? 'sunny' : 'moon';
  };

  const getIconColor = () => {
    if (themeMode === 'system') {
      return '#0a7ea4';
    }
    return isDark ? '#FFD700' : '#9B59B6';
  };

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: isDark ? '#4a5568' : '#f7fafc' }]}
      onPress={toggleTheme}
      activeOpacity={0.7}
    >
      <Ionicons 
        name={getIconName() as any} 
        size={20} 
        color={getIconColor()} 
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
