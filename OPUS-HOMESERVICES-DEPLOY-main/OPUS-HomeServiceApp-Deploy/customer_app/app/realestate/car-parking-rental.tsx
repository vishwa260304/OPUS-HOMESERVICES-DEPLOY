import React, { useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, StatusBar, Image, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { hapticButtonPress, hapticSuccess } from '../../utils/haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { ParkingRentalsApi } from '../../lib/parkingRentals';

export default function CarParkingRentalScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  // Personal details
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // Parking details
  const [parkingLocation, setParkingLocation] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [floorLevel, setFloorLevel] = useState('');

  // Financials & schedule
  const [rentAmount, setRentAmount] = useState('');
  const [rentPeriod, setRentPeriod] = useState<'Per Month' | 'Per Day' | 'Per Hour'>('Per Month');
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('Cash');

  // Parking specs
  const [parkingType, setParkingType] = useState<'Open' | 'Covered' | 'Basement' | 'Multi-level'>('Open');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [vehicleAllowed, setVehicleAllowed] = useState<'Car' | 'Bike' | 'Both'>('Car');
  const [parkingPhotos, setParkingPhotos] = useState<string[]>([]);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // KYC Details
  const [aadhaar, setAadhaar] = useState('');
  const [pan, setPan] = useState('');
  const [aadhaarImage, setAadhaarImage] = useState<string>('');
  const [panImage, setPanImage] = useState<string>('');

  // Loading state
  const [isSaving, setIsSaving] = useState(false);
  const [savedRentalId, setSavedRentalId] = useState<string | null>(null);

  // Check if all required fields are filled
  const isFormValid = fullName.trim() !== '' && 
                     address.trim() !== '' && 
                     phone.trim() !== '' && 
                     parkingLocation.trim() !== '' &&
                     rentAmount.trim() !== '' &&
                     aadhaar.trim() !== '' &&
                     pan.trim() !== '' &&
                     aadhaarImage !== '' &&
                     panImage !== '';

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleSaveAndContinue = async () => {
    if (!isFormValid) return;
    
    if (!user?.id) {
      Alert.alert('Authentication Required', 'Please sign in to continue.');
      return;
    }

    try {
      setIsSaving(true);
      hapticButtonPress();

      // Upload photos first if any
      let photoUrls: string[] = [];
      if (parkingPhotos.length > 0) {
        photoUrls = await ParkingRentalsApi.uploadParkingPhotos(user.id, parkingPhotos);
      }

      // Upload KYC documents
      const aadhaarUrl = await ParkingRentalsApi.uploadKYCDocument(user.id, aadhaarImage, 'aadhaar');
      const panUrl = await ParkingRentalsApi.uploadKYCDocument(user.id, panImage, 'pan');

      // Create parking rental record with all data including KYC
      const rentalData = {
        user_id: user.id,
        full_name: fullName,
        address: address,
        phone: phone,
        parking_location: parkingLocation,
        building_name: buildingName || undefined,
        floor_level: floorLevel || undefined,
        parking_type: parkingType,
        length: length ? parseFloat(length) : undefined,
        width: width ? parseFloat(width) : undefined,
        vehicle_allowed: vehicleAllowed,
        rent_amount: parseFloat(rentAmount),
        rent_period: rentPeriod,
        security_deposit: securityDeposit ? parseFloat(securityDeposit) : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        payment_mode: paymentMode,
        parking_photos: photoUrls,
        aadhaar_number: aadhaar,
        pan_number: pan,
        aadhaar_image_url: aadhaarUrl,
        pan_image_url: panUrl,
      };

      const createdRental = await ParkingRentalsApi.createParkingRental(rentalData);
      setSavedRentalId(createdRental.id!);

      // Make listing public immediately
      try {
        await ParkingRentalsApi.updateParkingRentalStatus(createdRental.id!, 'approved');
      } catch (e) {
        // Non-blocking: proceed even if status update fails
        console.warn('Failed to set parking rental status to approved', e);
      }

      hapticSuccess();
      
      // Navigate directly to success page
      router.push({
        pathname: '/realestate/parking-kyc-success',
        params: {
          rentalId: createdRental.id,
          parkingLocation,
          rentAmount,
          rentPeriod,
        },
      });
    } catch (error: any) {
      console.error('Error saving parking rental:', error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to save parking rental. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const pickImage = async (type: 'aadhaar' | 'pan', source: 'camera' | 'gallery') => {
    hapticButtonPress();
    
    try {
      let res;
      if (source === 'camera') {
        const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPerm.granted) {
          Alert.alert('Permission Required', 'Please grant permission to access your camera.');
          return;
        }
        res = await ImagePicker.launchCameraAsync({ 
          mediaTypes: ImagePicker.MediaTypeOptions.Images, 
          quality: 0.8,
          allowsEditing: true,
          aspect: [16, 9]
        });
      } else {
        const galleryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!galleryPerm.granted) {
          Alert.alert('Permission Required', 'Please grant permission to access your photos.');
          return;
        }
        res = await ImagePicker.launchImageLibraryAsync({ 
          mediaTypes: ImagePicker.MediaTypeOptions.Images, 
          quality: 0.8,
          allowsEditing: true,
          aspect: [16, 9]
        });
      }
      
      if (!res.canceled) {
        if (type === 'aadhaar') {
          setAadhaarImage(res.assets[0].uri);
        } else {
          setPanImage(res.assets[0].uri);
        }
        hapticSuccess();
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const showImagePickerOptions = (type: 'aadhaar' | 'pan') => {
    Alert.alert(
      'Upload Document',
      'Choose an option to upload your document',
      [
        {
          text: 'Take Photo',
          onPress: () => pickImage(type, 'camera'),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => pickImage(type, 'gallery'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={() => {
        hapticButtonPress();
        onPress();
      }}
      style={[
        styles.chip,
        { 
          backgroundColor: selected ? colors.secondary : colors.card, 
          borderColor: selected ? colors.secondary : colors.border,
          borderWidth: selected ? 2 : 1
        },
      ]}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, { color: selected ? '#fff' : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderInputField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    icon: any,
    keyboardType: any = 'default',
    fieldName: string,
    maxLength?: number,
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  ) => {
    const isFocused = focusedField === fieldName;
    return (
      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: isFocused ? colors.secondary : colors.textSecondary }]}>
          {label}
        </Text>
        <View style={[
          styles.inputWrapper,
          { 
            backgroundColor: colors.card,
            borderColor: isFocused ? colors.secondary : colors.border,
            borderWidth: isFocused ? 2 : 1
          }
        ]}>
          <Ionicons 
            name={icon} 
            size={20} 
            color={isFocused ? colors.secondary : colors.textSecondary} 
            style={styles.inputIcon}
          />
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            keyboardType={keyboardType}
            maxLength={maxLength}
            autoCapitalize={autoCapitalize}
            onFocus={() => setFocusedField(fieldName)}
            onBlur={() => setFocusedField(null)}
            style={[styles.input, { color: colors.text }]}
          />
        </View>
      </View>
    );
  };

  const renderUploadCard = (
    title: string,
    subtitle: string,
    icon: any,
    image: string,
    onPress: () => void
  ) => {
    return (
      <View style={[styles.uploadCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.uploadHeader}>
          <View style={[styles.uploadIconBg, { backgroundColor: colors.secondary + '20' }]}>
            <Ionicons name={icon} size={24} color={colors.secondary} />
          </View>
          <View style={styles.uploadHeaderText}>
            <Text style={[styles.uploadTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.uploadSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          </View>
        </View>

        {image ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: image }} style={styles.imagePreview} resizeMode="cover" />
            <View style={[styles.imageOverlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
              <Ionicons name="checkmark-circle" size={40} color="#4ADE80" />
            </View>
          </View>
        ) : (
          <View style={[styles.uploadPlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="cloud-upload-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
              No document uploaded
            </Text>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.uploadButton}
          onPress={onPress}
        >
          <LinearGradient
            colors={['#3B82F6', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.uploadButtonGradient}
          >
            <Ionicons name={image ? "refresh" : "cloud-upload"} size={18} color="#fff" />
            <Text style={styles.uploadButtonText}>
              {image ? 'Change Document' : 'Upload Document'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />

      {/* Header with gradient */}
      <LinearGradient
        colors={isDark ? ['#1a1a1a', colors.background] : [colors.secondary + '15', colors.background]}
        style={styles.headerGradient}
      >
        <View style={styles.headerSpacer} />
        <View style={styles.headerRow}>
          <TouchableOpacity 
            onPress={() => {
              hapticButtonPress();
              router.back();
            }} 
            style={[styles.iconBtn, { backgroundColor: colors.card }]}
          > 
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Car Parking Rental</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>List your parking space</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Personal Details Section */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="person" size={24} color={colors.secondary} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Your contact details
                </Text>
              </View>
            </View>

            {renderInputField('Full Name', fullName, setFullName, 'Enter your full name', 'person-outline', 'default', 'fullName')}
            {renderInputField('Address', address, setAddress, 'Enter your address', 'location-outline', 'default', 'address')}
            {renderInputField('Phone Number', phone, setPhone, 'Enter your phone number', 'call-outline', 'phone-pad', 'phone')}
          </View>

          {/* Parking Details Section */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="car" size={24} color={colors.secondary} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Parking Details</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Information about your parking space
                </Text>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Parking Type</Text>
              <View style={styles.rowWrap}>
                {['Open', 'Covered', 'Basement', 'Multi-level'].map(pt => (
                  <Chip key={pt} label={pt} selected={parkingType === pt} onPress={() => setParkingType(pt as any)} />
                ))}
              </View>
            </View>

            {renderInputField('Parking Address', parkingLocation, setParkingLocation, 'Apartment/Complex/Area', 'navigate-outline', 'default', 'parkingLocation')}
            {renderInputField('Building Name', buildingName, setBuildingName, 'Building / Tower Name', 'business-outline', 'default', 'buildingName')}
            {renderInputField('Floor / Level', floorLevel, setFloorLevel, 'e.g., Basement 1 / Level 3', 'layers-outline', 'default', 'floorLevel')}

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Dimensions (Length x Width)</Text>
              <View style={styles.inlineRow}>
                <View style={[
                  styles.inputWrapper,
                  { 
                    flex: 1,
                    backgroundColor: colors.card,
                    borderColor: focusedField === 'length' ? colors.secondary : colors.border,
                    borderWidth: focusedField === 'length' ? 2 : 1
                  }
                ]}>
                  <Ionicons 
                    name="resize-outline" 
                    size={20} 
                    color={focusedField === 'length' ? colors.secondary : colors.textSecondary} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={length}
                    onChangeText={setLength}
                    placeholder="Length (m)"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                    onFocus={() => setFocusedField('length')}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>
                <Text style={[styles.cross, { color: colors.textSecondary }]}>×</Text>
                <View style={[
                  styles.inputWrapper,
                  { 
                    flex: 1,
                    backgroundColor: colors.card,
                    borderColor: focusedField === 'width' ? colors.secondary : colors.border,
                    borderWidth: focusedField === 'width' ? 2 : 1
                  }
                ]}>
                  <Ionicons 
                    name="resize-outline" 
                    size={20} 
                    color={focusedField === 'width' ? colors.secondary : colors.textSecondary} 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={width}
                    onChangeText={setWidth}
                    placeholder="Width (m)"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                    onFocus={() => setFocusedField('width')}
                    onBlur={() => setFocusedField(null)}
                    style={[styles.input, { color: colors.text }]}
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Vehicle Type Allowed</Text>
              <View style={styles.rowWrap}>
                {['Car', 'Bike', 'Both'].map(vt => (
                  <Chip key={vt} label={vt} selected={vehicleAllowed === vt} onPress={() => setVehicleAllowed(vt as any)} />
                ))}
              </View>
            </View>
          </View>

          {/* Pricing & Schedule Section */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="cash" size={24} color={colors.secondary} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Pricing & Schedule</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Set your rental terms
                </Text>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Rent Amount</Text>
              <View style={[
                styles.inputWrapper,
                { 
                  backgroundColor: colors.card,
                  borderColor: focusedField === 'rentAmount' ? colors.secondary : colors.border,
                  borderWidth: focusedField === 'rentAmount' ? 2 : 1
                }
              ]}>
                <Ionicons 
                  name="wallet-outline" 
                  size={20} 
                  color={focusedField === 'rentAmount' ? colors.secondary : colors.textSecondary} 
                  style={styles.inputIcon}
                />
                <TextInput
                  value={rentAmount}
                  onChangeText={setRentAmount}
                  placeholder="Enter amount"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                  onFocus={() => setFocusedField('rentAmount')}
                  onBlur={() => setFocusedField(null)}
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Rent Period</Text>
              <View style={styles.rowWrap}>
                {['Per Month', 'Per Day', 'Per Hour'].map(p => (
                  <Chip key={p} label={p} selected={rentPeriod === p} onPress={() => setRentPeriod(p as any)} />
                ))}
              </View>
            </View>

            {renderInputField('Security Deposit (if any)', securityDeposit, setSecurityDeposit, 'Enter amount', 'shield-checkmark-outline', 'numeric', 'securityDeposit')}
            

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Mode</Text>
              <View style={styles.rowWrap}>
                {['Cash', 'UPI', 'Bank Transfer'].map(pm => (
                  <Chip key={pm} label={pm} selected={paymentMode === pm} onPress={() => setPaymentMode(pm as any)} />
                ))}
              </View>
            </View>
          </View>

          {/* Parking Photos Section */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="images" size={24} color={colors.secondary} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Parking Photos</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Upload photos of your parking space
                </Text>
              </View>
            </View>

            {parkingPhotos.length > 0 && (
              <View style={styles.photoGrid}>
                {parkingPhotos.map((uri, idx) => (
                  <Image key={`${uri}-${idx}`} source={{ uri }} style={styles.photoItem} />
                ))}
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.uploadBtn, { backgroundColor: colors.secondary + '15', borderColor: colors.secondary + '30' }]}
              onPress={async () => {
                hapticButtonPress();
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) return;
                const res = await ImagePicker.launchImageLibraryAsync({ 
                  mediaTypes: ImagePicker.MediaTypeOptions.Images, 
                  quality: 0.8, 
                  allowsMultipleSelection: true, 
                  selectionLimit: 3 
                });
                if (!res.canceled) {
                  const newUris = res.assets.map(a => a.uri).slice(0, 3);
                  setParkingPhotos(prev => [...prev, ...newUris].slice(0, 6));
                }
              }}
            >
              <Ionicons name="cloud-upload-outline" size={24} color={colors.secondary} />
              <Text style={[styles.uploadBtnText, { color: colors.secondary }]}>
                {parkingPhotos.length ? 'Add More Photos' : 'Upload Photos'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* KYC Verification Section */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="shield-checkmark" size={24} color={colors.secondary} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>KYC Verification</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Secure verification for listing
                </Text>
              </View>
            </View>

            {renderInputField(
              'Aadhaar Number', 
              aadhaar, 
              setAadhaar, 
              'Enter 12-digit Aadhaar number', 
              'id-card-outline', 
              'number-pad', 
              'aadhaar',
              12
            )}
            
            {renderInputField(
              'PAN Number', 
              pan, 
              setPan, 
              'Enter PAN (e.g., ABCDE1234F)', 
              'card-outline', 
              'default', 
              'pan',
              10,
              'characters'
            )}

            <View style={{ marginTop: 8 }}>
              {renderUploadCard(
                'Aadhaar Card',
                'Upload front side of your Aadhaar',
                'id-card',
                aadhaarImage,
                () => showImagePickerOptions('aadhaar')
              )}

              {renderUploadCard(
                'PAN Card',
                'Upload front side of your PAN',
                'card',
                panImage,
                () => showImagePickerOptions('pan')
              )}
            </View>

            {/* Requirements Info */}
            <View style={[styles.requirementsCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.requirementsTitle, { color: colors.text }]}>Document Requirements:</Text>
              <View style={styles.requirementItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                <Text style={[styles.requirementText, { color: colors.textSecondary }]}>
                  Clear and readable images
                </Text>
              </View>
              <View style={styles.requirementItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                <Text style={[styles.requirementText, { color: colors.textSecondary }]}>
                  All corners visible
                </Text>
              </View>
              <View style={styles.requirementItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                <Text style={[styles.requirementText, { color: colors.textSecondary }]}>
                  No glare or shadows
                </Text>
              </View>
            </View>
          </View>

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.secondary + '10', borderColor: colors.secondary + '30' }]}>
            <Ionicons name="information-circle" size={20} color={colors.secondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              Your parking space details will be reviewed before listing. Please ensure all information is accurate.
            </Text>
          </View>
        </ScrollView>

        {/* Fixed Bottom Button */}
        <View style={[styles.bottomContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.primaryBtn,
              (!isFormValid || isSaving) && styles.primaryBtnDisabled
            ]}
            disabled={!isFormValid || isSaving}
            onPress={handleSaveAndContinue}
          >
            <LinearGradient
              colors={isFormValid && !isSaving ? [colors.secondary, colors.secondary + 'dd'] : [colors.textSecondary, colors.textSecondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              {isSaving ? (
                <>
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Saving...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>
                    {isFormValid ? 'Submit & Complete' : 'Fill all required fields'}
                  </Text>
                  {isFormValid && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1 
  },
  headerGradient: {
    paddingTop: 0,
    paddingBottom: 16,
  },
  headerSpacer: { 
    height: 50 
  },
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    marginBottom: 0 
  },
  iconBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerRight: { 
    width: 40 
  },
  content: { 
    padding: 20, 
    paddingBottom: 120 
  },
  sectionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  sectionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: { 
    fontSize: 13, 
    fontWeight: '600', 
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: { 
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  rowWrap: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8, 
    marginTop: 4
  },
  chip: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20,
  },
  chipText: { 
    fontSize: 13, 
    fontWeight: '600' 
  },
  inlineRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8
  },
  cross: { 
    marginHorizontal: 8, 
    fontWeight: '700',
    fontSize: 18,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  photoItem: {
    width: 96,
    height: 96,
    borderRadius: 12,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  uploadBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryBtn: { 
    height: 56, 
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  uploadCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  uploadIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadHeaderText: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  uploadSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPlaceholder: {
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  placeholderText: {
    fontSize: 13,
    fontWeight: '500',
  },
  uploadButton: {
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  requirementsCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginTop: 16,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});