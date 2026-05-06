import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase, SUPABASE_STORAGE_URL } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import DateTimePicker from '../../components/DateTimePicker';

type ActingDriver = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  driving_experience_years: number | null;
  profile_photo: string | null;
  fare_per_hour: number | null;
};

const ActingDriversScreen: React.FC = () => {
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = useTheme();

  const [drivers, setDrivers] = useState<ActingDriver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<ActingDriver | null>(null);

  // Hide the default header for this route
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('providers_acting_drivers')
          .select('id, name, phone, email, address, driving_experience_years, profile_photo, fare_per_hour')
          .eq('verification_status', 'approved')
          .eq('Is_online', true)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error loading acting drivers:', fetchError);
          setError('Failed to load drivers');
          setDrivers([]);
        } else {
          setDrivers((data || []) as ActingDriver[]);
        }
      } catch (e: any) {
        console.error('Error loading acting drivers:', e);
        setError('Failed to load drivers');
        setDrivers([]);
      } finally {
        setLoading(false);
      }
    };

    loadDrivers();
  }, []);

  const handleBookNow = (driver: ActingDriver) => {
    setSelectedDriver(driver);
    setShowDateTimePicker(true);
  };

  const handleDateTimeConfirm = (date: string, time: string, endTime?: string) => {
    if (!selectedDriver) return;

    setShowDateTimePicker(false);

    // Navigate to checkout with driver details
    router.push({
      pathname: '/subcategories/acting-driver/checkout',
      params: {
        driverId: selectedDriver.id,
        driverName: selectedDriver.name || 'Acting Driver',
        driverPhoto: selectedDriver.profile_photo || '',
        farePerHour: selectedDriver.fare_per_hour?.toString() || '0',
        experience: selectedDriver.driving_experience_years?.toString() || '',
        address: selectedDriver.address || '',
        bookingDate: date,
        bookingTime: time,
        bookingEndTime: endTime || '',
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Acting Driver Services</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {loading && (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color={colors.secondary} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerWrap}>
            <Text style={{ color: colors.text }}>{error}</Text>
          </View>
        )}

        {!loading && !error && drivers.length === 0 && (
          <View style={styles.centerWrap}>
            <Ionicons name="car-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
              No acting drivers are online right now.{'\n'}Please check back later.
            </Text>
          </View>
        )}

        {!loading &&
          !error &&
          drivers.map((driver) => {
            // Construct full Supabase storage URL for profile photo
            const getProfilePhotoUrl = (path: string | null) => {
              if (!path || path.trim() === '') return null;
              // If it's already a full URL, return as is
              if (path.startsWith('http://') || path.startsWith('https://')) return path;
              // Otherwise, construct the Supabase storage URL
              return `${SUPABASE_STORAGE_URL}/profile-images/${path}`;
            };
            
            const profilePhotoUrl = getProfilePhotoUrl(driver.profile_photo);
            
            return (
            <TouchableOpacity 
              key={driver.id} 
              style={[styles.card, { backgroundColor: colors.card }]}
              activeOpacity={0.7}
              onPress={() => router.push(`/subcategories/acting-driver/${driver.id}`)}
            >
              <View style={styles.cardImageWrap}>
                {profilePhotoUrl ? (
                  <Image
                    source={{ uri: profilePhotoUrl }}
                    style={styles.cardImage}
                  />
                ) : (
                  <View style={styles.placeholderImage}>
                    <Ionicons name="person" size={48} color="#6B7280" />
                  </View>
                )}
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {driver.name || 'Acting Driver'}
                </Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  {driver.driving_experience_years
                    ? `${driver.driving_experience_years} years of driving experience`
                    : 'Experienced acting driver'}
                </Text>
                {driver.address ? (
                  <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                    {driver.address}
                  </Text>
                ) : null}
                {driver.fare_per_hour ? (
                  <Text style={[styles.fareText, { color: colors.secondary }]}>
                    ₹{driver.fare_per_hour}/hr
                  </Text>
                ) : null}

                <TouchableOpacity onPress={() => handleBookNow(driver)} activeOpacity={0.8}>
                  <LinearGradient
                    colors={[colors.secondary, colors.secondaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.bookButton}
                  >
                    <Text style={styles.bookText}>Book Now</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            );
          })}
      </ScrollView>

      <DateTimePicker
        visible={showDateTimePicker}
        onClose={() => setShowDateTimePicker(false)}
        onConfirm={handleDateTimeConfirm}
        serviceTitle={selectedDriver?.name || 'Acting Driver'}
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
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  cardImageWrap: {
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    margin: 12,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  cardRight: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 14,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: 2,
  },
  fareText: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#22C55E',
  },
  bookButton: {
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  bookText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  floatingCartButton: {
    position: 'absolute',
    bottom: 20,
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

export default ActingDriversScreen;
