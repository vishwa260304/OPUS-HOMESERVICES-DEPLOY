import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';

const ActingDriverFareScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [fare, setFare] = useState('');
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const res = await api.actingDrivers.getActingDriverDetails(user.id);
      if (!res.error && res.data) {
        const driver = res.data as any;
        setDetailsId(driver.id);
        if (driver.fare_per_hour != null) {
          setFare(String(driver.fare_per_hour));
        }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to continue');
      return;
    }
    if (!detailsId) {
      Alert.alert('Error', 'Please complete your personal details first');
      return;
    }

    const value = Number(fare);
    if (!fare.trim() || !Number.isFinite(value) || value <= 0) {
      Alert.alert('Invalid Fare', 'Please enter a valid fare per hour (e.g., 299).');
      return;
    }

    try {
      setLoading(true);
      const { error } = await api.actingDrivers.updateActingDriverDetails(detailsId, {
        fare_per_hour: value,
      });
      if (error) {
        Alert.alert('Error', error.message || 'Failed to save fare');
        return;
      }

      // Navigate to Acting Drivers Dashboard after saving fare
      (navigation as any).reset({
        index: 0,
        routes: [{ name: 'ActingDriversDashboard' }],
      });
    } catch (err) {
      console.error('Error saving fare:', err);
      Alert.alert('Error', 'Failed to save fare');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Set Your Fare</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Enter your preferred fare per hour for acting driver services.
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>Fare per hour (₹)</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        keyboardType="numeric"
        placeholder="e.g., 299"
        placeholderTextColor={colors.textSecondary}
        value={fare}
        onChangeText={setFare}
      />

      <TouchableOpacity disabled={loading} onPress={handleSave} activeOpacity={0.8}>
        <LinearGradient
          colors={['#004c8f', '#0c1a5d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.button}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save & Continue</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 20,
    backgroundColor: '#F4F6FB',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default ActingDriverFareScreen;

