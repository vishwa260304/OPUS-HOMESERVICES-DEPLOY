import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import { SUPABASE_STORAGE_URL } from '../lib/supabase';

const PROFILE_IMAGES_URL = `${SUPABASE_STORAGE_URL}/profile-images`;

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

type DriverDetails = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  driving_experience_years: number | null;
  profile_photo: string | null;
  fare_per_hour: number | null;
  about: string | null;
  services_offered: string[] | null;
  aadhaar_number: string | null;
  drivers_licence: string | null;
  verification_status: string | null;
};

const ActingDriverPersonalDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [driver, setDriver] = useState<DriverDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [address, setAddress] = useState('');
  const [experience, setExperience] = useState('');
  const [about, setAbout] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // All available services
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

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) => {
      if (prev.includes(serviceId)) {
        return prev.filter((id) => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  useEffect(() => {
    loadDriverDetails();
  }, [user]);

  const loadDriverDetails = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const result = await api.actingDrivers.getActingDriverDetails(user.id);

      if (!result.error && result.data) {
        const data = result.data as DriverDetails;
        setDriver(data);
        // Populate editable fields
        setAddress(data.address || '');
        setExperience(data.driving_experience_years?.toString() || '');
        setAbout(data.about || '');
        setSelectedServices(data.services_offered || []);
      }
    } catch (error) {
      console.error('Error loading driver details:', error);
      Alert.alert('Error', 'Failed to load your details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!driver) return;

    try {
      setSaving(true);
      const { error } = await api.actingDrivers.updateActingDriverDetails(driver.id, {
        address: address.trim(),
        driving_experience_years: experience ? parseInt(experience) : undefined,
        about: about.trim() || undefined,
        services_offered: selectedServices,
      });

      if (error) {
        Alert.alert('Error', 'Failed to save changes');
        return;
      }

      Alert.alert('Success', 'Your details have been updated');
      setEditing(false);
      loadDriverDetails(); // Refresh data
    } catch (error) {
      console.error('Error saving details:', error);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getProfilePhotoUrl = (path: string | null) => {
    if (!path || path.trim() === '') return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${PROFILE_IMAGES_URL}/${path}`;
  };

  const profilePhotoUrl = driver ? getProfilePhotoUrl(driver.profile_photo) : null;

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Personal Details</Text>
        <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={colors.secondary} />
          ) : (
            <Text style={[styles.editButton, { color: colors.secondary }]}>
              {editing ? 'Save' : 'Edit'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Photo Section */}
        <View style={styles.photoSection}>
          {profilePhotoUrl ? (
            <Image source={{ uri: profilePhotoUrl }} style={styles.profilePhoto} />
          ) : (
            <View style={[styles.placeholderPhoto, { backgroundColor: '#E5E7EB' }]}>
              <Ionicons name="person" size={60} color="#6B7280" />
            </View>
          )}
          {driver?.verification_status && (
            <View style={[
              styles.verificationBadge,
              { backgroundColor: driver.verification_status === 'approved' ? '#22C55E' : '#F59E0B' }
            ]}>
              <Ionicons 
                name={driver.verification_status === 'approved' ? 'checkmark-circle' : 'time'} 
                size={14} 
                color="#FFFFFF" 
              />
              <Text style={styles.verificationText}>
                {driver.verification_status === 'approved' ? 'Verified' : 'Pending'}
              </Text>
            </View>
          )}
        </View>

        {/* Details Card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Basic Information</Text>

          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Full Name</Text>
            <Text style={[styles.fieldValue, { color: colors.text }]}>{driver?.name || '-'}</Text>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Phone Number</Text>
            <Text style={[styles.fieldValue, { color: colors.text }]}>{driver?.phone || '-'}</Text>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email Address</Text>
            <Text style={[styles.fieldValue, { color: colors.text }]}>{driver?.email || '-'}</Text>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Address</Text>
            {editing ? (
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter your address"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>{driver?.address || '-'}</Text>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Driving Experience (Years)</Text>
            {editing ? (
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={experience}
                onChangeText={setExperience}
                placeholder="Enter years of experience"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>
                {driver?.driving_experience_years ? `${driver.driving_experience_years} years` : '-'}
              </Text>
            )}
          </View>
        </View>

        {/* About Section */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About Me</Text>
          <View style={styles.fieldContainer}>
            {editing ? (
              <TextInput
                style={[styles.input, styles.textAreaLarge, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={about}
                onChangeText={setAbout}
                placeholder="Tell customers about yourself..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={5}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: colors.text }]}>
                {driver?.about || 'No description added yet.'}
              </Text>
            )}
          </View>
        </View>

        {/* Fare Section */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Fare Details</Text>
          <View style={styles.fareRow}>
            <View style={[styles.fareIconContainer, { backgroundColor: `${colors.secondary}15` }]}>
              <Ionicons name="wallet" size={24} color={colors.secondary} />
            </View>
            <View style={styles.fareContent}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Hourly Rate</Text>
              <Text style={[styles.fareValue, { color: colors.secondary }]}>
                {driver?.fare_per_hour ? `₹${driver.fare_per_hour}/hr` : 'Not set'}
              </Text>
            </View>
          </View>
        </View>

        {/* Services Section */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Services Offered</Text>
          {editing ? (
            <View style={styles.servicesEditContainer}>
              {SERVICES_LIST.map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.serviceCheckItem,
                      { backgroundColor: isSelected ? `${colors.secondary}10` : colors.background, borderColor: isSelected ? colors.secondary : colors.border }
                    ]}
                    onPress={() => toggleService(service.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.serviceCheckIcon, { backgroundColor: isSelected ? `${colors.secondary}20` : '#F4F6FB' }]}>
                      <Ionicons name={service.icon as any} size={18} color={isSelected ? colors.secondary : colors.textSecondary} />
                    </View>
                    <Text style={[styles.serviceCheckLabel, { color: isSelected ? colors.secondary : colors.text }]}>
                      {service.label}
                    </Text>
                    <View style={[
                      styles.checkbox,
                      { borderColor: isSelected ? colors.secondary : colors.border },
                      isSelected && { backgroundColor: '#E6F0FF' }
                    ]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={colors.secondary} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.servicesContainer}>
              {selectedServices.length > 0 ? (
                selectedServices.map((serviceId, index) => (
                  <View key={index} style={[styles.serviceTag, { backgroundColor: `${colors.secondary}15` }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
                    <Text style={[styles.serviceTagText, { color: colors.secondary }]}>
                      {SERVICE_LABELS[serviceId] || serviceId}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.fieldValue, { color: colors.textSecondary }]}>No services selected</Text>
              )}
            </View>
          )}
        </View>

        {/* Documents Section */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Documents</Text>
          
          <View style={styles.documentRow}>
            <View style={[styles.documentIcon, { backgroundColor: '#F3F4F6' }]}>
              <Ionicons name="card" size={20} color="#6B7280" />
            </View>
            <View style={styles.documentContent}>
              <Text style={[styles.documentLabel, { color: colors.textSecondary }]}>Aadhaar Number</Text>
              <Text style={[styles.documentValue, { color: colors.text }]}>
                {driver?.aadhaar_number ? `••••••${driver.aadhaar_number.slice(-4)}` : 'Not provided'}
              </Text>
            </View>
          </View>

          <View style={styles.documentRow}>
            <View style={[styles.documentIcon, { backgroundColor: '#F3F4F6' }]}>
              <Ionicons name="document-text" size={20} color="#6B7280" />
            </View>
            <View style={styles.documentContent}>
              <Text style={[styles.documentLabel, { color: colors.textSecondary }]}>Driver's Licence</Text>
              <Text style={[styles.documentValue, { color: colors.text }]}>
                {driver?.drivers_licence || 'Not provided'}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
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
  editButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E5E7EB',
  },
  placeholderPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
    gap: 4,
  },
  verificationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
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
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  textAreaLarge: {
    height: 120,
    textAlignVertical: 'top',
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fareIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  fareContent: {
    flex: 1,
  },
  fareValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  serviceTagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  editServicesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  editServicesText: {
    fontSize: 14,
    fontWeight: '600',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentContent: {
    flex: 1,
  },
  documentLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  documentValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  servicesEditContainer: {
    gap: 10,
  },
  serviceCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  serviceCheckIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  serviceCheckLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ActingDriverPersonalDetailsScreen;
