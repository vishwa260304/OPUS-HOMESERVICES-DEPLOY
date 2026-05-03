import React, { useLayoutEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '../../components/ThemedText';
import { ThemeToggle } from '../../components/ThemeToggle';

export default function ThemeSettingsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  return (
    <LinearGradient colors={["#004c8f", "#0c1a5d"]} style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Theme Settings
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {/* Theme Toggle Component */}
      <View style={styles.content}>
        <ThemeToggle />
        
        {/* Additional Theme Info */}
        <View style={styles.infoContainer}>
          <ThemedText style={styles.infoTitle}>About Themes</ThemedText>
          <ThemedText style={styles.infoText}>
            Choose between light, dark, or system themes. The system theme will automatically follow your device's appearance settings.
          </ThemedText>
          
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="sunny" size={20} color="#FFD700" />
              <ThemedText style={styles.featureText}>Light theme for bright environments</ThemedText>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="moon" size={20} color="#9B59B6" />
              <ThemedText style={styles.featureText}>Dark theme for low-light conditions</ThemedText>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="settings" size={20} color="#0a7ea4" />
              <ThemedText style={styles.featureText}>System theme follows device settings</ThemedText>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  infoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    marginBottom: 40,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
    marginBottom: 20,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    flex: 1,
  },
});