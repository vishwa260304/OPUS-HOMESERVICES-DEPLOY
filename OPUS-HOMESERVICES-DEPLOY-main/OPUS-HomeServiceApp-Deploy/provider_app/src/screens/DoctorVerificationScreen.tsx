import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image, Alert, Animated, Easing, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { getKyc, setKyc, setSelectedSector } from '../utils/appState';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useVerification } from '../hooks/useVerification';
import { api } from '../lib/api';
import { upsertDoctorDetails } from '../lib/doctorDetailsHelper';
import { moderateScale } from '../utils/responsive';
import { useScreenTracking } from '../hooks/useScreenTracking';
import { trackEvent } from '../services/analytics';

const DoctorVerificationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { refreshVerification } = useVerification();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  
  // Track screen view
  useScreenTracking('Doctor Verification Screen', {
    step: step,
    user_id: user?.id ?? null, // FIXED: Bug 1
  });

  // Doctor professional details form state
  const [fullName, setFullName] = useState('');
  const [medicalCouncilRegNumber, setMedicalCouncilRegNumber] = useState('');
  const [medicalCouncilName, setMedicalCouncilName] = useState('');
  
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [qualification, setQualification] = useState('');
  const [hospital, setHospital] = useState('');
  const [languages, setLanguages] = useState(''); // comma-separated
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');

  // Upload state - Doctor-specific documents
  type UploadKey = 'medicalLicense' | 'educationalCertificate';
  type UploadFile = { name: string; uri: string; size?: number; mimeType?: string } | null;
  const [uploads, setUploads] = useState<Record<UploadKey, UploadFile>>({
    medicalLicense: null,
    educationalCertificate: null,
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
      // Load doctor details to get Aadhar and PAN numbers
      const doctorDetailsResult = await api.doctorDetails.getDoctorDetails(user.id);
      if (doctorDetailsResult.data && !doctorDetailsResult.error) {
        const doctorData = Array.isArray(doctorDetailsResult.data) ? doctorDetailsResult.data[0] : doctorDetailsResult.data;
        if (doctorData?.aadhar_number) {
          setAadharNumber(doctorData.aadhar_number);
        }
        if (doctorData?.pan_number) {
          setPanNumber(doctorData.pan_number);
        }
      }

      // For now, we'll use the same company verification table but with doctor-specific fields
      // In production, you might want a separate doctors_verification table
      const { data, error } = await api.companyVerification.getCompanyVerification(user.id);
      
      if (data && !error) {
        setVerificationId(data.id);
        setFullName(data.company_name || '');
        setMedicalCouncilRegNumber(data.gst_number || ''); // Reusing field for registration number
        setEmail(data.official_email || '');
        setPhoneNumber(data.contact_number || '');
        setClinicAddress(data.business_address || '');

        // Load existing documents and text fields
        if (data.documents) {
          const existingDocs = data.documents.map((doc: any) => ({
            type: doc.document_type,
            name: doc.document_name,
            uri: doc.file_url,
            size: doc.file_size,
            mimeType: doc.mime_type,
            status: doc.document_status,
          }));
          
          const uploadMap: Record<UploadKey, UploadFile> = {
            medicalLicense: null,
            educationalCertificate: null,
          };

          existingDocs.forEach((doc: any) => {
            switch (doc.type) {
              case 'medical_license':
                uploadMap.medicalLicense = doc;
                break;
              case 'educational_certificate':
                uploadMap.educationalCertificate = doc;
                break;
              case 'pan_card':
                // PAN is now a text field, extract from document name or metadata if available
                if (doc.name && doc.name.includes('PAN')) {
                  // Try to extract PAN from document name or use a placeholder
                  setPanNumber(doc.name.replace('PAN', '').trim() || '');
                }
                break;
              case 'aadhar_card':
                // Aadhar is now a text field, extract from document name or metadata if available
                if (doc.name && doc.name.includes('Aadhar')) {
                  // Try to extract Aadhar from document name or use a placeholder
                  setAadharNumber(doc.name.replace('Aadhar', '').trim() || '');
                }
                break;
            }
          });

          setUploads(uploadMap);
        }

        if (data.verification_status === 'approved') {
          setStep(3);
        } else if (data.verification_status === 'under_review') {
          setStep(3);
        } else if (data.documents && data.documents.length > 0) {
          setStep(2);
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
      if (res.canceled || res?.type === 'cancel') return;
      const file = res.assets?.[0] ?? ({
        name: res.name,
        uri: res.uri,
        size: res.size,
        mimeType: res.mimeType,
      } as any);
      
      const documentTypeMap: Record<UploadKey, string> = {
        medicalLicense: 'medical_license',
        educationalCertificate: 'educational_certificate',
      };

      setUploadingFiles(prev => new Set(prev).add(key));
      await uploadDocument(file, documentTypeMap[key]);
      setUploads((prev) => ({ ...prev, [key]: file }));
    } catch (e) {
      console.error('Error picking document:', e);
      Alert.alert('Error', 'Failed to pick document');
    } finally {
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

      const documentTypeMap: Record<UploadKey, string> = {
        medicalLicense: 'medical_license',
        educationalCertificate: 'educational_certificate',
      };

      setUploadingFiles(prev => new Set(prev).add(key));
      await uploadDocument(file, documentTypeMap[key]);
      setUploads((prev) => ({ ...prev, [key]: file }));
    } catch (e) {
      console.error('Error picking image:', e);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const selectSource = (key: UploadKey) => {
    Alert.alert('Upload Document', 'Choose a source', [
      { text: 'Image', onPress: () => pickImage(key) },
      { text: 'Document (PDF)', onPress: () => pickDocument(key) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removeDocument = async (key: UploadKey) => {
    const file = uploads[key];
    if (!file) return;

    try {
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

      setUploads((prev) => ({ ...prev, [key]: null }));
    } catch (error) {
      console.error('Error removing document:', error);
      setUploads((prev) => ({ ...prev, [key]: null }));
    }
  };

  // Validation
  const emailRegex = /^(?:[a-zA-Z0-9_'^&\-]+(?:\.[a-zA-Z0-9_'^&\-]+)*)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  const phoneRegex = /^\+?\d{10,14}$/;
  const regNumberRegex = /^[A-Z0-9]{6,20}$/; // Medical council registration number format
  const aadharRegex = /^\d{12}$/; // Aadhar number should be 12 digits
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/; // PAN format: ABCDE1234F

  const isDoctorDetailsValid = useMemo(() => {
    return (
      fullName.trim().length > 2 &&
      regNumberRegex.test(medicalCouncilRegNumber.trim()) &&
      medicalCouncilName.trim().length > 2 &&
      yearsOfExperience.trim().length > 0 &&
      qualification.trim().length > 2 &&
      hospital.trim().length > 0 &&
      emailRegex.test(email.trim()) &&
      phoneRegex.test(phoneNumber.replace(/\s/g, '')) &&
      clinicAddress.trim().length > 10
    );
  }, [fullName, medicalCouncilRegNumber, medicalCouncilName, yearsOfExperience, qualification, hospital, email, phoneNumber, clinicAddress]);

  const handleSaveDoctorDetails = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to continue');
      return;
    }

    if (!isDoctorDetailsValid) {
      Alert.alert('Error', 'Please fill in all required fields correctly');
      return;
    }

    try {
      setLoading(true);
      // First, persist full doctor details in providers_doctor_details via helper
      const { error: doctorSaveError } = await upsertDoctorDetails(user.id, {
        doctor_name: fullName,
        medical_registration_number: medicalCouncilRegNumber,
        address: clinicAddress,
        medical_council_name: medicalCouncilName,
        qualification,
        hospital,
        languages,
        years_of_experience: yearsOfExperience ? Number(yearsOfExperience) : null,
        email,
        phone_number: phoneNumber,
      });

      if (doctorSaveError) {
        Alert.alert('Error', doctorSaveError.message || 'Failed to save doctor details');
        return;
      }
      
      // Using company verification table but with doctor-specific data
      const verificationData = {
        user_id: user.id,
        company_name: fullName, // Doctor's full name
        gst_number: medicalCouncilRegNumber, // Medical council registration number
        official_email: email,
        contact_number: phoneNumber,
        business_type: `${qualification}`,
        business_address: clinicAddress,
        selected_sector: 'Doctor Consultation',
        documents_required: ['medical_license', 'pan_card', 'aadhar_card', 'educational_certificate'],
      };

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

      Alert.alert('Success', 'Doctor details saved successfully');
      setStep(2);
    } catch (error) {
      console.error('Error saving doctor details:', error);
      Alert.alert('Error', 'Failed to save doctor details');
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

      const fileExt = file.name.split('.').pop();
      const fileName = `${documentType}_${Date.now()}.${fileExt}`;
      const filePath = `verification-documents/${user.id}/doctor/${fileName}`;

      console.log('Starting file upload:', { fileName, filePath, fileSize: file.size, mimeType: file.mimeType });
      
      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      console.log('File read successfully, size:', uint8Array.length);

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

      const { data: urlData } = api.supabase.storage
        .from('verification-documents')
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;

      // Get doctor_details_id to link document properly
      const doctorDetailsResult = await api.doctorDetails.getDoctorDetails(user.id);
      let doctorDetailsId: string | null = null;
      if (doctorDetailsResult.data && !doctorDetailsResult.error) {
        const doctorData = Array.isArray(doctorDetailsResult.data) ? doctorDetailsResult.data[0] : doctorDetailsResult.data;
        doctorDetailsId = doctorData?.id || null;
      }

      // Save to providers_doctor_documents
      const docResult = await api.doctorDocuments.insertDoctorDocument({
        user_id: user.id,
        doctor_details_id: doctorDetailsId,
        document_type: documentType,
        document_name: file.name,
        file_url: fileUrl,
        file_size: file.size || null,
        mime_type: file.mimeType || null,
        document_status: 'approved',
      });

      if (docResult.error) {
        Alert.alert('Error', docResult.error.message || 'Failed to save document');
        return;
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
    if (!verificationId) {
      Alert.alert('Error', 'Please complete doctor details first');
      return;
    }

    // Validate Aadhar number
    if (!aadharNumber.trim() || !aadharRegex.test(aadharNumber.trim())) {
      Alert.alert('Invalid Aadhar Number', 'Please enter a valid 12-digit Aadhar number');
      return;
    }

    // Validate PAN number
    if (!panNumber.trim() || !panRegex.test(panNumber.trim().toUpperCase())) {
      Alert.alert('Invalid PAN Number', 'Please enter a valid PAN number (Format: ABCDE1234F)');
      return;
    }

    // Check if required document is uploaded
    if (!uploads.medicalLicense) {
      Alert.alert('Missing Document', 'Please upload the Medical License Certificate');
      return;
    }

    try {
      setLoading(true);
      
      // Save Aadhar and PAN numbers to doctor details
      if (user) {
        await upsertDoctorDetails(user.id, {
          aadhar_number: aadharNumber.trim(),
          pan_number: panNumber.trim().toUpperCase(),
        });
      }
      
      const { error } = await api.companyVerification.updateVerificationStatus(
        verificationId,
        'approved',
        'All doctor documents verified and approved automatically'
      );

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      setKyc({ uploaded: true, data: { uploads, aadharNumber, panNumber } });
      
      // Refresh verification status to ensure navigation works correctly
      await refreshVerification();
      
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
          <Text style={[styles.tabText, step===1 && styles.activeTabText]}>Professional Details</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, step===2 && styles.activeTab]} 
          onPress={() => setStep(2)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, step===2 && styles.activeTabText]}>Upload Documents</Text>
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
      <Text style={styles.cardTitle}>Professional Details</Text>

      <Text style={styles.label}>Full Name *</Text>
      <TextInput
        style={[styles.input, fullName.trim().length <= 2 && styles.inputDefault]}
        placeholder="Dr. John Doe"
        placeholderTextColor="#8E9BB9"
        value={fullName}
        onChangeText={setFullName}
        returnKeyType="next"
        blurOnSubmit={false}
      />

      <Text style={styles.label}>Medical Council Registration Number *</Text>
      <TextInput
        style={[styles.input, medicalCouncilRegNumber && !regNumberRegex.test(medicalCouncilRegNumber) && styles.inputError]}
        placeholder="MCI-123456"
        placeholderTextColor="#8E9BB9"
        autoCapitalize="characters"
        value={medicalCouncilRegNumber}
        onChangeText={setMedicalCouncilRegNumber}
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

      

      
            <Text style={styles.label}>Hospital Name *</Text>
            <TextInput
              style={[styles.input, hospital.trim().length === 0 && styles.inputDefault]}
              placeholder="e.g., Apollo Hospitals, Nungambakkam"
              placeholderTextColor="#8E9BB9"
              value={hospital}
              onChangeText={setHospital}
              returnKeyType="next"
              blurOnSubmit={false}
            />

            <Text style={styles.label}>Languages</Text>
            <TextInput
              style={[styles.input]}
              placeholder="e.g., English, Tamil, Hindi"
              placeholderTextColor="#8E9BB9"
              value={languages}
              onChangeText={setLanguages}
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
        style={[styles.input]}
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
        style={[styles.input, email && !emailRegex.test(email) && styles.inputError]}
        placeholder="doctor@example.com"
        placeholderTextColor="#8E9BB9"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        returnKeyType="next"
        blurOnSubmit={false}
      />

      <Text style={styles.label}>Phone Number *</Text>
      <TextInput
        style={[styles.input, phoneNumber && !phoneRegex.test(phoneNumber.replace(/\s/g, '')) && styles.inputError]}
        placeholder="+91 98765 43210"
        placeholderTextColor="#8E9BB9"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        returnKeyType="next"
        blurOnSubmit={false}
      />

      <Text style={styles.label}>Clinic/Consultation Address *</Text>
      <TextInput
        style={[styles.input, styles.textArea, clinicAddress.trim().length <= 10 && styles.inputDefault]}
        placeholder="Enter complete clinic or consultation address"
        placeholderTextColor="#8E9BB9"
        multiline
        numberOfLines={3}
        value={clinicAddress}
        onChangeText={setClinicAddress}
        returnKeyType="done"
        blurOnSubmit={true}
      />

      <TouchableOpacity 
        onPress={handleSaveDoctorDetails} 
        activeOpacity={0.8}
        disabled={!isDoctorDetailsValid || loading}
        style={[styles.primaryBtn, (!isDoctorDetailsValid || loading) && styles.primaryBtnDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <LinearGradient
            colors={['#0BB48F', '#0A8F6A']}
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

  const UploadField = ({title, subtitle, stateKey, required}: {title: string, subtitle?: string, stateKey: UploadKey, required?: boolean}) => {
    const file = uploads[stateKey];
    const isUploading = uploadingFiles.has(stateKey);
    const isImage = file?.mimeType?.startsWith('image') || /\.(png|jpg|jpeg|gif)$/i.test(file?.name || '');
    return (
      <View style={styles.uploadCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.uploadTitle}>{title}</Text>
          {required && <Text style={{ color: '#FF3B30', marginLeft: 4 }}>*</Text>}
        </View>
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
      <Text style={styles.cardTitle}>Document Verification</Text>
      <Text style={styles.sectionSubtitle}>Enter your details and upload documents to verify your medical credentials</Text>
      
      <Text style={styles.label}>Aadhar Number *</Text>
      <TextInput
        style={[styles.input, aadharNumber && !aadharRegex.test(aadharNumber.trim()) && styles.inputError]}
        placeholder="Enter 12-digit Aadhar number"
        placeholderTextColor="#8E9BB9"
        keyboardType="numeric"
        maxLength={12}
        value={aadharNumber}
        onChangeText={setAadharNumber}
        returnKeyType="next"
        blurOnSubmit={false}
      />
      {aadharNumber && !aadharRegex.test(aadharNumber.trim()) && (
        <Text style={styles.errorText}>Please enter a valid 12-digit Aadhar number</Text>
      )}

      <Text style={styles.label}>PAN Number *</Text>
      <TextInput
        style={[styles.input, panNumber && !panRegex.test(panNumber.trim().toUpperCase()) && styles.inputError]}
        placeholder="Enter PAN number (e.g., ABCDE1234F)"
        placeholderTextColor="#8E9BB9"
        autoCapitalize="characters"
        maxLength={10}
        value={panNumber}
        onChangeText={(text) => setPanNumber(text.toUpperCase())}
        returnKeyType="next"
        blurOnSubmit={false}
      />
      {panNumber && !panRegex.test(panNumber.trim().toUpperCase()) && (
        <Text style={styles.errorText}>Please enter a valid PAN number (Format: ABCDE1234F)</Text>
      )}

      <View style={{ marginTop: moderateScale(15) }}>
        <UploadField
          title="Medical License Certificate"
          stateKey="medicalLicense"
          required={true}
        />
      </View>

      <UploadField
        title="Educational Certificate"
        subtitle="MBBS/MD/MS/DNB Certificate"
        stateKey="educationalCertificate"
        required={true}
      />

      <TouchableOpacity 
        onPress={handleSubmitVerification} 
        activeOpacity={0.8}
        disabled={loading || !uploads.medicalLicense || !aadharNumber.trim() || !panNumber.trim() || !aadharRegex.test(aadharNumber.trim()) || !panRegex.test(panNumber.trim().toUpperCase())}
        style={[styles.primaryBtn, (loading || !uploads.medicalLicense || !aadharNumber.trim() || !panNumber.trim() || !aadharRegex.test(aadharNumber.trim()) || !panRegex.test(panNumber.trim().toUpperCase())) && styles.primaryBtnDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <LinearGradient
            colors={['#0BB48F', '#0A8F6A']}
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
    const [status, setStatus] = useState('review');
    const isVerified = status === 'verified';

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
        Animated.sequence([
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
        checkmarkScale.setValue(0);
        checkmarkOpacity.setValue(0);
        circleScale.setValue(0);
        circleOpacity.setValue(0);
        textScale.setValue(0);
        textOpacity.setValue(0);
        
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1.1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ])
        ).start();
      }
    }, [isVerified]);

    useEffect(() => {
      if (step === 3 && status === 'review') {
        const timer = setTimeout(() => setStatus('verified'), 2500);
        return () => clearTimeout(timer);
      }
      return undefined;
    }, [step, status]);
    
    return (
      <View>
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
                <Animated.View 
                  style={[
                    styles.successCircle, 
                    { 
                      transform: [{ scale: circleScale }],
                      opacity: circleOpacity
                    }
                  ]} 
                />
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
              Your medical credentials verified successfully!
            </Animated.Text>
          ) : (
            <Text style={styles.statusTitle}>
              Documents Under Review
            </Text>
          )}
          {!isVerified && (
            <Text style={styles.reviewSub}>Our team is verifying your medical credentials. This usually takes less than 24 hours.</Text>
          )}
        </View>

        <View style={styles.stepsCard}>
          <Text style={styles.stepsHeading}>Verification Steps</Text>

          <View style={styles.stepRow}>
            <View style={styles.stepIconContainer}>
              <View style={[styles.stepIcon, styles.stepIconBlue]} />
              <View style={styles.stepLine} />
            </View>
            <View style={styles.stepTextWrap}>
              <Text style={styles.stepTitle}>Document Upload</Text>
              <Text style={styles.stepSub}>Medical credentials and documents received</Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepIconContainer}>
              <View style={[styles.stepIcon, styles.stepIconIndigo]} />
              <View style={styles.stepLine} />
            </View>
            <View style={styles.stepTextWrap}>
              <Text style={styles.stepTitle}>Verification in Progress</Text>
              <Text style={styles.stepSub}>Our team is reviewing your medical credentials</Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepIconContainer}>
              <View style={[styles.stepIcon, isVerified ? styles.stepIconGreen : styles.stepIconGrey]} />
            </View>
            <View style={styles.stepTextWrap}>
              <Text style={[styles.stepTitle, isVerified && styles.stepTitleSuccess]}>Verification {isVerified ? 'successful' : 'Complete'}</Text>
              <Text style={styles.stepSub}>Account activated - Start accepting appointments</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={() => {
          // After verification, navigate to DoctorSpecializationScreen
          (navigation as any).navigate('DoctorSpecialization');
        }} activeOpacity={0.8} style={{marginTop:16}}>
          <LinearGradient
            colors={['#0BB48F', '#0A8F6A']}
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
    padding: moderateScale(20), 
    paddingTop: moderateScale(28),
    paddingBottom: moderateScale(40) 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(16),
    color: '#666',
  },
  topHeader: { alignItems:'center', marginBottom: moderateScale(12), marginTop: moderateScale(20) },
  backButton: {
    alignSelf: 'flex-start',
    padding: moderateScale(8),
    borderRadius: moderateScale(30),
    backgroundColor: '#E6ECFF',
    marginBottom: moderateScale(10),
  },
  logoImage: { width: moderateScale(120), height: moderateScale(50), marginTop: moderateScale(-50) },
  titleContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: moderateScale(4),
    marginBottom: moderateScale(10),
  },
  title: { color:'#0F172A', fontWeight:'700' },
  stepsTabs: { flexDirection:'row', backgroundColor:'#EEF2FF', borderRadius: moderateScale(14), overflow:'hidden', marginTop: moderateScale(10), width: '100%' },
  tab: { paddingVertical: moderateScale(8), paddingHorizontal: moderateScale(12), flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color:'#6B7280', fontSize: moderateScale(13), textAlign: 'center' },
  activeTab: { backgroundColor:'#e6e8ff' },
  activeTabText: { color:'#0b1960', fontWeight: '600' },
  cardContainer: { backgroundColor:'#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), marginTop: moderateScale(14) },
  cardTitle: { color:'#0b1960', fontWeight:'700', fontSize: moderateScale(18), marginBottom: moderateScale(12) },
  sectionSubtitle: { color:'#5B6B95', fontSize: moderateScale(13), marginBottom: moderateScale(16) },
  label: { color:'#0b1960', fontWeight:'600', marginTop: moderateScale(8), marginBottom: moderateScale(6) },
  input: { height: moderateScale(48), borderRadius: moderateScale(12), backgroundColor:'#F4F6FB', paddingHorizontal: moderateScale(12), color:'#000000', marginBottom: moderateScale(10), borderWidth:1, borderColor:'#E6ECFF' },
  textArea: { height: moderateScale(80), textAlignVertical: 'top' },
  inputDefault: { borderColor:'#E6ECFF' },
  inputError: { borderColor:'#FF6B6B' },
  primaryBtn: { borderRadius: moderateScale(12), paddingVertical: moderateScale(14), paddingHorizontal: moderateScale(30), alignItems:'center' },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color:'#ffffff', fontWeight:'700' },
  uploadBox: { backgroundColor:'#F4F6FB', borderRadius: moderateScale(12), padding: moderateScale(14), marginBottom: moderateScale(10), borderWidth:1, borderColor:'#E6ECFF' },
  uploadBoxUploading: { backgroundColor:'#E6F3FF', borderColor:'#0b1960' },
  uploadTitle: { color:'#0b1960', fontWeight:'700' },
  uploadSubtitle: { color:'#5B6B95', marginTop: moderateScale(4) },
  uploadHint: { color:'#8E9BB9', marginTop: moderateScale(6) },
  uploadingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: moderateScale(8) 
  },
  uploadingText: { 
    color: '#0b1960', 
    marginLeft: moderateScale(8), 
    fontWeight: '600' 
  },
  uploadCard: { backgroundColor:'#F8FAFF', borderRadius: moderateScale(12), padding: moderateScale(12), marginBottom: moderateScale(14), borderWidth:1, borderColor:'#EEF2FF' },
  fileName: { color:'#5B6B95', marginTop: moderateScale(6) },
  uploadPreviewWrap: { marginTop: moderateScale(8) },
  uploadFilled: { justifyContent:'center', alignItems:'center', position:'relative' },
  previewImage: { width: '100%', height: moderateScale(160), borderRadius: moderateScale(8) },
  removeBadge: { position:'absolute', top: moderateScale(6), right: moderateScale(6), backgroundColor:'#FF6B6B', borderRadius: moderateScale(12), width: moderateScale(24), height: moderateScale(24), alignItems:'center', justifyContent:'center' },
  removeBadgeText: { color:'#ffffff', fontWeight:'700', fontSize: moderateScale(16), lineHeight: moderateScale(16) },
  statusCard: { backgroundColor:'#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), marginTop: moderateScale(14), borderWidth:1, borderColor:'#E6ECFF', alignItems:'center' },
  statusIllustration: { width:'100%', height: moderateScale(140), backgroundColor:'#EAF0FF', borderRadius: moderateScale(12), marginBottom: moderateScale(10), alignItems:'center', justifyContent:'center' },
  circle: { width: moderateScale(80), height: moderateScale(80), borderRadius: moderateScale(40), borderWidth:6, borderColor:'#8FB2FF', backgroundColor:'#ffffff' },
  successContainer: { 
    width: moderateScale(100), 
    height: moderateScale(100), 
    alignItems: 'center', 
    justifyContent: 'center',
    position: 'relative'
  },
  successCircle: { 
    width: moderateScale(100), 
    height: moderateScale(100), 
    borderRadius: moderateScale(50), 
    backgroundColor: '#1DBF73',
    position: 'absolute',
    shadowColor: '#1DBF73',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  checkmarkContainer: {
    width: moderateScale(60),
    height: moderateScale(60),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  statusTitle: { color:'#0b1960', fontWeight:'700', fontSize: moderateScale(16), textAlign:'center', marginTop: moderateScale(4), marginBottom: moderateScale(-15) },
  statusTitleSuccess: { color:'#1DBF73' },
  reviewSub: { color:'#5B6B95', textAlign:'center', marginTop: moderateScale(8) },
  stepsCard: { backgroundColor:'#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), marginTop: moderateScale(14), borderWidth:1, borderColor:'#E6ECFF' },
  stepsHeading: { color:'#0b1960', fontWeight:'700', marginBottom: moderateScale(10) },
  stepRow: { flexDirection:'row', alignItems:'flex-start', marginBottom: moderateScale(12) },
  stepIconContainer: { alignItems:'center', marginRight: moderateScale(12) },
  stepIcon: { width: moderateScale(28), height: moderateScale(28), borderRadius: moderateScale(14) },
  stepLine: { width: 2, height: moderateScale(40), backgroundColor:'#E6ECFF', marginTop: moderateScale(4) },
  stepIconBlue: { backgroundColor:'#0A43FF' },
  stepIconIndigo: { backgroundColor:'#6667F3' },
  stepIconGreen: { backgroundColor:'#1DBF73' },
  stepIconGrey: { backgroundColor:'#C7CFEC' },
  stepTextWrap: { flex:1, paddingTop: moderateScale(4) },
  stepTitle: { color:'#0b1960', fontWeight:'700' },
  stepTitleSuccess: { color:'#1DBF73' },
  stepSub: { color:'#5B6B95' },
  errorText: {
    color: '#FF6B6B',
    fontSize: moderateScale(12),
    marginTop: moderateScale(-8),
    marginBottom: moderateScale(8),
  },
});

export default DoctorVerificationScreen;
