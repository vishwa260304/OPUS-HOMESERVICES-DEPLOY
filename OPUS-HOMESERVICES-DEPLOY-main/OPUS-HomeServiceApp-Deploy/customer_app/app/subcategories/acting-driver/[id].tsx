import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase, SUPABASE_STORAGE_URL as SUPABASE_PUBLIC_STORAGE_URL } from '../../../lib/supabase';
import { useTheme } from '../../../context/ThemeContext';
import DateTimePicker from '../../../components/DateTimePicker';

const { width } = Dimensions.get('window');
const SUPABASE_STORAGE_URL = `${SUPABASE_PUBLIC_STORAGE_URL}/profile-images`;

type ActingDriver = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  driving_experience_years: number | null;
  profile_photo: string | null;
  fare_per_hour: number | null;
  about: string | null;
  services_offered: string[] | null;
  created_at: string | null;
};

// Service label mapping
const SERVICE_LABELS: Record<string, string> = {
  event_driving: 'Event Driving',
  airport_transfers: 'Airport Transfers',
  daily_commute: 'Daily Commute',
  long_distance: 'Long Distance',
  night_driving: 'Night Driving',
  outstation_trips: 'Outstation Trips',
  corporate_travel: 'Corporate Travel',
  personal_chauffeur: 'Personal Chauffeur',
  hourly_driving: 'Hourly Driving',
};

const ActingDriverDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();

  const [driver, setDriver] = useState<ActingDriver | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);

  // Hide the default header for this route
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const loadDriver = async () => {
      if (!id) {
        setError('Invalid driver ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('providers_acting_drivers')
          .select('id, name, phone, email, address, driving_experience_years, profile_photo, fare_per_hour, about, services_offered, created_at')
          .eq('id', id)
          .single();

        if (fetchError) {
          console.error('Error loading acting driver:', fetchError);
          setError('Failed to load driver details');
          setDriver(null);
        } else {
          setDriver(data as ActingDriver);
        }
      } catch (e: any) {
        console.error('Error loading acting driver:', e);
        setError('Failed to load driver details');
        setDriver(null);
      } finally {
        setLoading(false);
      }
    };

    loadDriver();
  }, [id]);

  const getProfilePhotoUrl = (path: string | null) => {
    if (!path || path.trim() === '') return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${SUPABASE_STORAGE_URL}/${path}`;
  };

  const handleBookNow = () => {
    setShowDateTimePicker(true);
  };

  const handleDateTimeConfirm = (date: string, time: string, endTime?: string) => {
    if (!driver) return;

    setShowDateTimePicker(false);

    // Navigate to checkout with driver details
    router.push({
      pathname: '/subcategories/acting-driver/checkout',
      params: {
        driverId: driver.id,
        driverName: driver.name || 'Acting Driver',
        driverPhoto: driver.profile_photo || '',
        farePerHour: driver.fare_per_hour?.toString() || '0',
        experience: driver.driving_experience_years?.toString() || '',
        address: driver.address || '',
        bookingDate: date,
        bookingTime: time,
        bookingEndTime: endTime || '',
      },
    });
  };

  const handleCall = () => {
    if (driver?.phone) {
      const phoneUrl = Platform.OS === 'ios' ? `telprompt:${driver.phone}` : `tel:${driver.phone}`;
      Linking.openURL(phoneUrl);
    }
  };

  const profilePhotoUrl = driver ? getProfilePhotoUrl(driver.profile_photo) : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Driver Details</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading && (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.secondary} />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
            <Text style={[styles.goBackText, { color: colors.secondary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && driver && (
        <>
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Photo Section */}
            <View style={styles.photoSection}>
              <View style={styles.photoContainer}>
                {profilePhotoUrl ? (
                  <Image
                    source={{ uri: profilePhotoUrl }}
                    style={styles.profilePhoto}
                  />
                ) : (
                  <View style={[styles.placeholderPhoto, { backgroundColor: '#E5E7EB' }]}>
                    <Ionicons name="person" size={80} color="#6B7280" />
                  </View>
                )}
              </View>
            </View>

            {/* Driver Info Card */}
            <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.driverName, { color: colors.text }]}>
                {driver.name || 'Acting Driver'}
              </Text>
              
              {driver.fare_per_hour && (
                <View style={styles.fareContainer}>
                  <Text style={[styles.fareLabel, { color: colors.textSecondary }]}>Fare</Text>
                  <Text style={[styles.fareValue, { color: colors.secondary }]}>
                    ₹{driver.fare_per_hour}/hr
                  </Text>
                </View>
              )}

              <View style={styles.divider} />

              {/* Info Rows */}
              <View style={styles.infoRow}>
                <View style={[styles.iconCircle, { backgroundColor: `${colors.secondary}15` }]}>
                  <Ionicons name="car-sport" size={20} color={colors.secondary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Experience</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {driver.driving_experience_years
                      ? `${driver.driving_experience_years} years of driving`
                      : 'Experienced driver'}
                  </Text>
                </View>
              </View>

              {driver.address && (
                <View style={styles.infoRow}>
                  <View style={[styles.iconCircle, { backgroundColor: `${colors.secondary}15` }]}>
                    <Ionicons name="location" size={20} color={colors.secondary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Location</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>{driver.address}</Text>
                  </View>
                </View>
              )}

              {driver.phone && (
                <View style={styles.infoRow}>
                  <View style={[styles.iconCircle, { backgroundColor: `${colors.secondary}15` }]}>
                    <Ionicons name="call" size={20} color={colors.secondary} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Contact</Text>
                    <Text style={[styles.infoValue, { color: colors.textSecondary }]}>
                      {driver.phone.slice(0, 4)}••••••{driver.phone.slice(-2)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* About Section */}
            <View style={[styles.aboutCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
              <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
                {driver.about ? driver.about : (
                  `Professional acting driver available for hire.${driver.driving_experience_years 
                    ? ` With ${driver.driving_experience_years} years of experience.` 
                    : ''} Reliable and punctual service for all your driving needs including events, airport transfers, and daily commutes.`
                )}
              </Text>
            </View>

            {/* Services Section */}
            {driver.services_offered && driver.services_offered.length > 0 && (
              <View style={[styles.servicesCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Services Offered</Text>
                <View style={styles.servicesList}>
                  {driver.services_offered.map((serviceId, index) => (
                    <View key={index} style={styles.serviceItem}>
                      <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                      <Text style={[styles.serviceText, { color: colors.text }]}>
                        {SERVICE_LABELS[serviceId] || serviceId}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Spacer for bottom button */}
            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Bottom Book Button */}
          <View style={[styles.bottomBar, { backgroundColor: colors.background }]}>
            <View style={styles.priceInfo}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>Starting at</Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>
                {driver.fare_per_hour ? `₹${driver.fare_per_hour}/hr` : 'Contact for price'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleBookNow} activeOpacity={0.8} style={{ flex: 1 }}>
              <LinearGradient
                colors={[colors.secondary, colors.secondaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.bookButton}
              >
                <Text style={styles.bookButtonText}>Book Now</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}

      <DateTimePicker
        visible={showDateTimePicker}
        onClose={() => setShowDateTimePicker(false)}
        onConfirm={handleDateTimeConfirm}
        serviceTitle={driver?.name || 'Acting Driver'}
        useBlueGradient
        timeRangeInput
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  errorText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  goBackButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  goBackText: {
    fontSize: 16,
    fontWeight: '600',
  },
  photoSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  photoContainer: {
    position: 'relative',
  },
  profilePhoto: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#E5E7EB',
  },
  placeholderPhoto: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineBadgeLarge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  driverName: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  fareContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  fareLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  fareValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  aboutCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 22,
  },
  servicesCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  servicesList: {
    gap: 12,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  serviceText: {
    fontSize: 15,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 16,
  },
  priceInfo: {
    flex: 0.6,
  },
  priceLabel: {
    fontSize: 12,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  bookButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  floatingCartButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
});

export default ActingDriverDetailScreen;
