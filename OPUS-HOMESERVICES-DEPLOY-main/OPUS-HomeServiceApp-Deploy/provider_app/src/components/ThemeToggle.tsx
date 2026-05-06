import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type Props = {
  size?: number;
};

const ThemeToggle: React.FC<Props> = ({ size = 22 }) => {
  const { isDark, colors, setThemeMode } = useTheme();
  const toggle = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };
  
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Toggle theme"
      onPress={toggle}
      activeOpacity={0.85}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View>
        <Ionicons name={isDark ? 'moon' : 'sunny'} size={size} color="#ffffff" />
      </View>
    </TouchableOpacity>
  );
};

export default ThemeToggle;


