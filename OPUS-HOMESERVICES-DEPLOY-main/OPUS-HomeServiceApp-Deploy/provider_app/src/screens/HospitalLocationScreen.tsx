import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import BackButton from '../components/BackButton';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

interface DoctorDetails {
  id: string;
  doctor_name: string | null;
  email: string | null;
  qualification: string | null;
  doctor_speciality: string | null;
  years_of_experience: number | null;
  avatar_url: string | null;
}

interface HospitalDetails {
  id: string;
  hospital: string | null;
  address: string;
  phone_number: string | null;
}

const HospitalLocationScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [doctorDetails, setDoctorDetails] = useState<DoctorDetails | null>(null);
  const [hospitalDetails, setHospitalDetails] = useState<HospitalDetails | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  // State for editing hospital details
  const [hospitalName, setHospitalName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [tempPhoneNumber, setTempPhoneNumber] = useState('');

  // State for map search
  const [showMapSearch, setShowMapSearch] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 28.6139, // Default to Delhi
    longitude: 77.2090,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [reverseGeocoding, setReverseGeocoding] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch doctor and hospital details from providers_doctor_details table
      const { data: doctorData, error: doctorError } = await supabase
        .from('providers_doctor_details')
        .select('id, doctor_name, email, qualification, doctor_speciality, years_of_experience, avatar_url, hospital, address, phone_number')
        .eq('user_id', user.id)
        .single();
      
      if (doctorError) {
        if (doctorError.code === 'PGRST116') {
          // No record found - this is expected for new users
          console.log('No doctor details found');
          setDoctorDetails(null);
          setHospitalDetails(null);
        } else {
          console.error('Error fetching doctor details:', doctorError);
          Alert.alert('Error', 'Failed to load doctor details');
        }
      } else if (doctorData) {
        // Set doctor details
        setDoctorDetails({
          id: doctorData.id,
          doctor_name: doctorData.doctor_name || null,
          email: doctorData.email || null,
          qualification: doctorData.qualification || null,
          doctor_speciality: doctorData.doctor_speciality || null,
          years_of_experience: doctorData.years_of_experience || null,
          avatar_url: doctorData.avatar_url || null,
        });

        // Set hospital details
        setHospitalDetails({
          id: doctorData.id,
          hospital: doctorData.hospital || null,
          address: doctorData.address || '',
          phone_number: doctorData.phone_number || null,
        });
        
        // Prime structured fields by trying to split the stored address
        const addr = (doctorData.address || '').split(',').map((s: string) => s.trim());
        setAddressLine1(addr[0] || '');
        setAddressLine2(addr[1] || '');
        setCity(addr[2] || '');
        setStateName(addr[3] || '');
        // pincode might be the last token; extract digits
        const pinCandidate = (addr[4] || '').replace(/[^0-9]/g, '');
        setPincode(pinCandidate);
        setHospitalName(doctorData.hospital || '');
        setPhoneNumber(doctorData.phone_number || '');
        setTempPhoneNumber(doctorData.phone_number || '');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditHospitalDetails = () => {
    // Ensure fields are primed from latest details
    const raw = hospitalDetails?.address || '';
    const parts = raw.split(',').map((s: string) => s.trim());
    setAddressLine1(parts[0] || '');
    setAddressLine2(parts[1] || '');
    setCity(parts[2] || '');
    setStateName(parts[3] || '');
    const pin = (parts[4] || '').replace(/[^0-9]/g, '');
    setPincode(pin);
    setHospitalName(hospitalDetails?.hospital || '');
    setPhoneNumber(hospitalDetails?.phone_number || '');
    setShowEditModal(true);
  };

  const handleSavePhoneNumber = async () => {
    if (!user) return;
    
    const cleanedPhone = tempPhoneNumber.replace(/[^0-9]/g, '');
    if (cleanedPhone && !/^[0-9]{10}$/.test(cleanedPhone)) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    try {
      setSavingPhone(true);

      const { error } = await supabase
        .from('providers_doctor_details')
        .update({ phone_number: cleanedPhone || null })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating phone number:', error);
        Alert.alert('Error', 'Failed to update phone number');
        return;
      }

      setPhoneNumber(cleanedPhone || '');
      setEditingPhone(false);
      fetchData(); // Refresh to get updated data
    } catch (error) {
      console.error('Error updating phone number:', error);
      Alert.alert('Error', 'Failed to update phone number');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleCancelPhoneEdit = () => {
    setTempPhoneNumber(phoneNumber);
    setEditingPhone(false);
  };

  // Get user's current location
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use map');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      
      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });

      // Reverse geocode to get address
      await reverseGeocodeLocation(latitude, longitude);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get current location');
    }
  };

  // Reverse geocode location to get address
  const reverseGeocodeLocation = async (latitude: number, longitude: number) => {
    try {
      setReverseGeocoding(true);
      const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (reverseGeocode && reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const formattedAddress = [
          address.streetNumber,
          address.street,
          address.district,
          address.city,
          address.region,
          address.postalCode,
        ].filter(Boolean).join(', ');

        setSelectedLocation({
          latitude,
          longitude,
          address: formattedAddress || `${latitude}, ${longitude}`,
        });

        // Auto-fill address fields
        setAddressLine1(`${address.streetNumber || ''} ${address.street || ''}`.trim() || '');
        setAddressLine2(address.district || '');
        setCity(address.city || '');
        setStateName(address.region || '');
        setPincode(address.postalCode || '');
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      setSelectedLocation({
        latitude,
        longitude,
        address: `${latitude}, ${longitude}`,
      });
    } finally {
      setReverseGeocoding(false);
    }
  };

  // Handle map press to select location
  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    reverseGeocodeLocation(latitude, longitude);
  };

  // Handle marker drag end
  const handleMarkerDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    reverseGeocodeLocation(latitude, longitude);
  };

  // Get current location when map search opens
  useEffect(() => {
    if (showMapSearch) {
      getCurrentLocation();
    }
  }, [showMapSearch]);

  const handleSaveHospitalDetails = async () => {
    if (!user) return;
    if (!addressLine1.trim()) {
      Alert.alert('Validation Error', 'Address Line 1 is required');
      return;
    }
    if (!city.trim() || !stateName.trim()) {
      Alert.alert('Validation Error', 'City and State are required');
      return;
    }
    if (pincode && !/^\d{6}$/.test(pincode)) {
      Alert.alert('Validation Error', 'Please enter a valid 6-digit pincode');
      return;
    }
    if (phoneNumber && !/^[0-9]{10}$/.test(phoneNumber.replace(/[^0-9]/g, ''))) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    const composedAddress = [addressLine1, addressLine2, city, stateName, pincode]
      .filter(Boolean)
      .join(', ');

    try {
      setSaving(true);

      // Update providers_doctor_details table
      const updateData: any = {
        address: composedAddress,
      };

      if (hospitalName.trim()) {
        updateData.hospital = hospitalName.trim();
      }

      if (phoneNumber.trim()) {
        updateData.phone_number = phoneNumber.trim().replace(/[^0-9]/g, '');
      }

      const { error } = await supabase
        .from('providers_doctor_details')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating hospital details:', error);
        Alert.alert('Error', 'Failed to update hospital details');
        return;
      }

      Alert.alert('Success', 'Hospital details updated successfully!');
      setShowEditModal(false);
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error updating hospital details:', error);
      Alert.alert('Error', 'Failed to update hospital details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading hospital details...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <BackButton color={colors.text} />
        <Text style={[styles.title, { color: colors.text }]}>Hospital Location</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Doctor Details Card */}
        {doctorDetails && (
          <View style={[styles.doctorCard, { backgroundColor: colors.card }]}> 
            <View style={styles.doctorHeader}>
              {doctorDetails.avatar_url ? (
                <Image 
                  source={{ uri: doctorDetails.avatar_url }} 
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.background }]}>
                  <Ionicons name="person-circle" size={32} color={colors.primary} />
                </View>
              )}
              <View style={styles.doctorInfo}>
                <Text style={[styles.doctorName, { color: colors.text }]}> 
                  {doctorDetails.doctor_name || 'Doctor Name Not Set'}
                </Text>
                {doctorDetails.qualification && (
                  <Text style={[styles.doctorQualification, { color: colors.textSecondary }]}> 
                    {doctorDetails.qualification}
                  </Text>
                )}
                {doctorDetails.doctor_speciality && (
                  <Text style={[styles.doctorSpeciality, { color: colors.textSecondary }]}> 
                    {typeof doctorDetails.doctor_speciality === 'string' 
                      ? doctorDetails.doctor_speciality.split(',').map(s => s.trim()).join(', ')
                      : doctorDetails.doctor_speciality}
                  </Text>
                )}
                {doctorDetails.years_of_experience !== null && doctorDetails.years_of_experience !== undefined && (
                  <View style={styles.experienceRow}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.experienceText, { color: colors.textSecondary }]}> 
                      {doctorDetails.years_of_experience} {doctorDetails.years_of_experience === 1 ? 'year' : 'years'} of experience
                    </Text>
                  </View>
                )}
                {doctorDetails.email && (
                  <View style={styles.emailRow}>
                    <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.emailText, { color: colors.textSecondary }]}> 
                      {doctorDetails.email}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Hospital Section Title */}
        {hospitalDetails && (
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Hospital Information</Text>
        )}

        {/* Hospital Name Card */}
        {hospitalDetails && (
          <View style={[styles.hospitalCard, { backgroundColor: colors.card }]}> 
            <View style={styles.hospitalHeader}>
              <Ionicons name="medical" size={24} color={colors.primary} />
              <View style={styles.hospitalInfo}>
                <Text style={[styles.hospitalName, { color: colors.text }]}> 
                  {hospitalDetails.hospital || 'Hospital Name Not Set'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Hospital Phone Card - Editable */}
        {hospitalDetails && (
          <View style={[styles.phoneCard, { backgroundColor: colors.card }]}> 
            <View style={styles.phoneHeader}>
              <Ionicons name="call-outline" size={20} color={colors.primary} />
              <Text style={[styles.phoneLabel, { color: colors.text }]}>Hospital Phone</Text>
            </View>
            {editingPhone ? (
              <View style={styles.phoneEditContainer}>
                <TextInput
                  style={[styles.phoneInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="10-digit phone number"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                  value={tempPhoneNumber}
                  onChangeText={(v) => setTempPhoneNumber(v.replace(/[^0-9]/g, '').slice(0, 10))}
                  autoFocus
                />
                <View style={styles.phoneEditButtons}>
                  <TouchableOpacity
                    style={[styles.phoneButton, styles.cancelButton, { borderColor: colors.border }]}
                    onPress={handleCancelPhoneEdit}
                    disabled={savingPhone}
                  >
                    <Text style={[styles.phoneButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.phoneButton, styles.savePhoneButton, { backgroundColor: colors.primary }]}
                    onPress={handleSavePhoneNumber}
                    disabled={savingPhone}
                  >
                    {savingPhone ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.phoneButtonText, { color: '#fff' }]}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.phoneDisplayContainer}>
                <Text style={[styles.phoneDisplayText, { color: colors.textSecondary }]}> 
                  {phoneNumber || 'No phone number added'}
                </Text>
                <TouchableOpacity
                  style={styles.editPhoneButton}
                  onPress={() => {
                    setTempPhoneNumber(phoneNumber);
                    setEditingPhone(true);
                  }}
                >
                  <Ionicons name="pencil" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Hospital Address Section Title */}
        {hospitalDetails && (
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Hospital Address</Text>
        )}

        {/* Hospital Address Card - Separate Section */}
        {hospitalDetails && (
          <View style={[styles.addressCard, { backgroundColor: colors.card }]}> 
            <TouchableOpacity
              style={[styles.editAddressButtonAbsolute, styles.editAddressButton, { borderColor: colors.primary }]}
              onPress={handleEditHospitalDetails}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={16} color={colors.primary} />
              <Text style={[styles.editAddressText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <Text style={[styles.addressText, { color: colors.textSecondary }]}> 
              {hospitalDetails.address || 'No address added yet'}
            </Text>
          </View>
        )}

        {/* Show message if no doctor/hospital details found */}
        {!doctorDetails && !hospitalDetails && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Ionicons name="medical-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No doctor details found
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Please complete your doctor profile to add hospital information
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleEditHospitalDetails}
            >
              <Text style={styles.addButtonText}>Add Hospital Details</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* Edit Hospital Details Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Hospital Details</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Hospital Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter hospital name"
                placeholderTextColor={colors.textSecondary}
                value={hospitalName}
                onChangeText={setHospitalName}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Phone Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="10-digit phone number"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={(v) => setPhoneNumber(v.replace(/[^0-9]/g, '').slice(0, 10))}
              />

              {/* Map Search Button */}
              <TouchableOpacity
                style={[styles.mapSearchButton, { backgroundColor: colors.background, borderColor: colors.primary }]}
                onPress={() => {
                  setShowMapSearch(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="map-outline" size={20} color={colors.primary} />
                <Text style={[styles.mapSearchButtonText, { color: colors.primary }]}>
                  Select Location on Map
                </Text>
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { color: colors.text, marginTop: 16 }]}>Address Line 1 *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="House/Flat, Street"
                placeholderTextColor={colors.textSecondary}
                value={addressLine1}
                onChangeText={setAddressLine1}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Address Line 2</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Area, Landmark"
                placeholderTextColor={colors.textSecondary}
                value={addressLine2}
                onChangeText={setAddressLine2}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>City *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="City"
                placeholderTextColor={colors.textSecondary}
                value={city}
                onChangeText={setCity}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>State *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="State"
                placeholderTextColor={colors.textSecondary}
                value={stateName}
                onChangeText={setStateName}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Pincode</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="6-digit pincode"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={pincode}
                onChangeText={(v) => setPincode(v.replace(/[^0-9]/g, '').slice(0,6))}
              />

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveHospitalDetails}
                disabled={saving}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#004c8f', '#0c1a5d']}
                  style={styles.saveButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Details</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Map Search Modal */}
      <Modal
        visible={showMapSearch}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowMapSearch(false);
        }}
      >
        <View style={styles.mapModalOverlay}>
          <View style={[styles.mapModalContainer, { backgroundColor: colors.card }]}>
            <View style={[styles.mapModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.mapModalTitle, { color: colors.text }]}>Select Hospital Location</Text>
              <TouchableOpacity onPress={() => {
                setShowMapSearch(false);
              }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.mapSearchContent}>
              {/* Instructions */}
              <View style={[styles.mapInstructions, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.mapInstructionsText, { color: colors.textSecondary }]}>
                  Drag the marker or tap on the map to select your hospital location
                </Text>
              </View>

              {/* Map View */}
              <View style={styles.mapContainer}>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.map}
                  region={mapRegion}
                  onPress={handleMapPress}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                  showsCompass={true}
                  showsScale={true}
                  mapType="standard"
                  zoomEnabled={true}
                  scrollEnabled={true}
                  pitchEnabled={true}
                  rotateEnabled={true}
                >
                  {selectedLocation && (
                    <Marker
                      coordinate={{
                        latitude: selectedLocation.latitude,
                        longitude: selectedLocation.longitude,
                      }}
                      title="Selected Location"
                      description={selectedLocation.address}
                      draggable={true}
                      onDragEnd={handleMarkerDragEnd}
                    />
                  )}
                </MapView>
                {reverseGeocoding && (
                  <View style={styles.mapLoadingOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.mapLoadingText, { color: colors.text }]}>Getting address...</Text>
                  </View>
                )}
              </View>

              {/* Selected Location Info */}
              {selectedLocation && (
                <View style={[styles.selectedLocationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="location" size={20} color={colors.primary} />
                  <View style={styles.selectedLocationTextContainer}>
                    <Text style={[styles.selectedLocationLabel, { color: colors.textSecondary }]}>Selected Address:</Text>
                    <Text style={[styles.selectedLocationText, { color: colors.text }]} numberOfLines={2}>
                      {selectedLocation.address}
                    </Text>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.mapActionButtons}>
                <TouchableOpacity
                  style={[styles.mapActionButton, styles.getLocationButton, { backgroundColor: colors.background, borderColor: colors.primary }]}
                  onPress={getCurrentLocation}
                  activeOpacity={0.7}
                >
                  <Ionicons name="locate-outline" size={20} color={colors.primary} />
                  <Text style={[styles.mapActionButtonText, { color: colors.primary }]}>Use My Location</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mapActionButton, styles.useLocationButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setShowMapSearch(false);
                  }}
                  disabled={!selectedLocation}
                  activeOpacity={0.7}
                >
                  <Text style={styles.useLocationButtonText}>Use This Location</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  doctorCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  doctorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorInfo: {
    marginLeft: 12,
    flex: 1,
  },
  doctorName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  doctorQualification: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  doctorSpeciality: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  experienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  experienceText: {
    fontSize: 13,
    color: '#666',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  emailText: {
    fontSize: 13,
    color: '#666',
  },
  hospitalCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  phoneCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  phoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  phoneLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  phoneDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneDisplayText: {
    fontSize: 14,
    flex: 1,
  },
  editPhoneButton: {
    padding: 4,
  },
  phoneEditContainer: {
    gap: 12,
  },
  phoneInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  phoneEditButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  phoneButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  savePhoneButton: {
    backgroundColor: '#004c8f',
  },
  phoneButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addressCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  emptyCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hospitalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  hospitalInfo: {
    marginLeft: 12,
    flex: 1,
  },
  hospitalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#666',
  },
  editAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#004c8f',
  },
  editAddressButtonAbsolute: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },
  editAddressText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#004c8f',
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    paddingRight: 96, // keep text clear of the edit button
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    marginTop: 24,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  mapSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginTop: 8,
  },
  mapSearchButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mapModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  mapSearchContent: {
    flex: 1,
    padding: 16,
  },
  mapInstructions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  mapInstructionsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  mapContainer: {
    height: Dimensions.get('window').height * 0.5,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  mapLoadingText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedLocationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  selectedLocationTextContainer: {
    flex: 1,
  },
  selectedLocationLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  selectedLocationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mapActionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  mapActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  getLocationButton: {
    borderWidth: 1,
  },
  mapActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  useLocationButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  useLocationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HospitalLocationScreen;

