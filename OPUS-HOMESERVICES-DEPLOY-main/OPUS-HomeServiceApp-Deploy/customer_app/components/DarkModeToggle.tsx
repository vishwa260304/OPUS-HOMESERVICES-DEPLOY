import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { hapticButtonPress } from '../utils/haptics';

export default function DarkModeToggle() {
  const { isDark, toggleTheme } = useTheme();

  const handleToggle = () => {
    hapticButtonPress();
    toggleTheme();
  };

  return (
    <TouchableOpacity
      onPress={handleToggle}
      activeOpacity={0.7}
      style={[
        styles.toggleButton,
        {
          backgroundColor: isDark ? '#374151' : '#FFFFFF',
          borderColor: isDark ? '#4B5563' : '#E5E7EB',
        }
      ]}
    >
      <Ionicons
        name={isDark ? 'sunny' : 'moon'}
        size={22}
        color={isDark ? '#FFD700' : '#000000'}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchableArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});