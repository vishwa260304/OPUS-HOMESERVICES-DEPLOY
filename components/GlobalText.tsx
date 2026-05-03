import React from 'react';
import { Text, TextProps, Platform } from 'react-native';
import { useFonts } from 'expo-font';

interface GlobalTextProps extends TextProps {
  children: React.ReactNode;
  fontFamily?: 'SpaceMono-Regular' | 'default';
}

export default function GlobalText({ 
  children, 
  style, 
  fontFamily = 'default',
  ...props 
}: GlobalTextProps) {
  const [fontsLoaded] = useFonts({
    'SpaceMono-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  
  const getFontFamily = () => {
    if (!fontsLoaded) {
      return Platform.OS === 'ios' ? 'System' : 'sans-serif';
    }
    
    switch (fontFamily) {
      case 'SpaceMono-Regular':
        return 'SpaceMono-Regular';
      case 'default':
      default:
        return 'SpaceMono-Regular'; // Default custom font
    }
  };

  return (
    <Text 
      style={[
        {
          fontFamily: getFontFamily(),
        },
        style
      ]} 
      {...props}
    >
      {children}
    </Text>
  );
}