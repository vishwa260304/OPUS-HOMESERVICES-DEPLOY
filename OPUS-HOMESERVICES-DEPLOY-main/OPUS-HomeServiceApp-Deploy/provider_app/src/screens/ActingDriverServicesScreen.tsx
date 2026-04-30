import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';

const SERVICES_LIST = [
  { id: 'event_driving', label: 'Event Driving', icon: 'calendar' },
  { id: 'airport_transfers', label: 'Airport Transfers', icon: 'airplane' },
  { id: 'daily_commute', label: 'Daily Commute', icon: 'car' },
  { id: 'long_distance', label: 'Long Distance', icon: 'map' },
  { id: 'night_driving', label: 'Night Driving', icon: 'moon' },
  { id: 'outstation_trips', label: 'Outstation Trips', icon: 'navigate' },
  { id: 'corporate_travel', label: 'Corporate Travel', icon: 'briefcase' },
  { id: 'personal_chauffeur', label: 'Personal Chauffeur', icon: 'person' },
  { id: 'hourly_driving', label: 'Hourly Driving', icon: 'time' },
];

const ActingDriverServicesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setInitialLoading(true);
      try {
        const res = await api.actingDrivers.getActingDriverDetails(user.id);
        if (!res.error && res.data) {
          const driver = res.data as any;
          setDetailsId(driver.id);
          // Load existing services if any
          if (driver.services_offered && Array.isArray(driver.services_offered)) {
            setSelectedServices(driver.services_offered);
          }
        }
      } catch (error) {
        console.error('Error loading driver details:', error);
      } finally {
        setInitialLoading(false);
      }
    };
    load();
  }, [user]);

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) => {
      if (prev.includes(serviceId)) {
        return prev.filter((id) => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const handleContinue = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to continue');
      return;
    }

    if (selectedServices.length === 0) {
      Alert.alert('Select Services', 'Please select at least one service you offer');
      return;
    }

    if (!detailsId) {
      Alert.alert('Error', 'Please complete your personal details first');
      return;
    }

    try {
      setLoading(true);
      const { error } = await api.actingDrivers.updateActingDriverDetails(detailsId, {
        services_offered: selectedServices,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to save services');
        return;
      }

      // Navigate to Fare screen
      (navigation as any).navigate('ActingDriverFare');
    } catch (err) {
      console.error('Error saving services:', err);
      Alert.alert('Error', 'Failed to save services');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Select Your Services</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Choose the services you offer as an acting driver. You can select multiple options.
        </Text>

        <View style={styles.servicesContainer}>
          {SERVICES_LIST.map((service) => {
            const isSelected = selectedServices.includes(service.id);
            return (
              <TouchableOpacity
                key={service.id}
                style={[
                  styles.serviceCard,
                  { backgroundColor: colors.card, borderColor: isSelected ? colors.secondary : colors.border },
                  isSelected && styles.serviceCardSelected,
                ]}
                activeOpacity={0.7}
                onPress={() => toggleService(service.id)}
              >
                <View style={[
                  styles.iconContainer,
                  { backgroundColor: isSelected ? `${colors.secondary}20` : '#F4F6FB' }
                ]}>
                  <Ionicons
                    name={service.icon as any}
                    size={24}
                    color={isSelected ? colors.secondary : colors.textSecondary}
                  />
                </View>
                <Text style={[
                  styles.serviceLabel,
                  { color: isSelected ? colors.secondary : colors.text }
                ]}>
                  {service.label}
                </Text>
                <View style={[
                  styles.checkbox,
                  { borderColor: isSelected ? colors.secondary : colors.border },
                  isSelected && { backgroundColor: '#E6F0FF' }
                ]}>
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color={colors.secondary} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.selectedCount, { color: colors.textSecondary }]}>
          {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''} selected
        </Text>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          disabled={loading || selectedServices.length === 0}
          onPress={handleContinue}
          activeOpacity={0.8}
          style={{ flex: 1 }}
        >
          <LinearGradient
            colors={selectedServices.length === 0 ? ['#A0AEC0', '#718096'] : ['#004c8f', '#0c1a5d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.continueButton, (loading || selectedServices.length === 0) && styles.buttonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
    marginTop: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6ECFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  servicesContainer: {
    gap: 12,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
  },
  serviceCardSelected: {
    borderWidth: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  serviceLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCount: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
  },
  continueButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default ActingDriverServicesScreen;
