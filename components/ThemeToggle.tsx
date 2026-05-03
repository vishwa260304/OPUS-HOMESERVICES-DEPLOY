import React from 'react';
import { View, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

export const ThemeToggle = () => {
  const { themeMode, setThemeMode, isDark } = useTheme();

  const handleThemeModeChange = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        Theme Settings
      </ThemedText>
      
      <View style={styles.optionsContainer}>
        {/* Light Theme Option */}
        <TouchableOpacity
          style={[
            styles.option,
            themeMode === 'light' && styles.selectedOption
          ]}
          onPress={() => handleThemeModeChange('light')}
        >
          <View style={styles.optionContent}>
            <Ionicons 
              name="sunny" 
              size={24} 
              color={themeMode === 'light' ? '#FFD700' : '#687076'} 
            />
            <ThemedText style={styles.optionText}>Light</ThemedText>
          </View>
          {themeMode === 'light' && (
            <Ionicons name="checkmark-circle" size={20} color="#0a7ea4" />
          )}
        </TouchableOpacity>

        {/* Dark Theme Option */}
        <TouchableOpacity
          style={[
            styles.option,
            themeMode === 'dark' && styles.selectedOption
          ]}
          onPress={() => handleThemeModeChange('dark')}
        >
          <View style={styles.optionContent}>
            <Ionicons 
              name="moon" 
              size={24} 
              color={themeMode === 'dark' ? '#9B59B6' : '#687076'} 
            />
            <ThemedText style={styles.optionText}>Dark</ThemedText>
          </View>
          {themeMode === 'dark' && (
            <Ionicons name="checkmark-circle" size={20} color="#0a7ea4" />
          )}
        </TouchableOpacity>

        {/* System Theme Option */}
        <TouchableOpacity
          style={[
            styles.option,
            themeMode === 'system' && styles.selectedOption
          ]}
          onPress={() => handleThemeModeChange('system')}
        >
          <View style={styles.optionContent}>
            <Ionicons 
              name="settings" 
              size={24} 
              color={themeMode === 'system' ? '#0a7ea4' : '#687076'} 
            />
            <ThemedText style={styles.optionText}>System</ThemedText>
          </View>
          {themeMode === 'system' && (
            <Ionicons name="checkmark-circle" size={20} color="#0a7ea4" />
          )}
        </TouchableOpacity>
      </View>

      {/* Current Theme Display */}
      <View style={styles.currentThemeContainer}>
        <ThemedText style={styles.currentThemeLabel}>
          Current Theme: {themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
        </ThemedText>
        <View style={[styles.themeIndicator, { backgroundColor: isDark ? '#3b6d86ff' : '#fff' }]}>
          <Ionicons 
            name={isDark ? 'moon' : 'sunny'} 
            size={16} 
            color={isDark ? '#ECEDEE' : '#11181C'} 
          />
        </View>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 12,
    margin: 16,
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  selectedOption: {
    borderColor: '#0a7ea4',
    backgroundColor: 'rgba(10, 126, 164, 0.05)',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  currentThemeContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E1E5E9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currentThemeLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  themeIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
});
