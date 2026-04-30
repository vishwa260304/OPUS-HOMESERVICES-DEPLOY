import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Switch, Alert, Image, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';
import * as ImagePicker from 'expo-image-picker';
import { addEmployee, getSelectedSector } from '../utils/appState';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
// Use expo-file-system legacy API to avoid deprecation warnings
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FileSystem: any = require('expo-file-system/legacy');
// Provide Buffer for base64 fallback when atob is unavailable
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Buffer: any;

const AddNewEmployeeScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    address: '',
    experienceYears: '',
    isActive: true,
    photo: null as string | null,
  });
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState('');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState<number | null>(null);

  // Check if all mandatory fields are filled
  const isFormValid = () => {
    return formData.fullName.trim() !== '' &&
      formData.phoneNumber.trim() !== '' &&
      selectedRole !== '' &&
      formData.photo !== null &&
      formData.experienceYears.trim() !== '' &&
      formData.address.trim() !== '';
  };

  // Convert base64 string to Uint8Array for Supabase upload
  const base64ToUint8Array = (base64: string) => {
    const binaryString = (globalThis as any).atob ? (globalThis as any).atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const roles = [
    'AC Technician',
    'Acting Driver: Corporate Driver',
    'Acting Driver: Hourly Hire',
    'Acting Driver: Long-Distance Support',
    'Acting Driver: Pick-up & Drop',
    'Acting Driver: Trip-based',
    'Advanced Diagnosis: Ambulatory BP Monitoring',
    'Advanced Diagnosis: ECG at home',
    'Advanced Diagnosis: Holter Monitoring',
    'Advanced Diagnosis: Sleep Study',
    'Advanced Diagnosis: X-ray at home',
    'Appliance: AC Gas Filling/Cooling',
    'Appliance: AC Installation & Service',
    'Appliance: Chimney/Exhaust Cleaning',
    'Appliance: Dishwasher Service',
    'Appliance: Dryer Repair',
    'Appliance: Fan/Cooler Repair',
    'Appliance: Gas Stove & Hob Repair',
    'Appliance: Heater & Geyser Repair',
    'Appliance: Installation (Fridge/AC/TV/Washing Machine)',
    'Appliance: Inverter & UPS Service',
    'Appliance: Microwave Oven Repair',
    'Appliance: Refrigerator Repair',
    'Appliance: TV Repair (LED/LCD/Smart)',
    'Appliance: Uninstallation/Relocation',
    'Appliance: Washing Machine Repair',
    'Appliance: Water Cooler Service',
    'Bike Body: Dent Removal',
    'Bike Body: Frame/Panel Repair',
    'Bike Body: Scratch Repair & Painting',
    'Bike Clean: Wash & Chain Cleaning',
    'Bike Detail: Polishing & Waxing',
    'Bike Detail: Seat/Interior Cleaning',
    'Bike Repair: Battery Service',
    'Bike Repair: Brake Service',
    'Bike Repair: Electrical Wiring',
    'Bike Repair: Engine Diagnostics/Repair',
    'Bike Repair: Gearbox Repair/Replacement',
    'Bike Repair: Headlight/Indicator Service',
    'Bike Repair: Oil Change',
    'Bike Repair: Spark Plug Replacement',
    'Bike Repair: Starter Motor Repair',
    'Bike Repair: Suspension & Steering',
    'Bike Tyres: Balancing & Alignment',
    'Bike Tyres: New Tire Installation',
    'Bike Tyres: Puncture Repair',
    'Carpenter',
    'Car Body: Bumper Repair',
    'Car Body: Dent Removal',
    'Car Body: Scratch Repair & Painting',
    'Car Body: Windshield/Glass Replacement',
    'Car Clean: Deep Interior Cleaning',
    'Car Clean: Wash Interior/Exterior',
    'Car Detail: Ceramic Coating',
    'Car Detail: Polishing & Waxing',
    'Car Repair: AC Service',
    'Car Repair: Alternator/Starter Repair',
    'Car Repair: Battery Service',
    'Car Repair: Brake Service',
    'Car Repair: Electrical Wiring',
    'Car Repair: Engine Diagnostics/Repair',
    'Car Repair: Heating/Cooling System',
    'Car Repair: Oil Change',
    'Car Repair: Spark Plug Replacement',
    'Car Repair: Suspension & Steering',
    'Car Repair: Transmission Repair/Replacement',
    'Car Tyres: Alloy Wheel Restoration',
    'Car Tyres: New Tire Installation',
    'Car Tyres: Tire Puncture Repair',
    'Car Tyres: Wheel Alignment',
    'Cleaning Staff',
    'Diagnostics: Arterial blood gases',
    'Diagnostics: Blood sugar level',
    'Diagnostics: Cardiac markers',
    'Diagnostics: Complete blood picture',
    'Diagnostics: Hb A1C levels',
    'Diagnostics: Kidney function test',
    'Diagnostics: Lipid Profile Screening',
    'Diagnostics: Liver Function Test',
    'Diagnostics: Serum Electrolytes',
    'Diagnostics: Thyroid Function Test',
    'Diagnostics: Thyroid Screening',
    'Diagnostics: Urine analysis',
    'Driver',
    'Electrician',
    'Electrician Services',
    'Cleaner/Pest Control',
    'Painter',
    'Pet Groomer',
    'Pet Trainer',

    'Physiotherapy: Cardiopulmonary',
    'Physiotherapy: Geriatric',
    'Physiotherapy: Musculoskeletal/Orthopedic',
    'Physiotherapy: Neurological',
    'Physiotherapy: Pediatric',
    'Plumber',
    'Renovation: Minor Home Renovations',
    'Renovation: Modular Kitchen',
    'Renovation: Waterproofing',
    'Salon (Men): Beard Grooming/Trimming',
    'Salon (Men): Facial & Cleanup',
    'Salon (Men): Hair Coloring',
    'Salon (Men): Haircut & Styling',
    'Salon (Men): Head Massage',
    'Salon (Women): Bridal Makeup',
    'Salon (Women): Facial & Cleanup',
    'Salon (Women): Hair Coloring & Highlights',
    'Salon (Women): Haircut & Styling',
    'Salon (Women): Manicure & Pedicure',
    'Salon (Women): Waxing & Threading',
    'Security Guard',
    'Spa/Unisex',
    'Spa/Unisex: Hair Spa & Treatments',
    'Spa/Unisex: Relaxation Therapies',
    'Spa/Unisex: Skin Care Packages',
  ];

  // Sector-based role filtering using selected sector from login/selection
  // Updated to match the service categories from AddNewServiceScreen
  const selectedSectorKey = (getSelectedSector?.() as 'home' | 'healthcare' | 'appliance' | 'automobile' | 'salon' | 'pet') || 'home';

  // Debug logging to see what sector is being used
  console.log('Selected sector for role filtering:', selectedSectorKey);

  // Helper function to get display name for sectors
  const getSectorDisplayName = (sector: string) => {
    const sectorNames: Record<string, string> = {
      'home': 'Home',
      'healthcare': 'Healthcare',
      'appliance': 'Appliance',
      'automobile': 'Automobile',
      'salon': 'Salon & Spa',
      'pet': 'Pet Care'
    };
    return sectorNames[sector] || sector.charAt(0).toUpperCase() + sector.slice(1);
  };

  const isRoleForSector = (role: string, sector: 'home' | 'healthcare' | 'appliance' | 'automobile' | 'salon' | 'pet') => {
    const r = role.toLowerCase();
    switch (sector) {
      case 'home':

        return (
          r === 'cleaner/pest control' ||
          r === 'electrician services' ||
          r === 'carpenter' ||
          r === 'plumber' ||
          r === 'painter' ||
          r === 'salon (women): haircut & styling' ||
          r === 'salon (men): haircut & styling' ||
          r === 'spa/unisex' ||
          r === 'pet groomer' ||
          r === 'pet trainer' ||
          r === 'pet trainer'

        );
      case 'healthcare':
        return (
          r.startsWith('diagnostics:') ||
          r.startsWith('health checkup:') ||
          r.startsWith('physiotherapy:') ||
          r.startsWith('advanced diagnosis:')
        );
      case 'appliance':
        return (
          r.startsWith('appliance:') ||
          r === 'ac technician'
        );
      case 'automobile':
        return (
          r.startsWith('car ') ||
          r.startsWith('bike ') ||
          r.startsWith('car tyres:') ||
          r.startsWith('bike tyres:') ||
          r.startsWith('car body:') ||
          r.startsWith('bike body:') ||
          r.startsWith('car detail:') ||
          r.startsWith('bike detail:') ||
          r.startsWith('car repair:') ||
          r.startsWith('bike repair:') ||
          r.startsWith('car clean:') ||
          r.startsWith('bike clean:') ||
          r.startsWith('acting driver') ||
          r === 'driver'
        );
      case 'salon':
        return (
          r.startsWith('salon (men):') ||
          r.startsWith('salon (women):') ||
          r.startsWith('spa/unisex:')
        );
      case 'pet':
        return (
          r.startsWith('pet grooming:') ||
          r.startsWith('pet health:') ||
          r.startsWith('pet boarding:') ||
          r.startsWith('pet sitting:') ||
          r.startsWith('pet training:') ||
          r.startsWith('pet walking:') ||
          r.startsWith('pet daycare:')
        );
      default:
        return true;
    }
  };

  const sectorFilteredRoles = roles.filter(role => isRoleForSector(role, selectedSectorKey));
  const baseRoles = sectorFilteredRoles.length > 0 ? sectorFilteredRoles : roles;
  const filteredRoles = baseRoles.filter(r => r.toLowerCase().includes(roleSearchQuery.trim().toLowerCase()));

  // Debug logging to see role filtering results
  console.log('Total roles:', roles.length);
  console.log('Sector filtered roles:', sectorFilteredRoles.length);
  console.log('Final filtered roles:', filteredRoles.length);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert('Permission needed', 'Camera and photo library permissions are required.');
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const ok = await requestPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (!result.canceled) { setFormData(prev => ({ ...prev, photo: result.assets[0].uri })); setShowPhotoModal(false); }
  };

  const pickFromGallery = async () => {
    const ok = await requestPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (!result.canceled) { setFormData(prev => ({ ...prev, photo: result.assets[0].uri })); setShowPhotoModal(false); }
  };

  const handleSave = async () => {
    if (!formData.fullName || !formData.phoneNumber || !selectedRole || !formData.photo || !formData.experienceYears || !formData.address) {
      Alert.alert('Missing Information', 'Please fill in all mandatory fields: full name, phone number, role, profile photo, experience, and address.');
      return;
    }
    if (formData.experienceYears && isNaN(Number(formData.experienceYears))) {
      Alert.alert('Invalid Input', 'Experience must be a number.');
      return;
    }
    try {
      if (!user?.id) {
        Alert.alert('Not logged in', 'Please log in again.');
        return;
      }

      // Fetch company verification to get company_id
      const { data: verification, error: verErr } = await api.companyVerification.getCompanyVerification(user.id);
      if (verErr) {
        console.warn('Error fetching company verification:', verErr.message);
      }
      const companyId = verification?.id || null;

      // Upload photo to Supabase Storage bucket: profile-images/employee-profile-photos
      let uploadedPhotoUrl: string | null = null;
      try {
        if (formData.photo) {
          const photoUri = formData.photo;
          const base64Data = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' });
          const bytes = base64ToUint8Array(base64Data);
          const arrayBuffer = bytes.buffer as ArrayBuffer;
          const fileName = `employee-profile-photos/${user.id}-${Date.now()}.jpg`;

          // Try uploading with a simpler approach
          const { data: uploadData, error: uploadError } = await api.supabase.storage
            .from('profile-images')
            .upload(fileName, arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: true
            });

          if (uploadError) {
            console.warn('Image upload failed:', uploadError.message);
            // Don't show alert for now, just log the error
            uploadedPhotoUrl = null;
          } else if (uploadData?.path) {
            const { data: pub } = api.supabase.storage.from('profile-images').getPublicUrl(uploadData.path);
            uploadedPhotoUrl = pub?.publicUrl || null;
          }
        }
      } catch (e) {
        console.warn('Image upload exception:', (e as any)?.message || e);
        uploadedPhotoUrl = null;
      }

      const payload = {
        provider_id: user.id,
        company_id: companyId,
        name: formData.fullName,
        role: selectedRole,
        phone: `+91 ${formData.phoneNumber}`,
        email: formData.email || undefined,
        experience_years: formData.experienceYears ? Math.max(0, Number(formData.experienceYears)) : undefined,
        status: formData.isActive ? 'active' : 'inactive',
        photo: uploadedPhotoUrl || null,
        avatar: formData.photo ? null : (formData.fullName ? formData.fullName.split(' ').map(n => n[0]).join('').toUpperCase() : null),
        address: formData.address || null,
      } as const;
      if (isEdit && editEmployeeId) {
        const updates: any = { ...payload };
        const { data, error } = await api.employees.updateEmployee(editEmployeeId, updates);
        if (error) {
          Alert.alert('Error', error.message || 'Failed to update employee');
          return;
        }
        Alert.alert('Success', 'Employee updated successfully!', [{ text: 'OK', onPress: () => (navigation as any).goBack() }]);
      } else {
        const { data, error } = await api.employees.createEmployee(payload as any);
        if (error) {
          Alert.alert('Error', error.message || 'Failed to save employee');
          return;
        }
        // Optionally mirror to local UI state store
        addEmployee({
          name: formData.fullName,
          role: selectedRole,
          phone: `+91 ${formData.phoneNumber}`,
          email: formData.email,
          experience_years: formData.experienceYears ? Math.max(0, Number(formData.experienceYears)) : undefined,
          status: formData.isActive ? 'active' : 'inactive',
          photo: formData.photo,
          avatar: formData.photo ? null : (formData.fullName ? formData.fullName.split(' ').map(n => n[0]).join('').toUpperCase() : null),
        });
        Alert.alert('Success', 'Employee added successfully!', [{ text: 'OK', onPress: () => (navigation as any).navigate('YourEmployees') }]);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save employee');
    }
  };

  // Prefill in edit mode
  React.useEffect(() => {
    const id = route?.params?.editEmployeeId as number | undefined;
    if (!id) return;
    setIsEdit(true);
    setEditEmployeeId(id);
    (async () => {
      try {
        const { data, error } = await api.employees.getEmployee(id);
        if (!error && data) {
          const e: any = data;
          setFormData({
            fullName: e.name || '',
            phoneNumber: (e.phone || '').replace(/^\+91\s*/, ''),
            email: e.email || '',
            address: e.address || '',
            experienceYears: typeof e.experience_years === 'number' ? String(e.experience_years) : '',
            isActive: e.status === 'active',
            photo: e.photo || null,
          });
          setSelectedRole(e.role || '');
        }
      } catch { }
    })();
  }, [route?.params]);

  return (
    <View style={[styles.plainBg, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => (navigation as any).goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={moderateScale(22)} color="#000000" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: '#000000', textAlign: 'center' }]}>Add new employee</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <View style={styles.photoSection}>
                <Text style={[styles.label, { color: '#000000', textAlign: 'center', marginBottom: moderateScale(12) }]}>Profile Photo *</Text>
                <TouchableOpacity style={styles.photoContainer} onPress={() => setShowPhotoModal(true)} activeOpacity={0.8}>
                  {formData.photo ? (<Image source={{ uri: formData.photo }} style={styles.photo} />) : (<Ionicons name="camera" size={moderateScale(32)} color="#000000" />)}
                  <View style={styles.photoAddIcon}><Ionicons name="add" size={moderateScale(16)} color="#ffffff" /></View>
                </TouchableOpacity>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={[styles.label, { color: '#000000' }]}>Full Name *</Text>
                <TextInput style={[styles.input, { color: '#000000' }]} placeholder="Enter partner's full name" placeholderTextColor="#8E9BB9" value={formData.fullName} onChangeText={t => setFormData(p => ({ ...p, fullName: t }))} />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={[styles.label, { color: '#000000' }]}>Phone Number *</Text>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryCode}><Text style={[styles.countryCodeText, { color: '#000000' }]}>+91</Text></View>
                  <TextInput style={[styles.phoneInput, { color: '#000000' }]} placeholder="Enter phone number" placeholderTextColor="#8E9BB9" keyboardType="phone-pad" value={formData.phoneNumber} onChangeText={t => setFormData(p => ({ ...p, phoneNumber: t }))} />
                </View>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={[styles.label, { color: '#000000' }]}>Email ID (Optional)</Text>
                <TextInput style={[styles.input, { color: '#000000' }]} placeholder="Enter email address" placeholderTextColor="#8E9BB9" autoCapitalize="none" keyboardType="email-address" value={formData.email} onChangeText={t => setFormData(p => ({ ...p, email: t }))} />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={[styles.label, { color: '#000000' }]}>Experience (years) *</Text>
                <TextInput
                  style={[styles.input, { color: '#000000' }]}
                  placeholder="Enter years of experience"
                  placeholderTextColor="#8E9BB9"
                  keyboardType="number-pad"
                  value={formData.experienceYears}
                  onChangeText={t => setFormData(p => ({ ...p, experienceYears: t }))}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={[styles.label, { color: '#000000' }]}>Partner Role *</Text>
                <Text style={[styles.sectorInfo, { color: '#666' }]}>
                  Showing roles for: {getSectorDisplayName(selectedSectorKey)} Services
                </Text>
                <TouchableOpacity style={styles.dropdownContainer} onPress={() => setShowRoleDropdown(!showRoleDropdown)} activeOpacity={0.8}>
                  <Text style={[styles.dropdownText, { color: '#000000' }, !selectedRole && styles.placeholderText]}>{selectedRole || 'Select partner role'}</Text>
                  <Ionicons name="chevron-down" size={moderateScale(20)} color="#8E9BB9" />
                </TouchableOpacity>
                {showRoleDropdown && (
                  <View style={styles.dropdown}>
                    <View style={styles.dropdownSearchWrap}>
                      <Ionicons name="search" size={moderateScale(16)} color="#000000" />
                      <TextInput
                        style={[styles.dropdownSearch, { color: '#000000' }]}
                        placeholder="Search roles..."
                        placeholderTextColor="#8E9BB9"
                        value={roleSearchQuery}
                        onChangeText={setRoleSearchQuery}
                      />
                    </View>
                    <ScrollView style={{ maxHeight: moderateScale(320) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                      {filteredRoles.map(role => (
                        <TouchableOpacity key={role} style={styles.dropdownItem} onPress={() => { setSelectedRole(role); setShowRoleDropdown(false); }} activeOpacity={0.8}>
                          <Text style={[styles.dropdownItemText, { color: '#000000' }]}>{role}</Text>
                        </TouchableOpacity>
                      ))}
                      {filteredRoles.length === 0 && (
                        <View style={styles.dropdownItem}><Text style={[styles.dropdownItemText, { color: '#00000080' }]}>No matches</Text></View>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.fieldContainer}>
                <Text style={[styles.label, { color: '#000000' }]}>Address *</Text>
                <View style={styles.addressInputContainer}>
                  <TextInput style={[styles.addressInput, { color: '#000000' }]} placeholder="Enter address" placeholderTextColor="#8E9BB9" value={formData.address} onChangeText={t => setFormData(p => ({ ...p, address: t }))} multiline />
                  <Ionicons name="location" size={moderateScale(20)} color="#000000" />
                </View>
              </View>

              <View style={styles.availabilityCard}>
                <View style={styles.availabilityHeader}>
                  <Text style={styles.availabilityTitle}>Active Status</Text>
                  <Text style={styles.availabilitySubtitle}>Partner will be available for assignments</Text>
                </View>
                <Switch value={formData.isActive} onValueChange={v => setFormData(p => ({ ...p, isActive: v }))} trackColor={{ false: '#E0E0E0', true: '#004c8f' }} thumbColor={'#ffffff'} />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, !isFormValid() && styles.saveBtnDisabled]}
                onPress={handleSave}
                activeOpacity={0.8}
                disabled={!isFormValid()}
              >
                <Text style={[styles.saveBtnText, !isFormValid() && styles.saveBtnTextDisabled]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => (navigation as any).goBack()} activeOpacity={0.8}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={showPhotoModal} transparent animationType="fade" onRequestClose={() => setShowPhotoModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Photo</Text>
              <Text style={styles.modalSubtitle}>Choose how you want to add a photo</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalButton} onPress={takePhoto} activeOpacity={0.8}>
                  <View style={styles.modalButtonIcon}><Ionicons name="camera" size={moderateScale(24)} color="#000000" /></View>
                  <Text style={styles.modalButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalButton} onPress={pickFromGallery} activeOpacity={0.8}>
                  <View style={styles.modalButtonIcon}><Ionicons name="images" size={moderateScale(24)} color="#000000" /></View>
                  <Text style={styles.modalButtonText}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowPhotoModal(false)} activeOpacity={0.8}>
                <Text style={[styles.modalCancelText, { color: '#000000' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView >
    </View >
  );
};

const styles = StyleSheet.create({
  plainBg: { flex: 1 },
  container: { flex: 1, padding: moderateScale(20) },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(20), position: 'relative', justifyContent: 'center' },
  backBtn: { position: 'absolute', left: 0, padding: moderateScale(4) },
  headerTitle: { fontWeight: '800', fontSize: moderateScale(20), flex: 0, color: '#000000' },
  scrollContent: { paddingBottom: moderateScale(100) },
  card: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(20) },
  photoSection: { alignItems: 'center', marginBottom: moderateScale(24) },
  photoContainer: { width: moderateScale(100), height: moderateScale(100), borderRadius: moderateScale(50), backgroundColor: '#F4F6FB', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  photo: { width: moderateScale(100), height: moderateScale(100), borderRadius: moderateScale(50) },
  photoAddIcon: { position: 'absolute', bottom: 0, right: 0, width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: '#004c8f', alignItems: 'center', justifyContent: 'center' },
  fieldContainer: { marginBottom: moderateScale(20) },
  label: { color: '#0b1960', fontWeight: '600', fontSize: moderateScale(16), marginBottom: moderateScale(8) },
  sectorInfo: { color: '#666', fontSize: moderateScale(12), marginBottom: moderateScale(8), fontStyle: 'italic' },
  input: { height: moderateScale(48), borderRadius: moderateScale(12), backgroundColor: '#F4F6FB', paddingHorizontal: moderateScale(12), color: '#000000', borderWidth: 1, borderColor: '#E6ECFF' },
  phoneInputContainer: { flexDirection: 'row' },
  countryCode: { height: moderateScale(48), backgroundColor: '#F4F6FB', borderTopLeftRadius: moderateScale(12), borderBottomLeftRadius: moderateScale(12), borderWidth: 1, borderColor: '#E6ECFF', borderRightWidth: 0, paddingHorizontal: moderateScale(12), justifyContent: 'center' },
  countryCodeText: { color: '#0b1960', fontWeight: '600' },
  phoneInput: { flex: 1, height: moderateScale(48), backgroundColor: '#F4F6FB', borderTopRightRadius: moderateScale(12), borderBottomRightRadius: moderateScale(12), borderWidth: 1, borderColor: '#E6ECFF', paddingHorizontal: moderateScale(12), color: '#000000' },
  dropdownContainer: { height: moderateScale(48), borderRadius: moderateScale(12), backgroundColor: '#F4F6FB', borderWidth: 1, borderColor: '#E6ECFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: moderateScale(12) },
  dropdownText: { color: '#000000', fontSize: moderateScale(16) },
  placeholderText: { color: '#8E9BB9' },
  dropdown: { backgroundColor: '#ffffff', borderRadius: moderateScale(12), borderWidth: 1, borderColor: '#E6ECFF', marginTop: moderateScale(8), maxHeight: moderateScale(340), elevation: 6, shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, overflow: 'hidden' },
  dropdownSearchWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(8), borderBottomWidth: 1, borderBottomColor: '#F0F0F0', backgroundColor: '#F9FAFF' },
  dropdownSearch: { flex: 1, marginLeft: moderateScale(8), color: '#000000' },
  dropdownItem: { padding: moderateScale(12), borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  dropdownItemText: { color: '#0b1960', fontSize: moderateScale(16) },
  addressInputContainer: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F4F6FB', borderRadius: moderateScale(12), borderWidth: 1, borderColor: '#E6ECFF', paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(12) },
  addressInput: { flex: 1, color: '#000000', fontSize: moderateScale(16), minHeight: moderateScale(40), textAlignVertical: 'top' },
  availabilityCard: { backgroundColor: '#F8F9FA', borderRadius: moderateScale(12), padding: moderateScale(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: moderateScale(24) },
  availabilityHeader: { flex: 1 },
  availabilityTitle: { color: '#0b1960', fontWeight: '700', fontSize: moderateScale(16), marginBottom: moderateScale(4) },
  availabilitySubtitle: { color: '#666', fontSize: moderateScale(14) },
  saveBtn: { backgroundColor: '#004c8f', borderRadius: moderateScale(12), paddingVertical: moderateScale(16), alignItems: 'center', marginBottom: moderateScale(12) },
  saveBtnDisabled: { backgroundColor: '#E0E0E0', opacity: 0.6 },
  saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: moderateScale(16) },
  saveBtnTextDisabled: { color: '#999999' },
  cancelBtn: { backgroundColor: '#ffffff', borderRadius: moderateScale(12), paddingVertical: moderateScale(16), alignItems: 'center', borderWidth: 1, borderColor: '#E6ECFF' },
  cancelBtnText: { color: '#666', fontWeight: '600', fontSize: moderateScale(16) },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(24), width: '85%', maxWidth: moderateScale(300) },
  modalTitle: { color: '#0b1960', fontWeight: '800', fontSize: moderateScale(20), textAlign: 'center', marginBottom: moderateScale(8) },
  modalSubtitle: { color: '#666', fontSize: moderateScale(14), textAlign: 'center', marginBottom: moderateScale(24) },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: moderateScale(20) },
  modalButton: { alignItems: 'center', flex: 1, marginHorizontal: moderateScale(8) },
  modalButtonIcon: { width: moderateScale(60), height: moderateScale(60), borderRadius: moderateScale(30), backgroundColor: '#EAF0FF', alignItems: 'center', justifyContent: 'center', marginBottom: moderateScale(8) },
  modalButtonText: { color: '#0b1960', fontWeight: '600', fontSize: moderateScale(14), textAlign: 'center' },
  modalCancelButton: { backgroundColor: '#F4F6FB', borderRadius: moderateScale(12), paddingVertical: moderateScale(12), alignItems: 'center' },
  modalCancelText: { color: '#666', fontWeight: '600', fontSize: moderateScale(16) },
});

export default AddNewEmployeeScreen;
