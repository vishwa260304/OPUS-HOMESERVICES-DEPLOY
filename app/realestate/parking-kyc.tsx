import React, { useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, TextInput, Alert, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { hapticButtonPress, hapticSuccess } from '../../utils/haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { ParkingRentalsApi } from '../../lib/parkingRentals';
import { verifyKycDocumentWithOCR } from '../../lib/kyc';

export default function ParkingKycScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const parsedPhotos: string[] = (() => {
    try {
      const p = (params as any).parkingPhotos;
      if (!p) return [];
      return Array.isArray(p) ? p as any : JSON.parse(p as any);
    } catch {
      return [];
    }
  })();

  const [aadhaar, setAadhaar] = useState('');
  const [pan, setPan] = useState('');
  const [aadhaarImage, setAadhaarImage] = useState<string>('');
  const [panImage, setPanImage] = useState<string>('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [verifyingAadhaar, setVerifyingAadhaar] = useState(false);
  const [verifyingPan, setVerifyingPan] = useState(false);
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [extractedAadhaar, setExtractedAadhaar] = useState<string>(''); // Store extracted Aadhaar for comparison
  const [extractedPan, setExtractedPan] = useState<string>(''); // Store extracted PAN for comparison

  // Check if all required fields are filled AND documents are verified
  const isFormValid = aadhaar.trim() !== '' && 
                     pan.trim() !== '' && 
                     aadhaarImage !== '' && 
                     panImage !== '' &&
                     aadhaarVerified &&
                     panVerified;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleVerifyAndFinish = async () => {
    if (!isFormValid) return;
    
    // Final cross-verification check before submission
    const aadhaarClean = aadhaar.trim().replace(/\s/g, '');
    const panClean = pan.trim().replace(/\s/g, '').toUpperCase();
    const extractedAadhaarClean = extractedAadhaar.replace(/\s/g, '');
    const extractedPanClean = extractedPan.replace(/\s/g, '').toUpperCase();
    
    // Check if extracted numbers match manual entries
    if (extractedAadhaar && aadhaarClean !== extractedAadhaarClean) {
      Alert.alert(
        'Verification Failed',
        `The entered Aadhaar number (${aadhaar}) does not match the extracted number from the uploaded document (${extractedAadhaar}). Please upload the correct Aadhaar card.`,
        [{ text: 'OK' }]
      );
      setAadhaarImage('');
      setAadhaar('');
      setExtractedAadhaar('');
      setAadhaarVerified(false);
      return;
    }
    
    if (extractedPan && panClean !== extractedPanClean) {
      Alert.alert(
        'Verification Failed',
        `The entered PAN number (${pan}) does not match the extracted number from the uploaded document (${extractedPan}). Please upload the correct PAN card.`,
        [{ text: 'OK' }]
      );
      setPanImage('');
      setPan('');
      setExtractedPan('');
      setPanVerified(false);
      return;
    }
    
    // Check if documents are verified
    if (!aadhaarVerified || !panVerified) {
      Alert.alert(
        'Verification Required',
        'Please upload and verify both Aadhaar and PAN cards before submitting. Only verified documents are accepted.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!user?.id) {
      Alert.alert('Authentication Required', 'Please sign in to continue.');
      return;
    }

    const rentalId = params.rentalId as string;
    if (!rentalId) {
      Alert.alert('Error', 'Rental ID not found. Please try again.');
      return;
    }

    try {
      setIsSaving(true);
      hapticButtonPress();

      // Upload KYC documents
      Alert.alert('Uploading', 'Uploading KYC documents...');
      const aadhaarUrl = await ParkingRentalsApi.uploadKYCDocument(user.id, aadhaarImage, 'aadhaar');
      const panUrl = await ParkingRentalsApi.uploadKYCDocument(user.id, panImage, 'pan');

      // Update rental with KYC information
      await ParkingRentalsApi.updateParkingRentalKYC(rentalId, {
        aadhaar_number: aadhaar,
        pan_number: pan,
        aadhaar_image_url: aadhaarUrl,
        pan_image_url: panUrl,
      });

      hapticSuccess();
      
      // Navigate to success page
      router.push({
        pathname: '/realestate/parking-kyc-success',
        params: {
          rentalId,
          parkingLocation: params.parkingLocation,
          rentAmount: params.rentAmount,
          rentPeriod: params.rentPeriod,
        },
      });
    } catch (error: any) {
      console.error('Error saving KYC data:', error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to save KYC data. Please try again.'
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
        const imageUri = res.assets[0].uri;
        if (type === 'aadhaar') {
          setAadhaarImage(imageUri);
          setAadhaarVerified(false);
          // Automatically verify Aadhaar with OCR
          verifyDocumentWithOCR(imageUri, 'aadhaar');
        } else {
          setPanImage(imageUri);
          setPanVerified(false);
          // Automatically verify PAN with OCR
          verifyDocumentWithOCR(imageUri, 'pan');
        }
        hapticSuccess();
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const verifyDocumentWithOCR = async (imageUri: string, documentType: 'aadhaar' | 'pan') => {
    if (documentType === 'aadhaar') {
      setVerifyingAadhaar(true);
    } else {
      setVerifyingPan(true);
    }

    try {
      const result = await verifyKycDocumentWithOCR(imageUri, documentType);
      
      // First check if the document type is correct
      if (result.success && result.isCorrectDocumentType === false) {
        // Wrong document type uploaded
        const expectedDoc = documentType === 'aadhaar' ? 'Aadhaar' : 'PAN';
        const wrongDoc = documentType === 'aadhaar' ? 'PAN' : 'Aadhaar';
        
        // Clear the image
        if (documentType === 'aadhaar') {
          setAadhaarImage('');
          setAadhaar('');
          setExtractedAadhaar('');
          setAadhaarVerified(false);
        } else {
          setPanImage('');
          setPan('');
          setExtractedPan('');
          setPanVerified(false);
        }
        
        Alert.alert(
          'Wrong Document Type',
          `You uploaded a ${wrongDoc} card, but ${expectedDoc} card is required. Please upload the correct document.`,
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (result.success && result.extractedNumber) {
        // Only verify if document type is correct AND number is valid
        const isDocumentValid = (result.isValid === true) && (result.isCorrectDocumentType === true);
        
        // Store extracted number for comparison
        const extractedNumber = result.extractedNumber.trim();
        
        if (documentType === 'aadhaar') {
          setExtractedAadhaar(extractedNumber);
          setAadhaar(extractedNumber);
          
          // Cross-verify: Check if extracted number matches manual entry (if any)
          const manualAadhaar = aadhaar.trim().replace(/\s/g, '');
          const extractedClean = extractedNumber.replace(/\s/g, '');
          
          // If manual entry exists, compare it with extracted
          if (manualAadhaar && manualAadhaar !== extractedClean) {
            // Numbers don't match - clear everything
            setAadhaarImage('');
            setAadhaar('');
            setExtractedAadhaar('');
            setAadhaarVerified(false);
            Alert.alert(
              'Verification Failed',
              `The extracted Aadhaar number (${extractedNumber}) does not match the manually entered number (${aadhaar}). Please upload the correct Aadhaar card.`,
              [{ text: 'OK' }]
            );
            return;
          }
          
          // Verify only if document is valid
          const isVerified = isDocumentValid;
          setAadhaarVerified(isVerified || false);
          
          if (isVerified) {
            hapticSuccess();
            Alert.alert(
              'Aadhaar Verified ✓',
              `Aadhaar number ${extractedNumber} has been extracted and verified. Please verify it matches your document.`,
              [{ text: 'OK' }]
            );
          } else {
            // Clear image if not verified
            setAadhaarImage('');
            setAadhaar('');
            setExtractedAadhaar('');
            setAadhaarVerified(false);
            Alert.alert(
              'Verification Failed',
              `The uploaded document could not be verified as a valid Aadhaar card. Please upload a clear image of your Aadhaar card.`,
              [{ text: 'OK' }]
            );
          }
        } else {
          setExtractedPan(extractedNumber);
          setPan(extractedNumber);
          
          // Cross-verify: Check if extracted number matches manual entry (if any)
          const manualPan = pan.trim().replace(/\s/g, '').toUpperCase();
          const extractedClean = extractedNumber.replace(/\s/g, '').toUpperCase();
          
          // If manual entry exists, compare it with extracted
          if (manualPan && manualPan !== extractedClean) {
            // Numbers don't match - clear everything
            setPanImage('');
            setPan('');
            setExtractedPan('');
            setPanVerified(false);
            Alert.alert(
              'Verification Failed',
              `The extracted PAN number (${extractedNumber}) does not match the manually entered number (${pan}). Please upload the correct PAN card.`,
              [{ text: 'OK' }]
            );
            return;
          }
          
          // Verify only if document is valid
          const isVerified = isDocumentValid;
          setPanVerified(isVerified || false);
          
          if (isVerified) {
            hapticSuccess();
            Alert.alert(
              'PAN Verified ✓',
              `PAN number ${extractedNumber} has been extracted and verified. Please verify it matches your document.`,
              [{ text: 'OK' }]
            );
          } else {
            // Clear image if not verified
            setPanImage('');
            setPan('');
            setExtractedPan('');
            setPanVerified(false);
            Alert.alert(
              'Verification Failed',
              `The uploaded document could not be verified as a valid PAN card. Please upload a clear image of your PAN card.`,
              [{ text: 'OK' }]
            );
          }
        }
      } else {
        // OCR failed or couldn't extract number - clear the image
        const errorMsg = result.error || 'Could not verify the document. Please upload a clear image of the correct document type.';
        
        // Always clear the image if verification fails
        if (documentType === 'aadhaar') {
          setAadhaarImage('');
          setAadhaar('');
          setExtractedAadhaar('');
          setAadhaarVerified(false);
        } else {
          setPanImage('');
          setPan('');
          setExtractedPan('');
          setPanVerified(false);
        }
        
        Alert.alert(
          'Verification Failed',
          errorMsg,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('OCR verification error:', error);
      Alert.alert(
        'Verification Error',
        error?.message || 'Failed to verify document. Please ensure you uploaded the correct document type.',
        [{ text: 'OK' }]
      );
    } finally {
      if (documentType === 'aadhaar') {
        setVerifyingAadhaar(false);
      } else {
        setVerifyingPan(false);
      }
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
    onPress: () => void,
    isVerifying: boolean = false,
    isVerified: boolean = false
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
              {isVerifying ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <Ionicons 
                  name="checkmark-circle" 
                  size={40} 
                  color={isVerified ? "#4ADE80" : "#60A5FA"} 
                />
              )}
            </View>
            {isVerified && !isVerifying && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={16} color="#fff" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
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
            <Text style={[styles.headerTitle, { color: colors.text }]}>Parking KYC Verification</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Final Step</Text>
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
          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: colors.secondary + '10', borderColor: colors.secondary + '30' }]}>
            <Ionicons name="shield-checkmark" size={24} color={colors.secondary} />
            <View style={styles.infoBannerText}>
              <Text style={[styles.infoBannerTitle, { color: colors.text }]}>Secure Verification</Text>
              <Text style={[styles.infoBannerSubtitle, { color: colors.textSecondary }]}>
                Your documents are encrypted and stored securely
              </Text>
            </View>
          </View>

          {/* KYC Details Section */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="document-text" size={24} color={colors.secondary} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Document Details</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Enter your identification numbers
                </Text>
              </View>
            </View>

            {renderInputField(
              'Aadhaar Number', 
              aadhaar, 
              (text) => {
                setAadhaar(text);
                // Cross-verify when user manually enters/changes Aadhaar
                if (aadhaarImage && extractedAadhaar) {
                  const manualClean = text.trim().replace(/\s/g, '');
                  const extractedClean = extractedAadhaar.replace(/\s/g, '');
                  if (manualClean && manualClean !== extractedClean) {
                    // Numbers don't match - clear image and reset verification
                    setAadhaarImage('');
                    setExtractedAadhaar('');
                    setAadhaarVerified(false);
                    Alert.alert(
                      'Mismatch Detected',
                      `The entered Aadhaar number does not match the extracted number from the uploaded document. Please upload the correct Aadhaar card.`,
                      [{ text: 'OK' }]
                    );
                  } else if (manualClean === extractedClean && aadhaarVerified) {
                    // Numbers match and document was verified
                    setAadhaarVerified(true);
                  }
                }
              }, 
              'Enter 12-digit Aadhaar number', 
              'id-card-outline', 
              'number-pad', 
              'aadhaar',
              12
            )}
            
            {renderInputField(
              'PAN Number', 
              pan, 
              (text) => {
                setPan(text);
                // Cross-verify when user manually enters/changes PAN
                if (panImage && extractedPan) {
                  const manualClean = text.trim().replace(/\s/g, '').toUpperCase();
                  const extractedClean = extractedPan.replace(/\s/g, '').toUpperCase();
                  if (manualClean && manualClean !== extractedClean) {
                    // Numbers don't match - clear image and reset verification
                    setPanImage('');
                    setExtractedPan('');
                    setPanVerified(false);
                    Alert.alert(
                      'Mismatch Detected',
                      `The entered PAN number does not match the extracted number from the uploaded document. Please upload the correct PAN card.`,
                      [{ text: 'OK' }]
                    );
                  } else if (manualClean === extractedClean && panVerified) {
                    // Numbers match and document was verified
                    setPanVerified(true);
                  }
                }
              }, 
              'Enter PAN (e.g., ABCDE1234F)', 
              'card-outline', 
              'default', 
              'pan',
              10,
              'characters'
            )}
          </View>

          {/* Document Upload Section */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: '#3B82F6' + '20' }]}>
                <Ionicons name="cloud-upload" size={24} color="#3B82F6" />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Upload Documents</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Clear photos of your ID documents
                </Text>
              </View>
            </View>

            {renderUploadCard(
              'Aadhaar Card',
              'Upload front side of your Aadhaar',
              'id-card',
              aadhaarImage,
              () => showImagePickerOptions('aadhaar'),
              verifyingAadhaar,
              aadhaarVerified
            )}

            {renderUploadCard(
              'PAN Card',
              'Upload front side of your PAN',
              'card',
              panImage,
              () => showImagePickerOptions('pan'),
              verifyingPan,
              panVerified
            )}
        </View>

          {/* Requirements Info */}
          <View style={[styles.requirementsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                All corners of the document visible
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
              <Text style={[styles.requirementText, { color: colors.textSecondary }]}>
                No glare or shadows on the document
              </Text>
            </View>
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
            onPress={handleVerifyAndFinish}
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
                  <Text style={styles.primaryBtnText}>Submitting...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>
                    {isFormValid ? 'Submit KYC' : aadhaarVerified && panVerified ? 'Complete all fields' : 'Verify documents first'}
                  </Text>
                  {isFormValid && <Ionicons name="shield-checkmark" size={20} color="#fff" />}
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoBannerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
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
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
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
  verifiedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ADE80',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});