import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image, Alert, Animated, Easing, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { getKyc, setKyc, getSelectedSector } from '../utils/appState';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useVerification } from '../hooks/useVerification';
import { api } from '../lib/api';

const KYCVerificationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { refreshVerification } = useVerification();
  const sector = (route.params && (route.params as any).sector) || undefined;
  const sectorName = (route.params && (route.params as any).sectorName) || undefined;
  const isDoctorConsultation = sectorName === 'Doctor Consultation';
  const isMedicineDelivery = sectorName === 'Medicine Delivery';
  const isActingDrivers = sector === 'actingDrivers';
  const isHealthcare = sector === 'healthcare' && !isDoctorConsultation && !isMedicineDelivery;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [actingDriverDetailsId, setActingDriverDetailsId] = useState<string | null>(null);

  // Company details form state
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [drivingExperienceYears, setDrivingExperienceYears] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);

  // Doctor details form state (used when Doctor Consultation sector is selected)
  const [doctorName, setDoctorName] = useState('');
  const [doctorLicenseNumber, setDoctorLicenseNumber] = useState('');
  const [medicalCouncilName, setMedicalCouncilName] = useState('');
  const [doctorSpecialty, setDoctorSpecialty] = useState('');
  const [qualification, setQualification] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [doctorAddress, setDoctorAddress] = useState('');

  // Upload state
  type UploadKey = 'businessReg' | 'gstCert' | 'panCard' | 'addressProof' | 'governmentId' | 'clinicalEstablishmentCert';
  type UploadFile = { name: string; uri: string; size?: number; mimeType?: string } | null;
  const [uploads, setUploads] = useState<Record<UploadKey, UploadFile>>({
    businessReg: null,
    gstCert: null,
    panCard: null,
    addressProof: null,
    governmentId: null,
    clinicalEstablishmentCert: null,
  });
  const [uploadingFiles, setUploadingFiles] = useState<Set<UploadKey>>(new Set());

  useEffect(() => {
    const kyc = getKyc();
    if (kyc?.uploaded) {
      setStep(3);
    }
    loadExistingVerification();
  }, []);

  const loadExistingVerification = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load acting drivers details if applicable
      if (isActingDrivers) {
        const actingDriverResult = await api.actingDrivers.getActingDriverDetails(user.id);
        if (actingDriverResult.data && !actingDriverResult.error) {
          const driverData = actingDriverResult.data;
          setActingDriverDetailsId(driverData.id);
          setCompanyName(driverData.name || '');
          setContactNumber(driverData.phone || '');
          setOfficialEmail(driverData.email || '');
          setBusinessAddress(driverData.address || '');
          setPanNumber(driverData.aadhaar_number || '');
          setDrivingExperienceYears(
            driverData.driving_experience_years !== null && driverData.driving_experience_years !== undefined
              ? String(driverData.driving_experience_years)
              : ''
          );
          setAboutMe(driverData.about || '');

          // Load existing profile photo (path in profile_photo column; profile-images bucket for new, legacy in verification-documents)
          if (driverData.profile_photo) {
            let photoUrl = driverData.profile_photo;
            if (!driverData.profile_photo.startsWith('http')) {
              const bucket = driverData.profile_photo.startsWith('verification-documents/')
                ? 'verification-documents'
                : 'profile-images';
              const { data: urlData } = api.supabase.storage
                .from(bucket)
                .getPublicUrl(driverData.profile_photo);
              photoUrl = urlData.publicUrl;
            }
            setProfilePhoto(photoUrl);
          }

          // Load existing driving licence if uploaded
          // Convert storage path to public URL for display
          if (driverData.drivers_licence) {
            // If it's already a full URL, use it; otherwise construct public URL from path
            let licenceUrl = driverData.drivers_licence;
            if (!driverData.drivers_licence.startsWith('http')) {
              // It's a storage path, construct public URL
              const { data: urlData } = api.supabase.storage
                .from('verification-documents')
                .getPublicUrl(driverData.drivers_licence);
              licenceUrl = urlData.publicUrl;
            }
            
            const uploadMap: Record<UploadKey, UploadFile> = {
              businessReg: null,
              gstCert: {
                name: 'driving_licence.jpg',
                uri: licenceUrl,
                mimeType: 'image/jpeg',
              },
              panCard: null,
              addressProof: null,
              governmentId: null,
              clinicalEstablishmentCert: null,
            };
            setUploads(uploadMap);
          }

          // Set step based on verification status
          if (driverData.verification_status === 'approved') {
            setStep(3);
          } else if (driverData.verification_status === 'under_review') {
            setStep(3);
          } else if (driverData.drivers_licence) {
            setStep(2);
          }
        }
        setLoading(false);
        return;
      }

      const [{ data, error }, doctorDetailsResult] = await Promise.all([
        api.companyVerification.getCompanyVerification(user.id),
        api.doctorDetails.getDoctorDetails(user.id)
      ]);
      
      if (data && !error) {
        setVerificationId(data.id);
        setCompanyName(data.company_name || '');
        setGstNumber(data.gst_number || '');
        setPanNumber((data as any).pan_number || '');
        setOfficialEmail(data.official_email || '');
        setContactNumber(data.contact_number || '');
        setBusinessType(data.business_type || '');
        setBusinessAddress(data.business_address || '');

        // Pre-fill doctor fields from existing data
        if (doctorDetailsResult.data && !doctorDetailsResult.error) {
          const doctorData = Array.isArray(doctorDetailsResult.data) 
            ? doctorDetailsResult.data[0] 
            : doctorDetailsResult.data;
          setDoctorName(doctorData.doctor_name || '');
          setDoctorLicenseNumber(doctorData.medical_registration_number || '');
          setDoctorSpecialty(doctorData.specialty || '');
          setDoctorAddress(doctorData.address || '');
          // Note: medical_council_name, qualification, years_of_experience, email, phone_number
          // are not in the new schema, so we don't set them
        } else {
          // Fallback to company data if doctor details don't exist
          setDoctorName(data.company_name || '');
          setDoctorLicenseNumber(data.gst_number || '');
          setDoctorSpecialty(data.business_type || '');
          setDoctorAddress(data.business_address || '');
        }

        // Load existing documents
        if (data.documents) {
          const existingDocs = data.documents.map((doc: any) => ({
            type: doc.document_type,
            name: doc.document_name,
            uri: doc.file_url,
            size: doc.file_size,
            mimeType: doc.mime_type,
            status: doc.document_status,
          }));
          
          // Map documents to upload keys
          const uploadMap: Record<UploadKey, UploadFile> = {
            businessReg: null,
            gstCert: null,
            panCard: null,
            addressProof: null,
            governmentId: null,
            clinicalEstablishmentCert: null,
          };

          existingDocs.forEach((doc: any) => {
            switch (doc.type) {
              case 'business_registration':
                uploadMap.businessReg = doc;
                break;
              case 'clinical_establishment_certificate':
                uploadMap.clinicalEstablishmentCert = doc;
                break;
              case 'gst_certificate':
                uploadMap.gstCert = doc;
                break;
              case 'doctor_nmc_licence':
                uploadMap.gstCert = doc;
                break;
              case 'pan_card':
                uploadMap.panCard = doc;
                break;
              case 'address_proof':
                uploadMap.addressProof = doc;
                break;
              case 'government_id':
                uploadMap.governmentId = doc;
                break;
            }
          });

          setUploads(uploadMap);
        }

        // Set step based on verification status
        if (data.verification_status === 'approved') {
          setStep(3);
        } else if (data.verification_status === 'under_review') {
          setStep(3);
        } else if (data.documents && data.documents.length > 0) {
          setStep(2);
        }
      }

      // Load doctor details and documents, if any
      if (doctorDetailsResult && doctorDetailsResult.data && !doctorDetailsResult.error) {
        const d = Array.isArray(doctorDetailsResult.data) 
          ? doctorDetailsResult.data[0] 
          : doctorDetailsResult.data;
        setDoctorName(d.doctor_name || '');
        setDoctorLicenseNumber(d.medical_registration_number || '');
        setDoctorSpecialty(d.specialty || '');
        setDoctorAddress(d.address || '');
        
        // Load doctor documents from providers_doctor_documents table
        if (isDoctorConsultation) {
          const doctorDocsResult = await api.doctorDocuments.getDoctorDocuments(user.id);
          if (doctorDocsResult.data && !doctorDocsResult.error) {
            const existingDocs = (doctorDocsResult.data || []).map((doc: any) => ({
              type: doc.document_type,
              name: doc.document_name,
              uri: doc.file_url,
              size: doc.file_size,
              mimeType: doc.mime_type,
              status: doc.document_status,
            }));
            
            // Map documents to upload keys
            const uploadMap: Record<UploadKey, UploadFile> = {
              businessReg: null,
              gstCert: null,
              panCard: null,
              addressProof: null,
              governmentId: null,
              clinicalEstablishmentCert: null,
            };

            existingDocs.forEach((doc: any) => {
              switch (doc.type) {
                case 'business_registration':
                  uploadMap.businessReg = doc;
                  break;
                case 'clinical_establishment_certificate':
                  uploadMap.clinicalEstablishmentCert = doc;
                  break;
                case 'gst_certificate':
                  uploadMap.gstCert = doc;
                  break;
                case 'doctor_nmc_licence':
                  uploadMap.gstCert = doc;
                  break;
                case 'driving_licence':
                  uploadMap.gstCert = doc;
                  break;
                case 'pan_card':
                  uploadMap.panCard = doc;
                  break;
                case 'address_proof':
                  uploadMap.addressProof = doc;
                  break;
                case 'government_id':
                  uploadMap.governmentId = doc;
                  break;
              }
            });

            setUploads(uploadMap);
            
            // Set step based on documents
            if (existingDocs.length > 0) {
              setStep(2);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading verification:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickDocument = async (key: UploadKey) => {
    try {
      const res: any = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      // Support both new ({ canceled, assets }) and old shapes
      if (res.canceled || res?.type === 'cancel') return;
      const file = res.assets?.[0] ?? ({
        name: res.name,
        uri: res.uri,
        size: res.size,
        mimeType: res.mimeType,
      } as any);
      
      // Map upload key to document type
      const documentTypeMap: Record<UploadKey, string> = {
        businessReg: isMedicineDelivery ? 'pharmacy_degree_certificate' : 'business_registration',
        gstCert: isDoctorConsultation
          ? 'doctor_nmc_licence'
          : isMedicineDelivery
          ? 'pharmacist_registration_certificate'
          : isActingDrivers
          ? 'driving_licence'
          : 'gst_certificate',
        panCard: 'pan_card',
        addressProof: 'address_proof',
        governmentId: 'government_id',
        clinicalEstablishmentCert: 'clinical_establishment_certificate',
      };

      // Set uploading state
      setUploadingFiles(prev => new Set(prev).add(key));

      // Upload to database and storage
      await uploadDocument(file, documentTypeMap[key]);
      
      // Update local state
      setUploads((prev) => ({ ...prev, [key]: file }));
    } catch (e) {
      console.error('Error picking document:', e);
      Alert.alert('Error', 'Failed to pick document');
    } finally {
      // Clear uploading state
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const pickImage = async (key: UploadKey) => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
        allowsEditing: false,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      const file = {
        name: asset.fileName || asset.uri?.split('/').pop() || 'image.jpg',
        uri: asset.uri,
        size: asset.fileSize,
        mimeType: 'image/jpeg',
      };

      // Map upload key to document type
      const documentTypeMap: Record<UploadKey, string> = {
        businessReg: isMedicineDelivery ? 'pharmacy_degree_certificate' : 'business_registration',
        gstCert: isDoctorConsultation
          ? 'doctor_nmc_licence'
          : isMedicineDelivery
          ? 'pharmacist_registration_certificate'
          : isActingDrivers
          ? 'driving_licence'
          : 'gst_certificate',
        panCard: 'pan_card',
        addressProof: 'address_proof',
        governmentId: 'government_id',
        clinicalEstablishmentCert: 'clinical_establishment_certificate',
      };

      // Set uploading state
      setUploadingFiles(prev => new Set(prev).add(key));

      // Upload to database and storage
      await uploadDocument(file, documentTypeMap[key]);
      
      // Update local state
      setUploads((prev) => ({ ...prev, [key]: file }));
    } catch (e) {
      console.error('Error picking image:', e);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      // Clear uploading state
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const selectSource = (key: UploadKey) => {
    Alert.alert('Upload', 'Choose a source', [
      { text: 'Image', onPress: () => pickImage(key) },
      { text: 'Document', onPress: () => pickDocument(key) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Profile photo upload handler for acting drivers
  const handleProfilePhotoUpload = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to continue');
      return;
    }

    Alert.alert('Profile Photo', 'Choose a source', [
      { text: 'Take Selfie', onPress: () => pickProfilePhoto('camera') },
      { text: 'Choose from Gallery', onPress: () => pickProfilePhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickProfilePhoto = async (source: 'camera' | 'library') => {
    try {
      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (source === 'camera') {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPermission.granted) {
          Alert.alert('Permission Required', 'Camera permission is needed to take photos');
          return;
        }
      }

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Photo library permission is needed to select images');
        return;
      }

      // Configure image picker
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1], // Square for profile photo
        quality: 0.8,
      };

      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets[0]) {
        await uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking profile photo:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadProfilePhoto = async (imageUri: string) => {
    if (!user) return;

    try {
      setUploadingProfilePhoto(true);

      // Upload to profile-images bucket; path within bucket: {user_id}/{fileName}
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `profile_photo_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      const PROFILE_IMAGES_BUCKET = 'profile-images';

      console.log('Starting profile photo upload:', { fileName, filePath, bucket: PROFILE_IMAGES_BUCKET });

      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const { data: uploadData, error: uploadError } = await api.supabase.storage
        .from(PROFILE_IMAGES_BUCKET)
        .upload(filePath, uint8Array, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        Alert.alert('Error', `Failed to upload profile photo: ${uploadError.message}`);
        return;
      }

      // Save path (within bucket) to profile_photo column in providers_acting_drivers
      const storagePath = filePath;

      const { data: urlData } = api.supabase.storage
        .from(PROFILE_IMAGES_BUCKET)
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;

      if (actingDriverDetailsId) {
        const updateResult = await api.actingDrivers.updateActingDriverDetails(actingDriverDetailsId, {
          profile_photo: storagePath,
        });

        if (updateResult.error) {
          Alert.alert('Error', updateResult.error.message || 'Failed to save profile photo');
          return;
        }
      }

      setProfilePhoto(fileUrl);

      Alert.alert('Success', 'Profile photo uploaded successfully');
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      Alert.alert('Error', 'Failed to upload profile photo');
    } finally {
      setUploadingProfilePhoto(false);
    }
  };

  const removeDocument = async (key: UploadKey) => {
    const file = uploads[key];
    if (!file) return;

    try {
      // If file has a URL from Supabase Storage, delete it
      if (file.uri && file.uri.includes('supabase')) {
        const filePath = file.uri.split('/storage/v1/object/public/verification-documents/')[1];
        if (filePath) {
          const { error } = await api.supabase.storage
            .from('verification-documents')
            .remove([filePath]);
          
          if (error) {
            console.error('Error deleting file from storage:', error);
          }
        }
      }

      // Remove from local state
      setUploads((prev) => ({ ...prev, [key]: null }));
    } catch (error) {
      console.error('Error removing document:', error);
      // Still remove from local state even if storage deletion fails
      setUploads((prev) => ({ ...prev, [key]: null }));
    }
  };

  // Validation
  const emailRegex = /^(?:[a-zA-Z0-9_'^&\-]+(?:\.[a-zA-Z0-9_'^&\-]+)*)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  const phoneRegex = /^\+?\d{10,14}$/; // accepts 10-14 digits with optional +
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/; // PAN format: ABCDE1234F
  const aadhaarRegex = /^\d{12}$/; // Aadhaar: 12 digits

  const isCompanyStepValid = useMemo(() => {
    if (isDoctorConsultation) {
      return (
        doctorName.trim().length > 2 &&
        // for doctor license, relax to 5-20 alphanumeric
        /^[A-Za-z0-9\-\/]{5,20}$/.test(doctorLicenseNumber.trim()) &&
        medicalCouncilName.trim().length > 2 &&
        doctorSpecialty.trim().length > 2 &&
        qualification.trim().length > 2 &&
        yearsOfExperience.trim().length > 0 &&
        /^\d+$/.test(yearsOfExperience.trim()) &&
        emailRegex.test(doctorEmail.trim()) &&
        phoneRegex.test(doctorPhone.replace(/\s/g, '')) &&
        doctorAddress.trim().length > 10
      );
    }
    if (isMedicineDelivery) {
      return (
        companyName.trim().length > 2 &&
        gstRegex.test(gstNumber.trim()) &&
        emailRegex.test(officialEmail.trim()) &&
        phoneRegex.test(contactNumber.replace(/\s/g, '')) &&
        businessAddress.trim().length > 10
      );
    }
    if (isActingDrivers) {
      // Personal details: basic contact info + driving experience in years
      return (
        companyName.trim().length > 2 && // used as personal name
        emailRegex.test(officialEmail.trim()) &&
        phoneRegex.test(contactNumber.replace(/\s/g, '')) &&
        businessAddress.trim().length > 10 &&
        drivingExperienceYears.trim().length > 0 &&
        /^\d+$/.test(drivingExperienceYears.trim())
      );
    }
    return (
      companyName.trim().length > 2 &&
      gstRegex.test(gstNumber.trim()) &&
      emailRegex.test(officialEmail.trim()) &&
      phoneRegex.test(contactNumber.replace(/\s/g, '')) &&
      businessAddress.trim().length > 10
    );
  }, [
    isDoctorConsultation,
    isMedicineDelivery,
    isActingDrivers,
    doctorName,
    doctorLicenseNumber,
    medicalCouncilName,
    doctorSpecialty,
    qualification,
    yearsOfExperience,
    doctorEmail,
    doctorPhone,
    doctorAddress,
    companyName,
    gstNumber,
    officialEmail,
    contactNumber,
    businessAddress,
    drivingExperienceYears,
  ]);

  // Enable button when all fields are filled (regardless of regex validity)
  const isCompanyStepFilled = useMemo(() => {
    if (isDoctorConsultation) {
      return (
        doctorName.trim().length > 0 &&
        doctorLicenseNumber.trim().length > 0 &&
        medicalCouncilName.trim().length > 0 &&
        doctorSpecialty.trim().length > 0 &&
        qualification.trim().length > 0 &&
        yearsOfExperience.trim().length > 0 &&
        doctorEmail.trim().length > 0 &&
        doctorPhone.trim().length > 0 &&
        doctorAddress.trim().length > 0
      );
    }
    if (isMedicineDelivery) {
      return (
        companyName.trim().length > 0 &&
        gstNumber.trim().length > 0 &&
        officialEmail.trim().length > 0 &&
        contactNumber.trim().length > 0 &&
        businessAddress.trim().length > 0
      );
    }
    if (isActingDrivers) {
      // All personal fields must be non-empty
      return (
        companyName.trim().length > 0 && // name
        officialEmail.trim().length > 0 &&
        contactNumber.trim().length > 0 &&
        businessAddress.trim().length > 0 &&
        drivingExperienceYears.trim().length > 0
      );
    }
    return (
      companyName.trim().length > 0 &&
      gstNumber.trim().length > 0 &&
      officialEmail.trim().length > 0 &&
      contactNumber.trim().length > 0 &&
      businessAddress.trim().length > 0
    );
  }, [
    isDoctorConsultation,
    isMedicineDelivery,
    isActingDrivers,
    doctorName,
    doctorLicenseNumber,
    medicalCouncilName,
    doctorSpecialty,
    qualification,
    yearsOfExperience,
    doctorEmail,
    doctorPhone,
    doctorAddress,
    companyName,
    gstNumber,
    officialEmail,
    contactNumber,
    businessAddress,
    drivingExperienceYears,
  ]);

  // Get validation errors for display
  const getValidationErrors = useMemo(() => {
    const errors: string[] = [];
    
    if (isDoctorConsultation) {
      if (doctorName.trim().length === 0) {
        errors.push('• Full Name: Required field');
      } else if (doctorName.trim().length <= 2) {
        errors.push('• Full Name: Must be at least 3 characters');
      }
      
      if (doctorLicenseNumber.trim().length === 0) {
        errors.push('• Medical Council Registration Number: Required field');
      } else if (!/^[A-Za-z0-9\-\/]{5,20}$/.test(doctorLicenseNumber.trim())) {
        errors.push('• Medical Council Registration Number: Must be 5-20 alphanumeric characters (e.g., MCI-123456)');
      }
      
      if (medicalCouncilName.trim().length === 0) {
        errors.push('• Medical Council Name: Required field');
      } else if (medicalCouncilName.trim().length <= 2) {
        errors.push('• Medical Council Name: Must be at least 3 characters');
      }
      
      if (doctorSpecialty.trim().length === 0) {
        errors.push('• Specialty: Required field');
      } else if (doctorSpecialty.trim().length <= 2) {
        errors.push('• Specialty: Must be at least 3 characters');
      }
      
      if (qualification.trim().length === 0) {
        errors.push('• Qualification: Required field');
      } else if (qualification.trim().length <= 2) {
        errors.push('• Qualification: Must be at least 3 characters');
      }
      
      if (yearsOfExperience.trim().length === 0) {
        errors.push('• Years of Experience: Required field');
      } else if (!/^\d+$/.test(yearsOfExperience.trim())) {
        errors.push('• Years of Experience: Must be a valid number');
      }
      
      if (doctorEmail.trim().length === 0) {
        errors.push('• Email: Required field');
      } else if (!emailRegex.test(doctorEmail.trim())) {
        errors.push('• Email: Must be a valid email address (e.g., doctor@example.com)');
      }
      
      if (doctorPhone.trim().length === 0) {
        errors.push('• Phone Number: Required field');
      } else if (!phoneRegex.test(doctorPhone.replace(/\s/g, ''))) {
        errors.push('• Phone Number: Must be 10-14 digits (e.g., +91 98765 43210)');
      }
      
      if (doctorAddress.trim().length === 0) {
        errors.push('• Clinic/Consultation Address: Required field');
      } else if (doctorAddress.trim().length <= 10) {
        errors.push('• Clinic/Consultation Address: Must be at least 10 characters');
      }
    } else if (isMedicineDelivery) {
      if (companyName.trim().length === 0) {
        errors.push('• Pharmacy Name: Required field');
      } else if (companyName.trim().length <= 2) {
        errors.push('• Pharmacy Name: Must be at least 3 characters');
      }
      
      if (gstNumber.trim().length === 0) {
        errors.push('• GST Number: Required field');
      } else if (!gstRegex.test(gstNumber.trim())) {
        errors.push('• GST Number: Must be a valid 15-character GST format (e.g., 27AAAAA0000A1Z5)');
      }
      
      if (officialEmail.trim().length === 0) {
        errors.push('• Official Email: Required field');
      } else if (!emailRegex.test(officialEmail.trim())) {
        errors.push('• Official Email: Must be a valid email address (e.g., pharmacy@example.com)');
      }
      
      if (contactNumber.trim().length === 0) {
        errors.push('• Contact Number: Required field');
      } else if (!phoneRegex.test(contactNumber.replace(/\s/g, ''))) {
        errors.push('• Contact Number: Must be 10-14 digits (e.g., +91 98765 43210)');
      }
      
      if (businessAddress.trim().length === 0) {
        errors.push('• Pharmacy Address: Required field');
      } else if (businessAddress.trim().length <= 10) {
        errors.push('• Pharmacy Address: Must be at least 10 characters');
      }
    } else if (isActingDrivers) {
      // Personal details validation
      if (companyName.trim().length === 0) {
        errors.push('• Full Name: Required field');
      } else if (companyName.trim().length <= 2) {
        errors.push('• Full Name: Must be at least 3 characters');
      }
      
      if (officialEmail.trim().length === 0) {
        errors.push('• Email: Required field');
      } else if (!emailRegex.test(officialEmail.trim())) {
        errors.push('• Email: Must be a valid email address (e.g., driver@example.com)');
      }
      
      if (contactNumber.trim().length === 0) {
        errors.push('• Phone Number: Required field');
      } else if (!phoneRegex.test(contactNumber.replace(/\s/g, ''))) {
        errors.push('• Phone Number: Must be 10-14 digits (e.g., +91 98765 43210)');
      }
      
      if (businessAddress.trim().length === 0) {
        errors.push('• Address: Required field');
      } else if (businessAddress.trim().length <= 10) {
        errors.push('• Address: Must be at least 10 characters');
      }

      if (drivingExperienceYears.trim().length === 0) {
        errors.push('• Driving Experience (years): Required field');
      } else if (!/^\d+$/.test(drivingExperienceYears.trim())) {
        errors.push('• Driving Experience (years): Must be a valid number');
      }
    } else {
      if (companyName.trim().length === 0) {
        errors.push('• Company Name: Required field');
      } else if (companyName.trim().length <= 2) {
        errors.push('• Company Name: Must be at least 3 characters');
      }
      
      if (gstNumber.trim().length === 0) {
        errors.push('• GST Number: Required field');
      } else if (!gstRegex.test(gstNumber.trim())) {
        errors.push('• GST Number: Must be a valid 15-character GST format (e.g., 27AAAAA0000A1Z5)');
      }
      
      if (officialEmail.trim().length === 0) {
        errors.push('• Official Email: Required field');
      } else if (!emailRegex.test(officialEmail.trim())) {
        errors.push('• Official Email: Must be a valid email address (e.g., company@example.com)');
      }
      
      if (contactNumber.trim().length === 0) {
        errors.push('• Contact Number: Required field');
      } else if (!phoneRegex.test(contactNumber.replace(/\s/g, ''))) {
        errors.push('• Contact Number: Must be 10-14 digits (e.g., +91 98765 43210)');
      }
      
      if (businessAddress.trim().length === 0) {
        errors.push('• Business Address: Required field');
      } else if (businessAddress.trim().length <= 10) {
        errors.push('• Business Address: Must be at least 10 characters');
      }
    }
    
    return errors;
  }, [
    isDoctorConsultation,
    isMedicineDelivery,
    isActingDrivers,
    doctorName,
    doctorLicenseNumber,
    medicalCouncilName,
    doctorSpecialty,
    qualification,
    yearsOfExperience,
    doctorEmail,
    doctorPhone,
    doctorAddress,
    companyName,
    gstNumber,
    officialEmail,
    contactNumber,
    businessAddress,
  ]);

  const handleSaveCompanyDetails = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to continue');
      return;
    }

    if (!isCompanyStepValid) {
      const errors = getValidationErrors;
      if (errors.length > 0) {
        Alert.alert(
          'Validation Error', 
          `Please correct the following fields:\n\n${errors.join('\n')}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Please fill in all required fields correctly');
      }
      return;
    }

    try {
      setLoading(true);
      
      // Map sector key to full-form sector name for DB
      const sectorLabelMap: Record<string, string> = {
        home: 'Home Services',
        healthcare: 'Healthcare',
        automobile: 'Automobile Services',
        appliance: 'Appliance Services',
        actingDrivers: 'Acting Drivers',
      };
      const selectedSectorFull = sector ? (sectorLabelMap[sector as string] || String(sector)) : undefined;

      const verificationData = isDoctorConsultation ? {
        user_id: user.id,
        // Map doctor details to existing backend fields to avoid schema changes
        company_name: doctorName,
        gst_number: doctorLicenseNumber,
        official_email: user.email || '',
        contact_number: (user.user_metadata?.phone as string | undefined) || '',
        business_type: doctorSpecialty,
        business_address: doctorAddress,
        selected_sector: String(sectorName || selectedSectorFull || ''),
        documents_required: ['business_registration', 'doctor_nmc_licence', 'pan_card', 'address_proof', 'government_id'],
      } : isMedicineDelivery ? {
        user_id: user.id,
        company_name: companyName,
        gst_number: gstNumber,
        pan_number: panNumber.trim().toUpperCase(),
        official_email: officialEmail,
        contact_number: contactNumber,
        business_type: '', // Empty for medicine delivery as business type is not required
        business_address: businessAddress,
        selected_sector: String(sectorName || 'Medicine Delivery'),
        documents_required: ['pharmacy_degree_certificate', 'pharmacist_registration_certificate', 'address_proof', 'government_id'],
      } : {
        user_id: user.id,
        company_name: companyName,
        gst_number: gstNumber,
        official_email: officialEmail,
        contact_number: contactNumber,
        business_type: '', // Empty for company details as business type is not required
        business_address: businessAddress,
        selected_sector: String(selectedSectorFull || ''),
        documents_required: isHealthcare 
          ? ['address_proof', 'government_id', 'clinical_establishment_certificate']
          : ['address_proof', 'government_id'],
      };

      if (isDoctorConsultation) {
        // Save doctor details to providers_doctor_details table
        const doctorDetailsResult = await api.doctorDetails.upsertDoctorDetails(
          user.id,
          {
            doctor_name: doctorName,
            medical_registration_number: doctorLicenseNumber,
            specialty: doctorSpecialty,
            address: doctorAddress,
          }
        );
        
        if (doctorDetailsResult.error) {
          Alert.alert('Error', doctorDetailsResult.error.message || 'Failed to save doctor details');
          return;
        }
        
        // Store doctor_details_id for later use when uploading documents
        if (doctorDetailsResult.data) {
          const doctorData = Array.isArray(doctorDetailsResult.data) 
            ? doctorDetailsResult.data[0] 
            : doctorDetailsResult.data;
          // Store in state or local storage for document uploads
          // We'll fetch it when needed during document upload
        }
      } else if (isActingDrivers) {
        // Save acting driver details to providers_acting_drivers table (Step 1 - without Aadhaar)
        // Aadhaar and drivers_licence will be saved in Step 2
        
        // Extract profile photo path if uploaded (saved in profile-images bucket; path in profile_photo column)
        let profilePhotoPath: string | undefined = undefined;
        if (profilePhoto) {
          if (!profilePhoto.startsWith('http')) {
            profilePhotoPath = profilePhoto;
          } else if (profilePhoto.includes('profile-images/')) {
            const pathMatch = profilePhoto.match(/profile-images\/([^?]+)/);
            if (pathMatch) profilePhotoPath = pathMatch[1];
          } else if (profilePhoto.includes('verification-documents')) {
            const pathMatch = profilePhoto.match(/verification-documents\/[^?]+/);
            if (pathMatch) profilePhotoPath = pathMatch[0];
          }
        }
        
        const actingDriverResult = await api.actingDrivers.upsertActingDriverDetails(
          user.id,
          {
            name: companyName,
            phone: contactNumber,
            email: officialEmail,
            address: businessAddress,
            driving_experience_years: drivingExperienceYears ? Number(drivingExperienceYears) : undefined,
            profile_photo: profilePhotoPath,
            about: aboutMe.trim() || undefined,
            // Don't save aadhaar_number here - it will be saved in Step 2
            selected_sector: String(sectorName || selectedSectorFull || 'Acting Drivers'),
          }
        );
        
        if (actingDriverResult.error) {
          Alert.alert('Error', actingDriverResult.error.message || 'Failed to save acting driver details');
          return;
        }
        
        // Store acting_driver_details_id for later use when uploading documents
        if (actingDriverResult.data) {
          const driverData = Array.isArray(actingDriverResult.data) 
            ? actingDriverResult.data[0] 
            : actingDriverResult.data;
          setActingDriverDetailsId(driverData.id);
        }
      } else {
        let result;
        if (verificationId) {
          result = await api.companyVerification.updateCompanyVerification(verificationId, verificationData);
        } else {
          result = await api.companyVerification.createCompanyVerification(verificationData);
          if (result.data) {
            const data = result.data as any;
            if (Array.isArray(data) && data.length > 0) {
              setVerificationId(data[0].id);
            } else if (data && data.id) {
              setVerificationId(data.id);
            }
          }
        }
        if (result.error) {
          Alert.alert('Error', result.error.message);
          return;
        }
      }

      Alert.alert('Success', isDoctorConsultation ? 'Doctor details saved successfully' : isActingDrivers ? 'Personal details saved successfully' : 'Company details saved successfully');
      setStep(2);
    } catch (error) {
      console.error('Error saving company details:', error);
      Alert.alert('Error', 'Failed to save company details');
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (file: any, documentType: string) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to continue');
      return;
    }

    try {
      setLoading(true);

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${documentType}_${Date.now()}.${fileExt}`;
      const filePath = isDoctorConsultation
        ? `verification-documents/${user.id}/doctor/${fileName}`
        : isActingDrivers
        ? `verification-documents/${user.id}/acting-drivers/${fileName}`
        : `verification-documents/${user.id}/${verificationId}/${fileName}`;

      // For React Native, we need to read the file as base64
      console.log('Starting file upload:', { fileName, filePath, fileSize: file.size, mimeType: file.mimeType });
      
      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      console.log('File read successfully, size:', uint8Array.length);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await api.supabase.storage
        .from('verification-documents')
        .upload(filePath, uint8Array, {
          contentType: file.mimeType || 'application/octet-stream',
          upsert: false
        });

      console.log('Upload result:', { uploadData, uploadError });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        Alert.alert('Error', `Failed to upload file: ${uploadError.message}`);
        return;
      }

      // Get public URL
      const { data: urlData } = api.supabase.storage
        .from('verification-documents')
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;

      if (isDoctorConsultation) {
        // Get doctor_details_id first
        const doctorDetailsResult = await api.doctorDetails.getDoctorDetails(user.id);
        let doctorDetailsId: string | null = null;
        
        if (doctorDetailsResult.data && !doctorDetailsResult.error) {
          const doctorData = Array.isArray(doctorDetailsResult.data) 
            ? doctorDetailsResult.data[0] 
            : doctorDetailsResult.data;
          doctorDetailsId = doctorData?.id || null;
        }
        
        // Save document to providers_doctor_documents table
        const docResult = await api.doctorDocuments.insertDoctorDocument({
          user_id: user.id,
          doctor_details_id: doctorDetailsId,
          document_type: documentType,
          document_name: file.name,
          file_url: fileUrl,
          file_size: file.size || null,
          mime_type: file.mimeType || null,
          document_status: 'approved', // Auto-approve for now
        });
        
        if (docResult.error) {
          Alert.alert('Error', docResult.error.message || 'Failed to save document');
          return;
        }
      } else if (isActingDrivers) {
        // Get acting_driver_details_id if not already set
        let detailsId = actingDriverDetailsId;
        if (!detailsId) {
          const driverResult = await api.actingDrivers.getActingDriverDetails(user.id);
          if (driverResult.data && !driverResult.error) {
            detailsId = driverResult.data.id;
            setActingDriverDetailsId(detailsId);
          }
        }
        
        if (!detailsId) {
          Alert.alert('Error', 'Please save personal details first');
          return;
        }
        
        // Store the file path (relative path within verification-documents bucket) instead of full URL
        // Format: verification-documents/{user_id}/acting-drivers/{fileName}
        const storagePath = filePath; // This is already the relative path: verification-documents/...
        
        // Update drivers_licence field with the storage path
        const updateResult = await api.actingDrivers.updateActingDriverDetails(detailsId, {
          drivers_licence: storagePath,
        });
        
        if (updateResult.error) {
          Alert.alert('Error', updateResult.error.message || 'Failed to save driving licence');
          return;
        }
        
        // Update local state to reflect the uploaded file (use public URL for display)
        setUploads((prev) => ({
          ...prev,
          gstCert: {
            name: file.name,
            uri: fileUrl, // Use public URL for local display
            size: file.size,
            mimeType: file.mimeType,
          },
        }));
      } else {
        // Save document record to company verification documents for non-doctor flows
        const { error } = await api.companyVerification.uploadVerificationDocument({
          verification_id: verificationId!,
          user_id: user.id,
          document_type: documentType,
          document_name: file.name,
          file_url: fileUrl,
          file_size: file.size,
          mime_type: file.mimeType,
        });
        if (error) {
          Alert.alert('Error', error.message);
          return;
        }
      }

      Alert.alert('Success', 'Document uploaded successfully');
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (isActingDrivers && !actingDriverDetailsId) {
      Alert.alert('Error', 'Please complete personal details first');
      return;
    }
    if (!isDoctorConsultation && !isMedicineDelivery && !isActingDrivers && !verificationId) {
      Alert.alert('Error', 'Please complete company details first');
      return;
    }

    // Validate PAN/Aadhaar number
    if (isActingDrivers) {
      if (!panNumber.trim() || !aadhaarRegex.test(panNumber.trim())) {
        Alert.alert('Invalid Aadhaar Number', 'Please enter a valid 12-digit Aadhaar number');
        return;
      }
    } else {
      if (!panNumber.trim() || !panRegex.test(panNumber.trim().toUpperCase())) {
        Alert.alert('Invalid PAN Number', 'Please enter a valid PAN number (Format: ABCDE1234F)');
        return;
      }
    }

    // Validate GST number for all sectors except doctor consultation and acting drivers
    if (!isDoctorConsultation && !isActingDrivers) {
      if (!gstNumber.trim() || !gstRegex.test(gstNumber.trim())) {
        Alert.alert('Invalid GST Registration Number', 'Please enter a valid GST registration number');
        return;
      }
    }

    // Check if all required documents are uploaded
    const requiredDocs = isMedicineDelivery
      ? (isHealthcare 
          ? (['businessReg', 'clinicalEstablishmentCert'] as const)
          : (['businessReg'] as const))
      : (isHealthcare 
          ? (['clinicalEstablishmentCert'] as const)
          : ([] as const));
    type RequiredDocKey = typeof requiredDocs[number];
    const missingDocs = requiredDocs.filter(key => !uploads[key]) as RequiredDocKey[];
    
    if (missingDocs.length > 0) {
      const docNames: Record<RequiredDocKey, string> = {
        businessReg: 'Degree Certificate (B.Pharm/D.Pharm)',
        clinicalEstablishmentCert: 'Clinical Establishment Certificate',
      };
      const missingDocNames = missingDocs.map((key) => docNames[key]).join(', ');
      Alert.alert('Missing Documents', `Please upload the following required documents: ${missingDocNames}`);
      return;
    }
    
    // Check if Doctor NMC Licence is uploaded for doctor consultation
    if (isDoctorConsultation && !uploads.gstCert) {
      Alert.alert('Missing Document', 'Please upload the Doctor NMC Licence');
      return;
    }

    // For Acting Drivers, ensure Driving Licence photo is uploaded
    if (isActingDrivers && !uploads.gstCert) {
      Alert.alert('Missing Document', 'Please upload your Driving Licence photo');
      return;
    }

    try {
      setLoading(true);
      
      // Update verification data with PAN and GST numbers for relevant sectors
      if (!isDoctorConsultation && !isActingDrivers && verificationId) {
        await api.companyVerification.updateCompanyVerification(verificationId, {
          pan_number: panNumber.trim().toUpperCase(),
          gst_number: gstNumber.trim().toUpperCase(),
        } as any);
      }
      
      // Update Aadhaar number for acting drivers in Step 2
      // Note: drivers_licence path is already saved when document was uploaded in uploadDocument function
      if (isActingDrivers && actingDriverDetailsId) {
        const updateData: any = {
          aadhaar_number: panNumber.trim(),
        };
        
        // drivers_licence storage path should already be saved in the table from uploadDocument function
        // No need to update it again here unless it wasn't saved during upload
        await api.actingDrivers.updateActingDriverDetails(actingDriverDetailsId, updateData);
      }
      
      if (isActingDrivers) {
        // Auto-approve verification for acting drivers
        const { error } = await api.actingDrivers.updateVerificationStatus(
          actingDriverDetailsId!,
          'approved',
          'All documents verified and approved automatically'
        );
        if (error) {
          Alert.alert('Error', error.message);
          return;
        }
      } else if (!isDoctorConsultation) {
        // Auto-approve verification since all documents are auto-approved (non-doctor flow)
        const { error } = await api.companyVerification.updateVerificationStatus(
          verificationId!,
          'approved',
          'All documents verified and approved automatically'
        );
        if (error) {
          Alert.alert('Error', error.message);
          return;
        }
      }

      // Also update local KYC state
      setKyc({ uploaded: true, data: { uploads } });

      // Refresh verification status to ensure navigation works correctly
      await refreshVerification();

      // Navigate directly to step 3 without showing alert
      setStep(3);
    } catch (error) {
      console.error('Error submitting verification:', error);
      Alert.alert('Error', 'Failed to submit for verification');
    } finally {
      setLoading(false);
    }
  };

  const renderStepHeader = () => (
    <View style={styles.topHeader}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={24} color="#0b1960" />
      </TouchableOpacity>
      
      <Image 
        source={require('../../assets/logo.png')} 
        style={styles.logoImage}
        resizeMode="contain"
      />
      <View style={styles.stepsTabs}>
        <TouchableOpacity 
          style={[styles.tab, step===1 && styles.activeTab]} 
          onPress={() => setStep(1)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, step===1 && styles.activeTabText]}>
            {isDoctorConsultation
              ? 'Doctor Details'
              : isMedicineDelivery
              ? 'Pharmacy Details'
              : isActingDrivers
              ? 'Personal Details'
              : 'Company Details'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, step===2 && styles.activeTab]} 
          onPress={() => setStep(2)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, step===2 && styles.activeTabText]}>
            {isActingDrivers ? 'Aadhaar & Licence' : 'Upload Documents'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, step===3 && styles.activeTab]} 
          disabled={true}
          activeOpacity={1}
        >
          <Text style={[styles.tabText, step===3 && styles.activeTabText]}>Verification</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const Step1 = (
    <View style={styles.cardContainer}>
      <Text style={styles.cardTitle}>
        {isDoctorConsultation
          ? 'Doctor Details'
          : isMedicineDelivery
          ? 'Pharmacy Details'
          : isActingDrivers
          ? 'Personal Details'
          : 'Company Details'}
      </Text>
      {/* Selected sector from previous screen */}
      {sector ? (
        <View style={styles.sectorRow}>
          <Text style={styles.sectorLabel}>Selected Sector</Text>
          <View style={styles.sectorChip}>
            <Text style={styles.sectorChipText}>
              {({
                home: 'Home Services',
                healthcare: sectorName || 'Healthcare',
                automobile: 'Automobile Services',
                appliance: 'Appliance Services',
                actingDrivers: 'Acting Drivers',
              } as Record<string, string>)[sector as string] || String(sector)}
            </Text>
          </View>
        </View>
      ) : null}

      {!isDoctorConsultation && !isMedicineDelivery && !isActingDrivers && (
        <>
          <Text style={styles.label}>Company Name</Text>
          <TextInput
            style={[styles.input, companyName.trim().length <= 2 && styles.inputDefault]}
            placeholder="Enter your company name"
            placeholderTextColor="#8E9BB9"
            value={companyName}
            onChangeText={setCompanyName}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>GST Number</Text>
          <TextInput
            style={[styles.input, gstNumber && !gstRegex.test(gstNumber) && styles.inputError]}
            placeholder="Enter GST number"
            placeholderTextColor="#8E9BB9"
            autoCapitalize="characters"
            value={gstNumber}
            onChangeText={setGstNumber}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Official Email</Text>
          <TextInput
            style={[styles.input, officialEmail && !emailRegex.test(officialEmail) && styles.inputError]}
            placeholder="company@example.com"
            placeholderTextColor="#8E9BB9"
            keyboardType="email-address"
            autoCapitalize="none"
            value={officialEmail}
            onChangeText={setOfficialEmail}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Contact Number</Text>
          <TextInput
            style={[styles.input, contactNumber && !phoneRegex.test(contactNumber.replace(/\s/g, '')) && styles.inputError]}
            placeholder="+91 98765 43210"
            placeholderTextColor="#8E9BB9"
            keyboardType="phone-pad"
            value={contactNumber}
            onChangeText={setContactNumber}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Business Address</Text>
          <TextInput
            style={[styles.input, styles.textArea, businessAddress.trim().length <= 10 && styles.inputDefault]}
            placeholder="Enter complete business address"
            placeholderTextColor="#8E9BB9"
            multiline
            numberOfLines={3}
            value={businessAddress}
            onChangeText={setBusinessAddress}
            returnKeyType="done"
            blurOnSubmit={true}
          />
        </>
      )}

      {isMedicineDelivery && (
        <>
          <Text style={styles.label}>Pharmacy Name</Text>
          <TextInput
            style={[styles.input, companyName.trim().length <= 2 && styles.inputDefault]}
            placeholder="Enter pharmacy name"
            placeholderTextColor="#8E9BB9"
            value={companyName}
            onChangeText={setCompanyName}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>GST Number</Text>
          <TextInput
            style={[styles.input, gstNumber && !gstRegex.test(gstNumber) && styles.inputError]}
            placeholder="Enter GST number"
            placeholderTextColor="#8E9BB9"
            autoCapitalize="characters"
            value={gstNumber}
            onChangeText={setGstNumber}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Official Email</Text>
          <TextInput
            style={[styles.input, officialEmail && !emailRegex.test(officialEmail) && styles.inputError]}
            placeholder="pharmacy@example.com"
            placeholderTextColor="#8E9BB9"
            keyboardType="email-address"
            autoCapitalize="none"
            value={officialEmail}
            onChangeText={setOfficialEmail}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Contact Number</Text>
          <TextInput
            style={[styles.input, contactNumber && !phoneRegex.test(contactNumber.replace(/\s/g, '')) && styles.inputError]}
            placeholder="+91 98765 43210"
            placeholderTextColor="#8E9BB9"
            keyboardType="phone-pad"
            value={contactNumber}
            onChangeText={setContactNumber}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Pharmacy Address</Text>
          <TextInput
            style={[styles.input, styles.textArea, businessAddress.trim().length <= 10 && styles.inputDefault]}
            placeholder="Enter complete pharmacy address"
            placeholderTextColor="#8E9BB9"
            multiline
            numberOfLines={3}
            value={businessAddress}
            onChangeText={setBusinessAddress}
            returnKeyType="done"
            blurOnSubmit={true}
          />
        </>
      )}

      {isDoctorConsultation && (
        <>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={[styles.input, doctorName.trim().length <= 2 && styles.inputDefault]}
            placeholder="Enter doctor's full name"
            placeholderTextColor="#8E9BB9"
            value={doctorName}
            onChangeText={setDoctorName}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Medical Council Registration Number *</Text>
          <TextInput
            style={[styles.input, doctorLicenseNumber.trim().length > 0 && !/^[A-Za-z0-9\-\/]{5,20}$/.test(doctorLicenseNumber) && styles.inputError]}
            placeholder="MCI-123456"
            placeholderTextColor="#8E9BB9"
            autoCapitalize="characters"
            value={doctorLicenseNumber}
            onChangeText={setDoctorLicenseNumber}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Medical Council Name *</Text>
          <TextInput
            style={[styles.input, medicalCouncilName.trim().length <= 2 && styles.inputDefault]}
            placeholder="e.g., Maharashtra Medical Council"
            placeholderTextColor="#8E9BB9"
            value={medicalCouncilName}
            onChangeText={setMedicalCouncilName}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Specialty *</Text>
          <TextInput
            style={[styles.input, doctorSpecialty.trim().length <= 2 && styles.inputDefault]}
            placeholder="e.g., Cardiology, Pediatrics, General Physician"
            placeholderTextColor="#8E9BB9"
            value={doctorSpecialty}
            onChangeText={setDoctorSpecialty}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Qualification *</Text>
          <TextInput
            style={[styles.input, qualification.trim().length <= 2 && styles.inputDefault]}
            placeholder="e.g., MBBS, MD, MS, DNB"
            placeholderTextColor="#8E9BB9"
            value={qualification}
            onChangeText={setQualification}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Years of Experience *</Text>
          <TextInput
            style={[styles.input, yearsOfExperience.trim().length > 0 && !/^\d+$/.test(yearsOfExperience.trim()) && styles.inputError]}
            placeholder="e.g., 5"
            placeholderTextColor="#8E9BB9"
            keyboardType="numeric"
            value={yearsOfExperience}
            onChangeText={setYearsOfExperience}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={[styles.input, doctorEmail.trim().length > 0 && !emailRegex.test(doctorEmail.trim()) && styles.inputError]}
            placeholder="doctor@example.com"
            placeholderTextColor="#8E9BB9"
            keyboardType="email-address"
            autoCapitalize="none"
            value={doctorEmail}
            onChangeText={setDoctorEmail}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={[styles.input, doctorPhone.trim().length > 0 && !phoneRegex.test(doctorPhone.replace(/\s/g, '')) && styles.inputError]}
            placeholder="+91 98765 43210"
            placeholderTextColor="#8E9BB9"
            keyboardType="phone-pad"
            value={doctorPhone}
            onChangeText={setDoctorPhone}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Clinic/Consultation Address *</Text>
          <TextInput
            style={[styles.input, styles.textArea, doctorAddress.trim().length <= 10 && styles.inputDefault]}
            placeholder="Enter complete clinic or consultation address"
            placeholderTextColor="#8E9BB9"
            multiline
            numberOfLines={3}
            value={doctorAddress}
            onChangeText={setDoctorAddress}
            returnKeyType="done"
            blurOnSubmit={true}
          />
        </>
      )}

      {isActingDrivers && (
        <>
          {/* Profile Photo Section */}
          <Text style={styles.label}>Profile Photo</Text>
          <View style={styles.profilePhotoContainer}>
            {profilePhoto ? (
              <View style={styles.profilePhotoWrapper}>
                <Image source={{ uri: profilePhoto }} style={styles.profilePhoto} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => {
                    Alert.alert(
                      'Remove Photo',
                      'Are you sure you want to remove this photo?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => {
                            setProfilePhoto(null);
                            // Optionally delete from storage and database here
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.profilePhotoPlaceholder, uploadingProfilePhoto && styles.profilePhotoPlaceholderUploading]}
                onPress={handleProfilePhotoUpload}
                disabled={uploadingProfilePhoto}
              >
                {uploadingProfilePhoto ? (
                  <ActivityIndicator size="small" color="#0b1960" />
                ) : (
                  <>
                    <Ionicons name="camera" size={32} color="#8E9BB9" />
                    <Text style={styles.profilePhotoPlaceholderText}>Take Selfie or Upload Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={[styles.input, companyName.trim().length <= 2 && styles.inputDefault]}
            placeholder="Enter your full name"
            placeholderTextColor="#8E9BB9"
            value={companyName}
            onChangeText={setCompanyName}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={[styles.input, contactNumber && !phoneRegex.test(contactNumber.replace(/\s/g, '')) && styles.inputError]}
            placeholder="+91 98765 43210"
            placeholderTextColor="#8E9BB9"
            keyboardType="phone-pad"
            value={contactNumber}
            onChangeText={setContactNumber}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, officialEmail && !emailRegex.test(officialEmail) && styles.inputError]}
            placeholder="you@example.com"
            placeholderTextColor="#8E9BB9"
            keyboardType="email-address"
            autoCapitalize="none"
            value={officialEmail}
            onChangeText={setOfficialEmail}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Driving experience in years</Text>
          <TextInput
            style={[
              styles.input,
              drivingExperienceYears.trim().length > 0 &&
                !/^\d+$/.test(drivingExperienceYears.trim()) &&
                styles.inputError,
            ]}
            placeholder="e.g., 5"
            placeholderTextColor="#8E9BB9"
            keyboardType="numeric"
            value={drivingExperienceYears}
            onChangeText={setDrivingExperienceYears}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, styles.textArea, businessAddress.trim().length <= 10 && styles.inputDefault]}
            placeholder="Enter your full residential address"
            placeholderTextColor="#8E9BB9"
            multiline
            numberOfLines={3}
            value={businessAddress}
            onChangeText={setBusinessAddress}
            returnKeyType="next"
            blurOnSubmit={false}
          />

          <Text style={styles.label}>About Me (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textAreaLarge]}
            placeholder="Tell customers about yourself - your experience, services you offer, why they should hire you..."
            placeholderTextColor="#8E9BB9"
            multiline
            numberOfLines={5}
            value={aboutMe}
            onChangeText={setAboutMe}
            returnKeyType="done"
            blurOnSubmit={true}
            maxLength={500}
          />
          <Text style={styles.charCount}>{aboutMe.length}/500 characters</Text>
        </>
      )}

      {/* Validation Error Messages */}
      {isCompanyStepFilled && !isCompanyStepValid && getValidationErrors.length > 0 && (
        <View style={styles.validationContainer}>
          <View style={styles.validationHeader}>
            <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
            <Text style={styles.validationTitle}>Please correct the following fields:</Text>
          </View>
          <View style={styles.validationErrorsList}>
            {getValidationErrors.map((error, index) => (
              <Text key={index} style={styles.validationErrorText}>{error}</Text>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity 
        onPress={handleSaveCompanyDetails} 
        activeOpacity={0.8}
        disabled={!isCompanyStepFilled || loading}
        style={[styles.primaryBtn, (!isCompanyStepFilled || loading) && styles.primaryBtnDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <LinearGradient
            colors={['#004c8f', '#0c1a5d']}
            style={styles.primaryBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Text style={styles.primaryBtnText}>Save & Continue</Text>
          </LinearGradient>
        )}
      </TouchableOpacity>
    </View>
  );

  const UploadField = ({title, subtitle, stateKey}: {title: string, subtitle?: string, stateKey: UploadKey}) => {
    const file = uploads[stateKey];
    const isUploading = uploadingFiles.has(stateKey);
    const isImage = file?.mimeType?.startsWith('image') || /\.(png|jpg|jpeg|gif)$/i.test(file?.name || '');
    return (
      <View style={styles.uploadCard}>
        <Text style={styles.uploadTitle}>{title}</Text>
        {subtitle ? <Text style={styles.uploadSubtitle}>{subtitle}</Text> : null}

        <View style={styles.uploadPreviewWrap}>
          {!file ? (
            <TouchableOpacity 
              style={[styles.uploadBox, isUploading && styles.uploadBoxUploading]} 
              activeOpacity={0.8} 
              onPress={() => !isUploading && selectSource(stateKey)}
              disabled={isUploading}
            >
              {isUploading ? (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color="#0b1960" />
                  <Text style={styles.uploadingText}>Uploading...</Text>
                </View>
              ) : (
                <Text style={styles.uploadHint}>Upload PDF or JPEG (Max 5MB)</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.uploadBox, styles.uploadFilled]}>
              {isImage ? (
                <Image source={{ uri: file.uri }} style={styles.previewImage} resizeMode="cover" />
              ) : (
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              )}
              <TouchableOpacity 
                style={styles.removeBadge} 
                onPress={() => !isUploading && removeDocument(stateKey)}
                disabled={isUploading}
              >
                <Text style={styles.removeBadgeText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const Step2 = (
    <View style={styles.cardContainer}>
      <Text style={styles.cardTitle}>
        {isActingDrivers ? 'Aadhaar & Licence Verification' : 'Authorized Signatory Verification'}
      </Text>
      
      {!isActingDrivers && (
        <>
          <Text style={styles.label}>Director/Owner Name</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Enter full name" 
            placeholderTextColor="#8E9BB9"
            returnKeyType="done"
            blurOnSubmit={true}
          />
        </>
      )}

      <Text style={styles.label}>{isActingDrivers ? 'Aadhaar Number *' : 'PAN Number *'}</Text>
      <TextInput
        style={[
          styles.input,
          panNumber &&
            (isActingDrivers
              ? !aadhaarRegex.test(panNumber.trim())
              : !panRegex.test(panNumber.trim().toUpperCase())) &&
            styles.inputError
        ]}
        placeholder={isActingDrivers ? 'Enter 12-digit Aadhaar number' : 'Enter PAN number (e.g., ABCDE1234F)'}
        placeholderTextColor="#8E9BB9"
        autoCapitalize={isActingDrivers ? 'none' : 'characters'}
        maxLength={isActingDrivers ? 12 : 10}
        keyboardType={isActingDrivers ? 'numeric' : 'default'}
        value={panNumber}
        onChangeText={(text) =>
          setPanNumber(isActingDrivers ? text.replace(/\D/g, '') : text.toUpperCase())
        }
        returnKeyType="next"
        blurOnSubmit={false}
      />
      {panNumber &&
        (isActingDrivers
          ? !aadhaarRegex.test(panNumber.trim())
          : !panRegex.test(panNumber.trim().toUpperCase())) && (
          <Text style={styles.errorText}>
            {isActingDrivers
              ? 'Please enter a valid 12-digit Aadhaar number'
              : 'Please enter a valid PAN number (Format: ABCDE1234F)'}
          </Text>
        )}

      <Text style={styles.label}>
        {isDoctorConsultation
          ? 'Doctor NMC Licence *'
          : isActingDrivers
          ? 'Driving Licence Photo *'
          : 'GST Registration Number *'}
      </Text>
      {isDoctorConsultation ? (
        <UploadField
          title="Doctor NMC Licence *"
          subtitle="Upload your NMC registration licence"
          stateKey="gstCert"
        />
      ) : isActingDrivers ? (
        <UploadField
          title="Upload a clear photo of your driving licence"
          
          stateKey="gstCert"
        />
      ) : (
        <>
          <TextInput
            style={[styles.input, gstNumber && !gstRegex.test(gstNumber.trim()) && styles.inputError]}
            placeholder="Enter GST registration number"
            placeholderTextColor="#8E9BB9"
            autoCapitalize="characters"
            value={gstNumber}
            onChangeText={(text) => setGstNumber(text.toUpperCase())}
            returnKeyType="next"
            blurOnSubmit={false}
          />
          {gstNumber && !gstRegex.test(gstNumber.trim()) && (
            <Text style={styles.errorText}>Please enter a valid GST registration number</Text>
          )}
        </>
      )}

      {isMedicineDelivery && (
        <UploadField
          title="Degree Certificate (B.Pharm/D.Pharm) *"
          stateKey="businessReg"
        />
      )}

      {isHealthcare && (
        <UploadField
          title="Clinical Establishment Certificate *"
          stateKey="clinicalEstablishmentCert"
        />
      )}

      {/* Company verification is now integrated into this screen */}

      <TouchableOpacity 
        onPress={handleSubmitVerification} 
        activeOpacity={0.8}
        disabled={
          loading ||
          // Aadhaar/PAN validity
          (isActingDrivers
            ? (!panNumber.trim() || !aadhaarRegex.test(panNumber.trim()))
            : (!panNumber.trim() || !panRegex.test(panNumber.trim().toUpperCase()))) ||
          // GST validity for non-doctor, non-acting drivers
          (!isDoctorConsultation && !isActingDrivers && (!gstNumber.trim() || !gstRegex.test(gstNumber.trim()))) ||
          // Required uploads
          (isDoctorConsultation && !uploads.gstCert) ||
          (isMedicineDelivery && !uploads.businessReg) ||
          (isHealthcare && !uploads.clinicalEstablishmentCert) ||
          (isActingDrivers && !uploads.gstCert)
        }
        style={[
          styles.primaryBtn,
          (loading ||
            (isActingDrivers
              ? (!panNumber.trim() || !aadhaarRegex.test(panNumber.trim()))
              : (!panNumber.trim() || !panRegex.test(panNumber.trim().toUpperCase()))) ||
            (!isDoctorConsultation && !isActingDrivers && (!gstNumber.trim() || !gstRegex.test(gstNumber.trim()))) ||
            (isDoctorConsultation && !uploads.gstCert) ||
            (isMedicineDelivery && !uploads.businessReg) ||
            (isHealthcare && !uploads.clinicalEstablishmentCert) ||
            (isActingDrivers && !uploads.gstCert)) && styles.primaryBtnDisabled
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <LinearGradient
            colors={['#004c8f', '#0c1a5d']}
            style={styles.primaryBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Text style={styles.primaryBtnText}>Submit for Verification</Text>
          </LinearGradient>
        )}
      </TouchableOpacity>
    </View>
  );

  const Step3 = (() => {
    // review | verified — in real app, drive this from backend
    const [status, setStatus] = useState('review');
    const isVerified = status === 'verified';

    // Animation values
    const pulse = useRef(new Animated.Value(1)).current;
    const scaleIn = useRef(new Animated.Value(0)).current;
    const checkmarkScale = useRef(new Animated.Value(0)).current;
    const checkmarkOpacity = useRef(new Animated.Value(0)).current;
    const circleScale = useRef(new Animated.Value(0)).current;
    const circleOpacity = useRef(new Animated.Value(0)).current;
    const successPulse = useRef(new Animated.Value(1)).current;
    const textScale = useRef(new Animated.Value(0)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (isVerified) {
        // Animate the success state
        Animated.sequence([
          // First, scale in the circle
          Animated.parallel([
            Animated.timing(circleScale, { 
              toValue: 1, 
              duration: 300, 
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true 
            }),
            Animated.timing(circleOpacity, { 
              toValue: 1, 
              duration: 300, 
              useNativeDriver: true 
            })
          ]),
          // Then, animate the checkmark
          Animated.parallel([
            Animated.timing(checkmarkScale, { 
              toValue: 1, 
              duration: 400, 
              easing: Easing.out(Easing.back(1.2)),
              useNativeDriver: true 
            }),
            Animated.timing(checkmarkOpacity, { 
              toValue: 1, 
              duration: 400, 
              useNativeDriver: true 
            })
          ]),
          // Animate the success text
          Animated.parallel([
            Animated.timing(textScale, { 
              toValue: 1, 
              duration: 300, 
              easing: Easing.out(Easing.back(1.1)),
              useNativeDriver: true 
            }),
            Animated.timing(textOpacity, { 
              toValue: 1, 
              duration: 300, 
              useNativeDriver: true 
            })
          ]),
          // Finally, add a subtle pulse effect
          Animated.loop(
            Animated.sequence([
              Animated.timing(successPulse, { 
                toValue: 1.05, 
                duration: 1000, 
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true 
              }),
              Animated.timing(successPulse, { 
                toValue: 1, 
                duration: 1000, 
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true 
              })
            ])
          )
        ]).start();
      } else {
        // Reset animations for review state
        checkmarkScale.setValue(0);
        checkmarkOpacity.setValue(0);
        circleScale.setValue(0);
        circleOpacity.setValue(0);
        textScale.setValue(0);
        textOpacity.setValue(0);
        
        // search pulse loop for review state
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1.1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        ).start();
      }
    }, [isVerified]);

    // Auto-switch from review to verified after a short delay when on step 3
    useEffect(() => {
      if (step === 3 && status === 'review') {
        const timer = setTimeout(() => setStatus('verified'), 2500);
        return () => clearTimeout(timer);
      }
      return undefined;
    }, [step, status]);
    return (
      <View>
        
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusIllustration}>
            {!isVerified ? (
              <Animated.View style={[styles.circle, { transform: [{ scale: pulse }] }]} />
            ) : (
              <Animated.View 
                style={[
                  styles.successContainer,
                  { transform: [{ scale: successPulse }] }
                ]}
              >
                {/* Animated circle background */}
                <Animated.View 
                  style={[
                    styles.successCircle, 
                    { 
                      transform: [{ scale: circleScale }],
                      opacity: circleOpacity
                    }
                  ]} 
                />
                {/* Animated checkmark */}
                <Animated.View 
                  style={[
                    styles.checkmarkContainer,
                    {
                      transform: [{ scale: checkmarkScale }],
                      opacity: checkmarkOpacity
                    }
                  ]}
                >
                  <Ionicons name="checkmark" size={50} color="#ffffff" />
                </Animated.View>
              </Animated.View>
            )}
          </View>
          {isVerified ? (
            <Animated.Text 
              style={[
                styles.statusTitle, 
                styles.statusTitleSuccess,
                {
                  transform: [{ scale: textScale }],
                  opacity: textOpacity
                }
              ]}
            >
              Your documents verified successfully!
            </Animated.Text>
          ) : (
            <Text style={styles.statusTitle}>
              Documents Under Review
            </Text>
          )}
          {!isVerified && (
            <Text style={styles.reviewSub}>Our team is verifying your documents. This usually takes less than 24 hours.</Text>
          )}
          {isVerified && (
            <Animated.Text 
              style={[
                styles.celebrationText,
                {
                  transform: [{ scale: textScale }],
                  opacity: textOpacity
                }
              ]}
            >
              
            </Animated.Text>
          )}
        </View>

        {/* Steps Card */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsHeading}>Verification Steps</Text>

          <View style={styles.stepRow}>
            <View style={styles.stepIconContainer}>
              <View style={[styles.stepIcon, styles.stepIconBlue]} />
              <View style={styles.stepLine} />
            </View>
            <View style={styles.stepTextWrap}>
              <Text style={styles.stepTitle}>Document Upload</Text>
              <Text style={styles.stepSub}>ID and business documents received</Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepIconContainer}>
              <View style={[styles.stepIcon, styles.stepIconIndigo]} />
              <View style={styles.stepLine} />
            </View>
            <View style={styles.stepTextWrap}>
              <Text style={styles.stepTitle}>Verification in Progress</Text>
              <Text style={styles.stepSub}>Our team is reviewing your documents</Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepIconContainer}>
              <View style={[styles.stepIcon, isVerified ? styles.stepIconGreen : styles.stepIconGrey]} />
            </View>
            <View style={styles.stepTextWrap}>
              <Text style={[styles.stepTitle, isVerified && styles.stepTitleSuccess]}>Verification {isVerified ? 'successful' : 'Complete'}</Text>
              <Text style={styles.stepSub}>Final approval and account activation</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={() => {
          if (isDoctorConsultation) {
            // After doctor KYC, go straight to Doctor Dashboard and lock into that flow
            navigation.reset({
              index: 0,
              routes: [{ name: 'DoctorDashboard' as never }],
            } as never);
          } else if (isMedicineDelivery) {
            navigation.reset({ index: 0, routes: [{ name: 'PharmDashboard' as never }] } as never);
          } else if (isActingDrivers) {
            // After acting drivers complete verification, send them to services selection first
            navigation.reset({ index: 0, routes: [{ name: 'ActingDriverServices' as never }] } as never);
          } else {
            navigation.reset({ index: 0, routes: [{ name: 'Dashboard' as never }] } as never);
          }
        }} activeOpacity={0.8} style={{marginTop:16}}>
          <LinearGradient
            colors={['#004c8f', '#0c1a5d']}
            style={styles.primaryBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  })();

  if (loading && step === 1) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0b1960" />
        <Text style={styles.loadingText}>Loading verification data...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {renderStepHeader()}
        {step===1 && Step1}
        {step===2 && Step2}
        {step===3 && Step3}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContainer: { 
    flexGrow: 1, 
    padding: 20, 
    paddingTop: 28,
    paddingBottom: 40 
  },
  scrollContent: { paddingBottom: 20 },
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
  topHeader: { alignItems:'center', marginBottom: 12, marginTop: 20 },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: 30,
    backgroundColor: '#E6ECFF',
    marginBottom: 10,
  },
  
  logoImage: { width: 120, height: 50 , marginTop: -50},
  titleContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
  },
  title: { color:'#0F172A', fontWeight:'700' },
  stepsTabs: { flexDirection:'row', backgroundColor:'#EEF2FF', borderRadius: 14, overflow:'hidden', marginTop: 10, width: '100%' },
  tab: { paddingVertical: 8, paddingHorizontal: 12, flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color:'#6B7280', fontSize: 13, textAlign: 'center' },
  activeTab: { backgroundColor:'#e6e8ff' },
  activeTabText: { color:'#0b1960', fontWeight: '600' },
  cardContainer: { backgroundColor:'#ffffff', borderRadius: 16, padding: 16, marginTop: 14 },
  cardContainerCenter: { backgroundColor:'#ffffff', borderRadius: 16, padding: 16, marginTop: 14, alignItems:'center' },
  cardTitle: { color:'#0b1960', fontWeight:'700', fontSize:18, marginBottom: 12 },
  sectionTitle: { color:'#0b1960', fontWeight:'700', fontSize:18, marginVertical: 12 },
  label: { color:'#0b1960', fontWeight:'600', marginTop: 8, marginBottom: 6 },
  input: { height: 48, borderRadius: 12, backgroundColor:'#F4F6FB', paddingHorizontal: 12, color:'#000000', marginBottom: 10, borderWidth:1, borderColor:'#E6ECFF' },
  textArea: { height: 80, textAlignVertical: 'top' },
  textAreaLarge: { height: 120, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { color: '#8E9BB9', fontSize: 12, textAlign: 'right', marginTop: -6, marginBottom: 10 },
  inputDefault: { borderColor:'#E6ECFF' },
  inputError: { borderColor:'#FF6B6B' },
  primaryBtn: { borderRadius:12, paddingVertical: 14, paddingHorizontal: 40, alignItems:'center', },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color:'#ffffff', fontWeight:'700' },
  
  // Sector chip (selected sector display)
  sectorRow: { flexDirection:'row', alignItems:'center', marginBottom: 8 },
  sectorLabel: { color:'#5B6B95', marginRight: 8, fontWeight:'600' },
  sectorChip: { backgroundColor:'#EEF2FF', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, borderWidth:1, borderColor:'#E6ECFF' },
  sectorChipText: { color:'#0b1960', fontWeight:'700', fontSize: 12 },
  
  uploadBox: { backgroundColor:'#F4F6FB', borderRadius:12, padding: 14, marginBottom: 10, borderWidth:1, borderColor:'#E6ECFF' },
  uploadBoxUploading: { backgroundColor:'#E6F3FF', borderColor:'#0b1960' },
  uploadTitle: { color:'#0b1960', fontWeight:'700' },
  uploadSubtitle: { color:'#5B6B95', marginTop: 4 },
  uploadHint: { color:'#8E9BB9', marginTop: 6 },
  uploadingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 8 
  },
  uploadingText: { 
    color: '#0b1960', 
    marginLeft: 8, 
    fontWeight: '600' 
  },
  uploadCard: { backgroundColor:'#F8FAFF', borderRadius:12, padding:12, marginBottom:14, borderWidth:1, borderColor:'#EEF2FF' },
  fileName: { color:'#5B6B95', marginTop: 6 },
  uploadPreviewWrap: { marginTop: 8 },
  uploadFilled: { justifyContent:'center', alignItems:'center', position:'relative' },
  previewImage: { width: '100%', height: 160, borderRadius: 8 },
  removeBadge: { position:'absolute', top: 6, right: 6, backgroundColor:'#FF6B6B', borderRadius: 12, width:24, height:24, alignItems:'center', justifyContent:'center' },
  removeBadgeText: { color:'#ffffff', fontWeight:'700', fontSize:16, lineHeight:16 },
  reviewTitle: { color:'#0b1960', fontWeight:'700', fontSize:18 },
  reviewSub: { color:'#5B6B95', textAlign:'center', marginTop: 8 },
  statusCard: { backgroundColor:'#ffffff', borderRadius:16, padding:16, marginTop:14, borderWidth:1, borderColor:'#E6ECFF', alignItems:'center' },
  statusIllustration: { width:'100%', height:140, backgroundColor:'#EAF0FF', borderRadius:12, marginBottom: 10, alignItems:'center', justifyContent:'center' },
  circle: { width: 80, height:80, borderRadius:40, borderWidth:6, borderColor:'#8FB2FF', backgroundColor:'#ffffff' },
  successContainer: { 
    width: 100, 
    height: 100, 
    alignItems: 'center', 
    justifyContent: 'center',
    position: 'relative'
  },
  successCircle: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: '#1DBF73',
    position: 'absolute',
    shadowColor: '#1DBF73',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  checkmarkContainer: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  statusTitle: { color:'#0b1960', fontWeight:'700', fontSize:16, textAlign:'center', marginTop: 4, marginBottom: -15 },
  statusTitleSuccess: { color:'#1DBF73' },
  celebrationText: { 
    color:'#1DBF73', 
    fontSize:14, 
    textAlign:'center', 
    marginTop: 8, 
    fontWeight:'600' 
  },
  stepsCard: { backgroundColor:'#ffffff', borderRadius:16, padding:16, marginTop:14, borderWidth:1, borderColor:'#E6ECFF' },
  stepsHeading: { color:'#0b1960', fontWeight:'700', marginBottom:10 },
  stepRow: { flexDirection:'row', alignItems:'flex-start', marginBottom:12 },
  stepIconContainer: { alignItems:'center', marginRight:12 },
  stepIcon: { width:28, height:28, borderRadius:14 },
  stepLine: { width:2, height:40, backgroundColor:'#E6ECFF', marginTop:4 },
  stepIconBlue: { backgroundColor:'#0A43FF' },
  stepIconIndigo: { backgroundColor:'#6667F3' },
  stepIconGreen: { backgroundColor:'#1DBF73' },
  stepIconGrey: { backgroundColor:'#C7CFEC' },
  stepTextWrap: { flex:1, paddingTop:4 },
  stepTitle: { color:'#0b1960', fontWeight:'700' },
  stepTitleSuccess: { color:'#1DBF73' },
  stepSub: { color:'#5B6B95' },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
  outlineBtn: { borderColor:'#3b5bfd', borderWidth:1, borderRadius:12, paddingVertical:12, paddingHorizontal:16, marginTop: 12 },
  outlineBtnAltText: { color:'#3b5bfd', fontWeight:'700' },
  outlineBtnText: { color:'#3b5bfd', fontWeight:'700' },
  verifSteps: { width:'100%', marginTop: 16 },
  verifItem: { color:'#0b1960', marginBottom: 8 },
  verifItemMuted: { color:'#5B6B95' },
  validationContainer: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },
  validationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  validationTitle: {
    color: '#FF6B6B',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
  },
  validationErrorsList: {
    marginLeft: 28,
  },
  validationErrorText: {
    color: '#C53030',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  profilePhotoContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  profilePhotoWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#E6ECFF',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  profilePhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F4F6FB',
    borderWidth: 2,
    borderColor: '#E6ECFF',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePhotoPlaceholderUploading: {
    borderColor: '#0b1960',
    backgroundColor: '#E6F3FF',
  },
  profilePhotoPlaceholderText: {
    marginTop: 8,
    fontSize: 12,
    color: '#8E9BB9',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});

export default KYCVerificationScreen;
