import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert, ActivityIndicator, Modal, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { getBookings, updateBookingStatus, setBookings } from '../utils/appState';
import { trackEvent } from '../services/analytics';
import { DoctorAppointmentsService } from '../services/doctorAppointmentsService';
import { PatientsService } from '../services/patientsService';
import { useAuth } from '../context/AuthContext';

const DoctorAppointmentDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const { user } = useAuth();

  const appointmentId = (route.params as any)?.appointmentId;

  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [showFullBookingId, setShowFullBookingId] = useState<boolean>(false);
  const [fullTextModal, setFullTextModal] = useState<{ visible: boolean; title: string; text: string }>({
    visible: false,
    title: '',
    text: '',
  });
  const [textTruncated, setTextTruncated] = useState<{
    email: boolean;
    address: boolean;
    symptoms: boolean;
    notes: boolean;
  }>({
    email: false,
    address: false,
    symptoms: false,
    notes: false,
  });

  // Doctor input fields
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [prescriptionFile, setPrescriptionFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(null);
  const [doctorNotes, setDoctorNotes] = useState<string>('');
  const [savingDoctorData, setSavingDoctorData] = useState<boolean>(false);
  const [uploadingPrescription, setUploadingPrescription] = useState<boolean>(false);

  // Sector-aware colors (green for doctor/healthcare)
  const sectorGradient: [string, string] = ['#0BB48F', '#0A8F6A'];
  const sectorPrimary = '#0BB48F';

  // Update booking status remotely in Supabase
  const updateBookingStatusRemote = async (id: string, status: string) => {
    try {
      const normalizedStatus = status.toLowerCase();

      let dbStatus = normalizedStatus;
      if (normalizedStatus === 'rejected' || normalizedStatus === 'reject') {
        dbStatus = 'cancelled';
      } else if (normalizedStatus === 'accepted' || normalizedStatus === 'accept') {
        dbStatus = 'assigned';
      } else if (normalizedStatus === 'inprogress' || normalizedStatus === 'in_progress') {
        dbStatus = 'in_progress';
      } else if (normalizedStatus === 'completed' || normalizedStatus === 'complete') {
        dbStatus = 'completed';
      }

      const res = await supabase
        .from('bookings')
        .update({ status: dbStatus })
        .eq('id', id)
        .select();
      if (res.error) {
        console.error('❌ Failed to update booking status remotely:', res.error);
        return { success: false, error: res.error };
      }
      if (user?.id) {
        let appointmentStatus: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'rejected' | 'accepted';

        const originalStatusLower = status.toLowerCase();
        if (originalStatusLower === 'rejected' || originalStatusLower === 'reject') {
          appointmentStatus = 'rejected';
        } else if (originalStatusLower === 'accepted' || originalStatusLower === 'accept') {
          appointmentStatus = 'accepted';
        } else if (dbStatus === 'assigned') {
          appointmentStatus = 'assigned';
        } else if (dbStatus === 'in_progress' || dbStatus === 'inprogress') {
          appointmentStatus = 'in_progress';
        } else if (dbStatus === 'completed') {
          appointmentStatus = 'completed';
        } else if (dbStatus === 'cancelled') {
          appointmentStatus = 'cancelled';
        } else {
          appointmentStatus = 'new';
        }

        const existingRecord = await DoctorAppointmentsService.getByBookingAndDoctor(id, user.id);

        // Get patient_id from patients table
        const patient = await PatientsService.getByBookingId(id);

        if (existingRecord) {
          await DoctorAppointmentsService.update(id, user.id, {
            status: appointmentStatus,
            patient_id: patient?.id || existingRecord.patient_id || null,
          });
        } else {
          await DoctorAppointmentsService.create({
            booking_id: id,
            doctor_user_id: user.id,
            status: appointmentStatus,
            patient_id: patient?.id || null,
          });
        }

        // Sync patient data to patients table when appointment is accepted or completed
        if (res.data && res.data.length > 0) {
          const bookingData = res.data[0];
          // Sync patient when accepting or completing appointment
          if (appointmentStatus === 'accepted' || appointmentStatus === 'assigned' || appointmentStatus === 'completed') {
            try {
              const patient = await PatientsService.syncFromBooking(bookingData, user.id);

              // Update doctor_appointments record with patient_id
              if (patient && patient.id) {
                const existingRecord = await DoctorAppointmentsService.getByBookingAndDoctor(id, user.id);
                if (existingRecord) {
                  await DoctorAppointmentsService.update(id, user.id, { patient_id: patient.id });
                }
              }

              // If appointment is completed, update patients table status and payment_status
              if (appointmentStatus === 'completed' && patient) {
                try {
                  const patientUpdateData: {
                    status?: string;
                    payment_status?: string | null;
                  } = {
                    status: 'completed',
                  };

                  // Get payment_status from booking data
                  if (bookingData.payment_status) {
                    patientUpdateData.payment_status = bookingData.payment_status;
                  } else if (bookingData.payment_amount !== null && bookingData.payment_amount !== undefined) {
                    // If payment_amount exists, assume paid
                    patientUpdateData.payment_status = 'paid';
                  }

                  const updatedPatient = await PatientsService.updateByDoctor(patient.id, user.id, patientUpdateData);
                } catch (patientUpdateError) {
                  console.warn('⚠️ Failed to update patients table status (non-critical):', patientUpdateError);
                  // Don't fail the whole operation if patient update fails
                }
              }
            } catch (patientSyncError) {
              console.warn('⚠️ Failed to sync patient data (non-critical):', patientSyncError);
              // Don't fail the whole operation if patient sync fails
            }
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating booking status:', error);
      return { success: false, error };
    }
  };

  // Fetch appointment details from bookings table
  const fetchAppointmentDetails = useCallback(async () => {
    if (!appointmentId) {
      console.error('❌ ===== NO APPOINTMENT ID =====');
      console.error('❌ No appointmentId provided! Cannot fetch appointment details.');
      console.error('❌ Route params were:', route.params);
      Alert.alert('Error', 'No appointment ID provided');
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('DoctorDashboard' as never);
      }
      return;
    }

    try {
      setLoading(true);

      // Fetch all details from bookings table
      let bookingData: any = null;
      let fetchError: any = null;

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          user_id,
          items,
          address,
          schedule,
          appointment_date,
          appointment_time,
          status,
          total,
          amount,
          payment_status,
          payment_amount,
          payment_mode,
          currency,
          provider_id,
          provider_service_id,
          provider_name,
          doctor_user_id,
          patient_name,
          patient_phone,
          patient_email,
          consultation_type,
          symptoms,
          notes,
          created_at
        `)
        .eq('id', appointmentId)
        .single();

      bookingData = data;
      fetchError = error;

      if (fetchError) {
        // Try to fetch with a simpler query as fallback
        try {
          const { data: simpleBookingData, error: simpleError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', appointmentId)
            .single();

          if (!simpleError && simpleBookingData) {
            bookingData = simpleBookingData;
            fetchError = null; // Clear error since we got data
          } else {
            console.error('❌ Simple query also failed:', simpleError);
            throw simpleError || new Error('Simple query also failed');
          }
        } catch (fallbackError) {
          // Last resort: use global state
          const allBookings = getBookings();

          const foundAppointment = allBookings.find(b => {
            const matches = String(b.id) === String(appointmentId);
            return matches;
          });

          if (!foundAppointment) {
            // Try one more time with a direct query without .single() to see if it exists
            try {
              const { data: checkData, error: checkError } = await supabase
                .from('bookings')
                .select('id')
                .eq('id', appointmentId)
                .limit(1);

              if (checkData && checkData.length > 0) {
                // Retry the full fetch
                const { data: retryData, error: retryError } = await supabase
                  .from('bookings')
                  .select('*')
                  .eq('id', appointmentId)
                  .single();

                if (!retryError && retryData) {
                  bookingData = retryData;
                  fetchError = null;
                } else {
                  throw new Error('Retry also failed');
                }
              } else {
                Alert.alert('Error', `Appointment not found. ID: ${appointmentId}`);
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('DoctorDashboard' as never);
                }
                setLoading(false);
                return;
              }
            } catch (finalError) {
              Alert.alert('Error', `Appointment not found. ID: ${appointmentId}`);
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('DoctorDashboard' as never);
              }
              setLoading(false);
              return;
            }
          } else {
            setAppointment(foundAppointment);
            setLoading(false);
            return;
          }
        }
      }

      if (!bookingData) {
        // Try global state one more time
        const allBookings = getBookings();
        const foundAppointment = allBookings.find(b => String(b.id) === String(appointmentId));

        if (foundAppointment) {
          setAppointment(foundAppointment);
          setLoading(false);
          return;
        }

        Alert.alert('Error', `Appointment not found. ID: ${appointmentId}`);
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          navigation.navigate('DoctorDashboard' as never);
        }
        setLoading(false);
        return;
      }

      // Fetch from doctor_appointments table to get the actual status
      let doctorAppointmentStatus: string | null = null;
      if (user?.id && bookingData) {
        try {
          const doctorAppointment = await DoctorAppointmentsService.getByBookingAndDoctor(
            appointmentId,
            user.id
          );
          if (doctorAppointment) {
            doctorAppointmentStatus = doctorAppointment.status;
          }
        } catch (err) {
          console.error('❌ Error fetching doctor_appointments:', err);
        }
      }

      // Use doctor_appointments status if available, otherwise use bookings status
      const effectiveStatus = doctorAppointmentStatus || bookingData?.status || 'pending';

      // Parse address if it's a JSON string
      let parsedAddress: any = {};
      if (bookingData.address) {
        if (typeof bookingData.address === 'string') {
          try {
            parsedAddress = JSON.parse(bookingData.address);
          } catch (e) {
            console.error('Error parsing address JSON:', e);
            parsedAddress = {};
          }
        } else {
          parsedAddress = bookingData.address;
        }
      }

      const address: any = parsedAddress || {};
      const location = (address as any).city
        ? `${(address as any).line1 || ''}, ${(address as any).city}`.trim()
        : bookingData.consultation_type === 'In-Person'
          ? 'In-Person Consultation'
          : bookingData.consultation_type || 'Consultation';

      const serviceName = bookingData.symptoms
        ? `In-Person Consultation - ${bookingData.symptoms}`
        : 'In-Person Consultation';

      // Map status to expected format - handle both lowercase and mixed case
      const statusLower = (bookingData.status || '').toLowerCase();
      const mappedStatus = statusLower === 'pending' ? 'New' :
        statusLower === 'confirmed' || statusLower === 'assigned' || statusLower === 'accepted' ? 'Assigned' :
          statusLower === 'in_progress' || statusLower === 'inprogress' ? 'InProgress' :
            statusLower === 'completed' ? 'Completed' :
              statusLower === 'cancelled' ? 'Cancelled' : 'New';

      // Build appointment object - spread bookingData first, then override with transformed values
      const appointment: any = {
        ...bookingData, // Include all fields from bookingData first (patient_phone, patient_email, symptoms, notes, etc.)

        // Override with transformed/mapped values only
        customerName: bookingData.patient_name || (address as any)?.name || 'Patient',
        patientName: bookingData.patient_name || (address as any)?.name || 'Patient',

        // Add camelCase versions for compatibility
        patientPhone: bookingData.patient_phone || (address as any)?.phone || '',
        patientEmail: bookingData.patient_email || null,
        appointmentDate: bookingData.appointment_date || null,
        appointmentTime: bookingData.appointment_time || null,
        consultationType: bookingData.consultation_type || null,

        // Location and service
        location: location,
        serviceName: serviceName,
        address: address, // Use parsed address (overrides the string version)

        // Financial and status
        paymentMode: bookingData.payment_mode === 'online' ? 'Online' : 'Cash',
        paymentStatus: bookingData.payment_status || null,
        status: mappedStatus,
        // Preserve original database status for timeline mapping (use effectiveStatus from doctor_appointments)
        originalStatus: (effectiveStatus || bookingData.status || 'pending').toLowerCase(),
      };

      setAppointment(appointment);

      // Fetch existing patient data if available
      if (user?.id && appointmentId) {
        try {
          const patient = await PatientsService.getByBookingId(appointmentId);
          if (patient) {
            setDiagnosis(patient.diagnosis || '');
            setPrescriptionUrl(patient.prescription || null);
            setDoctorNotes(patient.doctor_notes || '');
          }
        } catch (err) {
          console.warn('⚠️ Could not load patient data:', err);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('❌ Exception fetching appointment details:', error);
      Alert.alert('Error', 'Failed to load appointment details');
      setLoading(false);
    }
  }, [appointmentId, navigation]);

  useEffect(() => {
    if (appointmentId) {
      fetchAppointmentDetails();
    }
  }, [fetchAppointmentDetails, appointmentId]);

  useEffect(() => {
    if (isFocused && appointmentId) {
      // Add a small delay to ensure we get fresh data from database
      const timer = setTimeout(() => {
        fetchAppointmentDetails();
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isFocused, fetchAppointmentDetails, appointmentId]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={sectorPrimary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading appointment details...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={moderateScale(48)} color="#EF4444" />
            <Text style={[styles.errorText, { color: colors.text }]}>Appointment not found</Text>
            <Text style={[styles.errorText, { color: colors.textSecondary, fontSize: moderateScale(12), marginTop: moderateScale(8) }]}>
              ID: {appointmentId || 'Not provided'}
            </Text>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: sectorPrimary }]}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('DoctorDashboard' as never);
                }
              }}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Get appointment date and time
  const appointmentDate = appointment.appointmentDate
    || (appointment as any).appointment_date
    || (appointment as any)['appointment_date']
    || null;
  const appointmentTime = appointment.appointmentTime
    || (appointment as any).appointment_time
    || (appointment as any)['appointment_time']
    || null;

  let apptDate: Date;
  let timeStr: string;
  let dateStr: string;

  if (appointmentDate) {
    apptDate = new Date(appointmentDate);
    const isToday = apptDate.toDateString() === new Date().toDateString();

    if (isToday) {
      dateStr = 'Today';
    } else {
      dateStr = apptDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    if (appointmentTime) {
      timeStr = appointmentTime;
    } else {
      timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
  } else {
    apptDate = appointment.createdAt ? new Date(appointment.createdAt) : new Date();
    const isToday = apptDate.toDateString() === new Date().toDateString();
    timeStr = apptDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    dateStr = isToday ? 'Today' : apptDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  const amount = typeof appointment.amount === 'number' ? appointment.amount : (typeof appointment.amount === 'string' ? parseFloat(appointment.amount) || 0 : 0);


  // Get symptoms and consultation type - check all possible field names
  const symptoms = (appointment as any)?.symptoms || '';
  const notes = (appointment as any)?.notes || '';

  let consultationType = (appointment as any)?.consultation_type
    || (appointment as any)?.consultationType
    || '';

  if (!consultationType || consultationType.trim() === '') {
    const location = appointment.location || '';
    if (location === 'Video Call') {
      consultationType = 'Video Call';
    } else if (location === 'Phone Call') {
      consultationType = 'Phone Call';
    } else if (location && location !== 'In-Person Consultation' && !location.includes('Address')) {
      consultationType = location;
    }
  }

  const formatConsultationType = (type: string) => {
    if (!type || type.trim() === '') return 'Not Specified';
    const typeLower = type.toLowerCase().trim();
    if (typeLower === 'in-person' || typeLower === 'in person') {
      return 'In-Person Consultation';
    } else if (typeLower === 'video' || typeLower === 'video call') {
      return 'Video Call';
    } else if (typeLower === 'phone' || typeLower === 'phone call') {
      return 'Phone Call';
    }
    return type.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  };

  // Handle prescription file upload
  const handlePickPrescription = async () => {
    try {
      Alert.alert('Upload Prescription', 'Choose a source', [
        {
          text: 'Image',
          onPress: async () => {
            try {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
                allowsEditing: false,
              });

              if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setPrescriptionFile({
                  uri: asset.uri,
                  name: asset.fileName || `prescription_${Date.now()}.jpg`,
                  type: 'image/jpeg',
                });
              }
            } catch (error) {
              console.error('Error picking image:', error);
              Alert.alert('Error', 'Failed to pick image');
            }
          },
        },
        {
          text: 'PDF Document',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf'],
                multiple: false,
              });

              if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setPrescriptionFile({
                  uri: asset.uri,
                  name: asset.name || `prescription_${Date.now()}.pdf`,
                  type: asset.mimeType || 'application/pdf',
                });
              }
            } catch (error) {
              console.error('Error picking document:', error);
              Alert.alert('Error', 'Failed to pick document');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } catch (error) {
      console.error('Error in handlePickPrescription:', error);
      Alert.alert('Error', 'Failed to open file picker');
    }
  };

  // Upload prescription file to Supabase Storage
  const uploadPrescriptionFile = async (): Promise<string | null> => {
    if (!prescriptionFile || !user?.id || !appointmentId) return null;

    try {
      setUploadingPrescription(true);

      const fileExt = prescriptionFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/${appointmentId}_${Date.now()}.${fileExt}`;

      // Create FormData for React Native
      const formData = new FormData();
      formData.append('file', {
        uri: prescriptionFile.uri,
        type: prescriptionFile.type,
        name: prescriptionFile.name,
      } as any);

      // Upload to Supabase Storage (doctor-prescriptions bucket)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('doctor-prescriptions')
        .upload(fileName, formData, {
          contentType: prescriptionFile.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        // If bucket doesn't exist, try to create it or use a fallback
        if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
          Alert.alert(
            'Storage Setup Required',
            'Please run the migration to create the "doctor-prescriptions" bucket in your Supabase Storage settings.'
          );
          return null;
        }
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('doctor-prescriptions')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading prescription:', error);
      Alert.alert('Error', 'Failed to upload prescription file');
      return null;
    } finally {
      setUploadingPrescription(false);
    }
  };

  // Save doctor-provided data
  const handleSaveDoctorData = async () => {
    if (!user?.id || !appointmentId) {
      Alert.alert('Error', 'Unable to save data. Please try again.');
      return;
    }

    try {
      setSavingDoctorData(true);

      // Get patient record
      const patient = await PatientsService.getByBookingId(appointmentId);
      if (!patient) {
        Alert.alert('Error', 'Patient record not found. Please accept the appointment first.');
        setSavingDoctorData(false);
        return;
      }

      // Upload prescription file if a new one was selected
      let finalPrescriptionUrl = prescriptionUrl;
      if (prescriptionFile) {
        const uploadedUrl = await uploadPrescriptionFile();
        if (uploadedUrl) {
          finalPrescriptionUrl = uploadedUrl;
          setPrescriptionUrl(uploadedUrl);
          setPrescriptionFile(null); // Clear file after upload
        } else {
          // If upload failed, don't save
          setSavingDoctorData(false);
          return;
        }
      }

      // Update patient record
      const updateData: {
        diagnosis?: string | null;
        prescription?: string | null;
        doctor_notes?: string | null;
      } = {};

      if (diagnosis.trim() !== '') {
        updateData.diagnosis = diagnosis.trim();
      }
      if (finalPrescriptionUrl) {
        updateData.prescription = finalPrescriptionUrl;
      }
      if (doctorNotes.trim() !== '') {
        updateData.doctor_notes = doctorNotes.trim();
      }

      const updatedPatient = await PatientsService.updateByDoctor(patient.id, user.id, updateData);

      if (updatedPatient) {
        Alert.alert('Success', 'Doctor notes saved successfully');
        trackEvent('Doctor Notes Saved', {
          appointment_id: appointmentId,
          has_diagnosis: !!updateData.diagnosis,
          has_prescription: !!updateData.prescription,
          has_notes: !!updateData.doctor_notes,
        });
      } else {
        Alert.alert('Error', 'Failed to save doctor notes. Please try again.');
      }
    } catch (error) {
      console.error('Error saving doctor data:', error);
      Alert.alert('Error', 'Failed to save doctor notes. Please try again.');
    } finally {
      setSavingDoctorData(false);
    }
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent={true} />

      {/* Header */}
      <LinearGradient
        colors={sectorGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('DoctorDashboard' as never);
                }
              }}
              style={styles.backButtonHeader}
            >
              <Ionicons name="arrow-back" size={moderateScale(24)} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Appointment Details</Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Single Container with All Information */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header with Patient Name and Status */}
          <View style={styles.headerSection}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(12) }}>
                {appointment.status === 'New' &&
                  (appointment.originalStatus === 'pending' || appointment.originalStatus === 'new' || !appointment.originalStatus) && (
                    <View style={{ backgroundColor: '#FF3B30', borderRadius: 20, paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(6), marginRight: moderateScale(10) }}>
                      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: moderateScale(11) }}>NEW</Text>
                    </View>
                  )}
                <Text style={{ fontWeight: '900', fontSize: moderateScale(22), color: colors.text }}>
                  {appointment.customerName || appointment.patientName || 'Patient'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="calendar-outline" size={moderateScale(16)} color={colors.textSecondary} style={{ marginRight: moderateScale(8) }} />
                <Text style={{ color: colors.textSecondary, fontSize: moderateScale(14), fontWeight: '600' }}>
                  {dateStr} • {timeStr}
                </Text>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Booking ID */}
          <View>
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => setShowFullBookingId(!showFullBookingId)}
              activeOpacity={0.7}
            >
              <View style={styles.infoLabelContainer}>
                <Ionicons name="receipt-outline" size={moderateScale(18)} color={colors.textSecondary} />
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Booking ID</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end', marginLeft: moderateScale(12) }}>
                <Text style={[styles.infoValue, { color: colors.text, fontFamily: 'monospace', fontSize: moderateScale(12) }]} numberOfLines={1}>
                  {appointment?.id || 'N/A'}
                </Text>
                <Ionicons
                  name={showFullBookingId ? "chevron-up" : "chevron-down"}
                  size={moderateScale(16)}
                  color={colors.textSecondary}
                  style={{ marginLeft: moderateScale(8) }}
                />
              </View>
            </TouchableOpacity>
            {showFullBookingId && appointment?.id && (
              <View style={{ marginTop: moderateScale(8), marginLeft: moderateScale(28), padding: moderateScale(12), backgroundColor: colors.background, borderRadius: moderateScale(8), borderWidth: 1, borderColor: colors.border }}>
                <Text style={[styles.infoValue, { color: colors.text, fontFamily: 'monospace', fontSize: moderateScale(11) }]}>
                  {appointment.id}
                </Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Phone Number */}
          <View style={styles.infoRow}>
            <View style={styles.infoLabelContainer}>
              <Ionicons name="call-outline" size={moderateScale(18)} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Phone</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.text, flex: 1, textAlign: 'right' }]}>
              {(() => {
                const phone = (appointment as any).patient_phone
                  || (appointment as any).patientPhone
                  || (appointment.address as any)?.phone
                  || '';
                return phone ? `+91 ${phone}` : 'Not provided';
              })()}
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Email */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => {
              const email = (appointment as any).patient_email
                || (appointment as any).patientEmail
                || 'Not provided';
              if (email !== 'Not provided' && textTruncated.email) {
                setFullTextModal({
                  visible: true,
                  title: 'Email',
                  text: email,
                });
              }
            }}
            activeOpacity={(appointment as any).patient_email || (appointment as any).patientEmail ? 0.7 : 1}
          >
            <View style={styles.infoLabelContainer}>
              <Ionicons name="mail-outline" size={moderateScale(18)} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Text
                style={[styles.infoValue, { color: colors.text, flex: 1, textAlign: 'right' }]}
                numberOfLines={1}
                onTextLayout={(e) => {
                  const email = (appointment as any).patient_email
                    || (appointment as any).patientEmail
                    || 'Not provided';
                  if (email !== 'Not provided') {
                    const { lines } = e.nativeEvent;
                    // If we have exactly 1 line (the limit), the text might be truncated
                    // We'll show chevron to be safe - user can click to see full text
                    const isTruncated = lines.length === 1;
                    setTextTruncated(prev => ({
                      ...prev,
                      email: isTruncated,
                    }));
                  }
                }}
              >
                {(appointment as any).patient_email
                  || (appointment as any).patientEmail
                  || 'Not provided'}
              </Text>
              {((appointment as any).patient_email || (appointment as any).patientEmail) && textTruncated.email && (
                <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.textSecondary} style={{ marginLeft: moderateScale(8) }} />
              )}
            </View>
          </TouchableOpacity>

          {/* Patient Address */}
          {(() => {
            const addr = appointment.address as any;
            const hasAddress = addr && (addr.line1 || addr.address);
            if (!hasAddress) return null;
            const fullAddress = `${addr?.line1 || addr?.address || ''}${addr?.city ? `, ${addr.city}` : ''}${addr?.state ? `, ${addr.state}` : ''}${addr?.pincode ? ` - ${addr.pincode}` : ''}`;
            return (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  style={styles.infoRow}
                  onPress={() => {
                    if (textTruncated.address) {
                      setFullTextModal({
                        visible: true,
                        title: 'Address',
                        text: fullAddress,
                      });
                    }
                  }}
                  activeOpacity={textTruncated.address ? 0.7 : 1}
                >
                  <View style={styles.infoLabelContainer}>
                    <Ionicons name="home-outline" size={moderateScale(18)} color={colors.textSecondary} />
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Address</Text>
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Text
                      style={[styles.infoValue, { color: colors.text, flex: 1, textAlign: 'right' }]}
                      numberOfLines={2}
                      onTextLayout={(e) => {
                        const { lines } = e.nativeEvent;
                        setTextTruncated(prev => ({
                          ...prev,
                          address: lines.length >= 2,
                        }));
                      }}
                    >
                      {fullAddress}
                    </Text>
                    {textTruncated.address && (
                      <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.textSecondary} style={{ marginLeft: moderateScale(8) }} />
                    )}
                  </View>
                </TouchableOpacity>
              </>
            );
          })()}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Consultation Type */}
          <View style={styles.infoRow}>
            <View style={styles.infoLabelContainer}>
              <Ionicons name="location-outline" size={moderateScale(18)} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Consultation Type</Text>
            </View>
            <Text style={[styles.infoValue, { color: '#2B49C3', fontWeight: '700', flex: 1, textAlign: 'right' }]}>
              {formatConsultationType(consultationType)}
            </Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Symptoms */}
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => {
              if (symptoms && symptoms.trim() !== '' && textTruncated.symptoms) {
                setFullTextModal({
                  visible: true,
                  title: 'Symptoms',
                  text: symptoms,
                });
              }
            }}
            activeOpacity={symptoms && symptoms.trim() !== '' && textTruncated.symptoms ? 0.7 : 1}
          >
            <View style={[styles.infoLabelContainer, { alignItems: 'flex-start', paddingTop: moderateScale(4) }]}>
              <Ionicons name="medical-outline" size={moderateScale(18)} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Symptoms</Text>
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
              <Text
                style={[styles.infoValue, { color: colors.text, flex: 1, textAlign: 'right' }]}
                numberOfLines={3}
                onTextLayout={(e) => {
                  if (symptoms && symptoms.trim() !== '') {
                    const { lines } = e.nativeEvent;
                    setTextTruncated(prev => ({
                      ...prev,
                      symptoms: lines.length >= 3,
                    }));
                  }
                }}
              >
                {symptoms && symptoms.trim() !== '' ? symptoms : 'No symptoms provided'}
              </Text>
              {symptoms && symptoms.trim() !== '' && textTruncated.symptoms && (
                <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.textSecondary} style={{ marginLeft: moderateScale(8), marginTop: moderateScale(4) }} />
              )}
            </View>
          </TouchableOpacity>

          {/* Notes */}
          {notes && notes.trim() !== '' && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => {
                  if (textTruncated.notes) {
                    setFullTextModal({
                      visible: true,
                      title: 'Notes',
                      text: notes,
                    });
                  }
                }}
                activeOpacity={textTruncated.notes ? 0.7 : 1}
              >
                <View style={[styles.infoLabelContainer, { alignItems: 'flex-start', paddingTop: moderateScale(4) }]}>
                  <Ionicons name="document-text-outline" size={moderateScale(18)} color={colors.textSecondary} />
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Notes</Text>
                </View>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                  <Text
                    style={[styles.infoValue, { color: colors.text, flex: 1, textAlign: 'right' }]}
                    numberOfLines={3}
                    onTextLayout={(e) => {
                      const { lines } = e.nativeEvent;
                      setTextTruncated(prev => ({
                        ...prev,
                        notes: lines.length >= 3,
                      }));
                    }}
                  >
                    {notes}
                  </Text>
                  {textTruncated.notes && (
                    <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.textSecondary} style={{ marginLeft: moderateScale(8), marginTop: moderateScale(4) }} />
                  )}
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Amount and Payment Status Row */}
          <View style={[styles.infoRow, { justifyContent: 'space-between' }]}>
            <View style={styles.infoLabelContainer}>
              <Ionicons name="cash-outline" size={moderateScale(18)} color="#26e07f" />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Amount</Text>
            </View>
            <Text style={[styles.infoValue, { color: '#26e07f', fontSize: moderateScale(18), fontWeight: '800' }]}>
              ₹{amount.toFixed(2)}
            </Text>
          </View>

          {/* Payment Status */}
          {appointment.paymentStatus && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name="card-outline" size={moderateScale(18)} color={colors.textSecondary} />
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Payment Status</Text>
                </View>
                <View style={{
                  backgroundColor: appointment.paymentStatus === 'paid' ? '#e8f5e9' :
                    appointment.paymentStatus === 'pending' ? '#fff4e6' :
                      appointment.paymentStatus === 'failed' ? '#ffebee' : '#f3f4f6',
                  borderRadius: moderateScale(8),
                  paddingHorizontal: moderateScale(12),
                  paddingVertical: moderateScale(6),
                }}>
                  <Text style={{
                    color: appointment.paymentStatus === 'paid' ? '#26e07f' :
                      appointment.paymentStatus === 'pending' ? '#FF9500' :
                        appointment.paymentStatus === 'failed' ? '#FF3B30' : '#6b748f',
                    fontSize: moderateScale(12),
                    fontWeight: '700',
                    textTransform: 'capitalize',
                  }}>
                    {appointment.paymentStatus}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Doctor Notes Section */}
        {(appointment.status === 'Assigned' || appointment.status === 'InProgress' || appointment.status === 'Completed' ||
          appointment.originalStatus === 'accepted' || appointment.originalStatus === 'assigned' ||
          appointment.originalStatus === 'in_progress' || appointment.originalStatus === 'completed') && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Doctor Notes</Text>

              {(() => {
                // Check if appointment is completed
                const currentStatus = (appointment.status || '').toString().toLowerCase();
                const originalStatus = (appointment.originalStatus || '').toString().toLowerCase();
                const isCompleted =
                  originalStatus === 'completed' ||
                  currentStatus === 'completed' ||
                  appointment.status === 'Completed' ||
                  (appointment as any).effectiveStatus === 'completed';

                return (
                  <>
                    {/* Diagnosis */}
                    <View style={styles.inputSection}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Diagnosis</Text>
                      {isCompleted ? (
                        <View style={[styles.readOnlyTextContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <Text style={[styles.readOnlyText, { color: colors.text }]}>
                            {diagnosis || 'No diagnosis provided'}
                          </Text>
                        </View>
                      ) : (
                        <TextInput
                          style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          placeholder="Enter diagnosis..."
                          placeholderTextColor={colors.textSecondary}
                          value={diagnosis}
                          onChangeText={setDiagnosis}
                          multiline
                          numberOfLines={4}
                          textAlignVertical="top"
                        />
                      )}
                    </View>

                    {/* Prescription Upload */}
                    <View style={styles.inputSection}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Prescription</Text>
                      {prescriptionUrl ? (
                        <View style={styles.prescriptionContainer}>
                          <View style={[styles.prescriptionPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            {prescriptionUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                              <Image source={{ uri: prescriptionUrl }} style={styles.prescriptionImage} resizeMode="contain" />
                            ) : (
                              <View style={styles.prescriptionFileContainer}>
                                <Ionicons name="document-text" size={moderateScale(32)} color={sectorPrimary} />
                                <Text style={[styles.prescriptionFileName, { color: colors.text }]} numberOfLines={1}>
                                  {prescriptionUrl.split('/').pop() || 'Prescription'}
                                </Text>
                              </View>
                            )}
                            {!isCompleted && (
                              <TouchableOpacity
                                style={styles.removePrescriptionButton}
                                onPress={() => {
                                  setPrescriptionUrl(null);
                                  setPrescriptionFile(null);
                                }}
                              >
                                <Ionicons name="close-circle" size={moderateScale(20)} color="#FF3B30" />
                              </TouchableOpacity>
                            )}
                          </View>
                          {!isCompleted && (
                            <TouchableOpacity
                              style={[styles.uploadButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                              onPress={handlePickPrescription}
                              disabled={uploadingPrescription}
                            >
                              {uploadingPrescription ? (
                                <ActivityIndicator size="small" color={sectorPrimary} />
                              ) : (
                                <>
                                  <Ionicons name="refresh-outline" size={moderateScale(18)} color={sectorPrimary} />
                                  <Text style={[styles.uploadButtonText, { color: sectorPrimary }]}>Replace</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        !isCompleted && (
                          <TouchableOpacity
                            style={[styles.uploadButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                            onPress={handlePickPrescription}
                            disabled={uploadingPrescription}
                          >
                            {uploadingPrescription ? (
                              <ActivityIndicator size="small" color={sectorPrimary} />
                            ) : (
                              <>
                                <Ionicons name="cloud-upload-outline" size={moderateScale(18)} color={sectorPrimary} />
                                <Text style={[styles.uploadButtonText, { color: sectorPrimary }]}>
                                  {prescriptionFile ? 'Upload Selected File' : 'Upload Prescription (Image/PDF)'}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )
                      )}
                      {prescriptionFile && !prescriptionUrl && !isCompleted && (
                        <View style={[styles.selectedFileContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <Ionicons name="document" size={moderateScale(16)} color={sectorPrimary} />
                          <Text style={[styles.selectedFileName, { color: colors.text }]} numberOfLines={1}>
                            {prescriptionFile.name}
                          </Text>
                        </View>
                      )}
                      {isCompleted && !prescriptionUrl && (
                        <View style={[styles.readOnlyTextContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <Text style={[styles.readOnlyText, { color: colors.textSecondary }]}>No prescription uploaded</Text>
                        </View>
                      )}
                    </View>

                    {/* Doctor Notes */}
                    <View style={styles.inputSection}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Additional Notes</Text>
                      {isCompleted ? (
                        <View style={[styles.readOnlyTextContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <Text style={[styles.readOnlyText, { color: colors.text }]}>
                            {doctorNotes || 'No additional notes provided'}
                          </Text>
                        </View>
                      ) : (
                        <TextInput
                          style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          placeholder="Add any additional notes..."
                          placeholderTextColor={colors.textSecondary}
                          value={doctorNotes}
                          onChangeText={setDoctorNotes}
                          multiline
                          numberOfLines={4}
                          textAlignVertical="top"
                        />
                      )}
                    </View>

                    {/* Save Button - Only show when not completed */}
                    {!isCompleted && (
                      <>
                        <TouchableOpacity
                          style={[styles.saveButton, { backgroundColor: sectorPrimary }]}
                          onPress={handleSaveDoctorData}
                          disabled={savingDoctorData || uploadingPrescription}
                          activeOpacity={0.8}
                        >
                          {savingDoctorData ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={moderateScale(18)} color="#ffffff" />
                              <Text style={styles.saveButtonText}>Save Notes</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        {/* Required Fields Indicator */}
                        <View style={[styles.requiredFieldsIndicator, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <Ionicons name="information-circle-outline" size={moderateScale(16)} color={colors.textSecondary} />
                          <Text style={[styles.requiredFieldsText, { color: colors.textSecondary }]}>
                            All fields (Diagnosis, Prescription, Notes) are required before completing the appointment.
                          </Text>
                        </View>
                      </>
                    )}
                  </>
                );
              })()}
            </View>
          )}

        {/* Appointment Status Timeline */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>Status</Text>
          {(() => {
            const steps = ['Requested', 'Accepted', 'In Progress', 'Completed'];

            // Use originalStatus (database status) if available, otherwise fallback to status or 'pending'
            // originalStatus is the raw database status (e.g., 'assigned', 'pending')
            // status is the mapped status (e.g., 'Assigned', 'New')
            let rawStatus = appointment.originalStatus || appointment.status || 'pending';

            // If originalStatus is not set but status is, try to infer originalStatus
            if (!appointment.originalStatus && appointment.status) {
              const statusLower = appointment.status.toLowerCase();
              if (statusLower === 'assigned') {
                rawStatus = 'assigned';
              } else if (statusLower === 'new') {
                rawStatus = 'pending';
              } else if (statusLower === 'inprogress') {
                rawStatus = 'in_progress';
              } else if (statusLower === 'completed') {
                rawStatus = 'completed';
              } else if (statusLower === 'cancelled') {
                rawStatus = 'cancelled';
              }
            }

            const backendStatus = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : 'pending';

            // Map backend status to display status
            const backendToDisplay: { [key: string]: string } = {
              'pending': 'Requested',
              'requested': 'Requested',
              'new': 'Requested',
              'accepted': 'Accepted',
              'assigned': 'Accepted',
              'confirmed': 'Accepted',
              'in_progress': 'In Progress',
              'inprogress': 'In Progress',
              'completed': 'Completed',
              'cancelled': 'Cancelled',
            };

            const current = backendToDisplay[backendStatus] || 'Requested';

            // Map display status to timeline index
            const statusMap: { [key: string]: number } = {
              'Requested': 0,
              'Accepted': 1,
              'In Progress': 2,
              'Completed': 3,
              'Cancelled': -1, // Cancelled status doesn't show in timeline
            };

            // If status is cancelled, show the last completed step or Requested
            let activeIdx = statusMap[current] ?? 0;
            if (activeIdx === -1) {
              // For cancelled, show Requested as the last visible state
              activeIdx = 0;
            }

            const ROW_HEIGHT = moderateScale(44);

            return (
              <View style={styles.timelineContainer}>
                <View style={styles.timelineWrapper}>
                  {/* Track (gray background line) */}
                  <View style={[styles.statusTrack, { backgroundColor: colors.border }]} />
                  {/* Progress (green line) - extends to include current step */}
                  <View
                    style={[
                      styles.statusProgress,
                      {
                        height: activeIdx * ROW_HEIGHT + (activeIdx === steps.length - 1 ? moderateScale(8) : 0),
                        backgroundColor: sectorPrimary,
                      },
                    ]}
                  />
                  {steps.map((label, idx) => {
                    // Mark completed steps and current step as active
                    const active = idx <= activeIdx;
                    const isCurrent = idx === activeIdx;
                    const isLast = idx === steps.length - 1;

                    return (
                      <View key={label} style={[styles.statusRow, { minHeight: ROW_HEIGHT }]}>
                        <View style={styles.statusDotContainer}>
                          {isLast && active ? (
                            <View style={[styles.statusCheckmark, { backgroundColor: sectorPrimary }]}>
                              <Ionicons name="checkmark" size={moderateScale(12)} color="#ffffff" />
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.statusDot,
                                active
                                  ? [styles.statusDotActive, { backgroundColor: sectorPrimary, borderColor: sectorPrimary }]
                                  : [styles.statusDotIdle, { backgroundColor: '#ffffff', borderColor: colors.border }],
                              ]}
                            />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color: active ? colors.text : colors.textSecondary,
                              fontWeight: active ? '800' : '700',
                            },
                          ]}
                        >
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}
        </View>

        {/* Action Buttons */}
        {(() => {
          // Check both status and originalStatus to determine button state
          const currentStatus = (appointment.status || '').toString().toLowerCase();
          const originalStatus = (appointment.originalStatus || '').toString().toLowerCase();

          // Appointment is "new" only if status is truly new/pending
          // If it's accepted, assigned, in_progress, or completed, show Cancel/Completed buttons
          const isNew = (currentStatus === 'new' && (originalStatus === 'pending' || originalStatus === 'new' || !originalStatus));
          const isAccepted = originalStatus === 'accepted' || originalStatus === 'assigned' || currentStatus === 'assigned';
          // Check for completed status in multiple ways
          const isCompleted =
            originalStatus === 'completed' ||
            currentStatus === 'completed' ||
            appointment.status === 'Completed' ||
            (appointment as any).effectiveStatus === 'completed';
          const isCancelled = originalStatus === 'cancelled' || originalStatus === 'rejected' || currentStatus === 'cancelled';

          // Don't show any buttons if appointment is completed or cancelled
          if (isCompleted || isCancelled) {
            return null;
          }

          // Show Reject/Accept only for truly new appointments
          // Show Cancel/Completed for accepted appointments
          const showRejectAccept = isNew && !isAccepted && !isCompleted && !isCancelled;

          return (
            <View style={styles.actionsContainer}>
              {showRejectAccept ? (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={async () => {
                      if (appointment?.id) {
                        setUpdatingStatus(true);
                        const res = await updateBookingStatusRemote(appointment.id, 'Rejected');
                        if (res.success) {
                          updateBookingStatus(appointment.id, 'Cancelled');
                          trackEvent('Doctor Appointment Rejected', {
                            appointment_id: appointment.id,
                            patient_name: appointment.customerName,
                            appointment_amount: appointment.amount,
                            appointment_location: appointment.location,
                            source: 'details_screen',
                          });
                          fetchAppointmentDetails();
                          Alert.alert('Success', 'Appointment rejected', [
                            { text: 'OK', onPress: () => navigation.goBack() }
                          ]);
                        } else {
                          Alert.alert('Error', 'Failed to reject appointment. Please try again.');
                        }
                        setUpdatingStatus(false);
                      }
                    }}
                    disabled={updatingStatus}
                    activeOpacity={0.8}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator size="small" color="#FF3B30" />
                    ) : (
                      <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>Reject</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={async () => {
                      if (appointment?.id) {
                        setUpdatingStatus(true);
                        const res = await updateBookingStatusRemote(appointment.id, 'Accepted');

                        if (res.success) {
                          updateBookingStatus(appointment.id, 'Assigned');

                          const updatedBookings = getBookings().map(b => {
                            if (b.id === appointment.id) {
                              return {
                                ...b,
                                status: 'Assigned' as any,
                                originalStatus: 'assigned',
                              };
                            }
                            return b;
                          });
                          setBookings(updatedBookings);

                          trackEvent('Doctor Appointment Accepted', {
                            appointment_id: appointment.id,
                            patient_name: appointment.customerName,
                            appointment_amount: appointment.amount,
                            appointment_location: appointment.location,
                            service_name: appointment.serviceName,
                            source: 'details_screen',
                          });

                          // Immediately update local state
                          setAppointment((prev: any) => {
                            if (prev) {
                              return {
                                ...prev,
                                status: 'Assigned',
                                originalStatus: 'assigned',
                              };
                            }
                            return prev;
                          });

                          // Wait a bit then force refresh from database
                          setTimeout(async () => {
                            await fetchAppointmentDetails();
                          }, 1000);

                          setUpdatingStatus(false);
                          Alert.alert('Success', 'Appointment accepted', [
                            { text: 'OK' }
                          ]);
                        } else {
                          console.error('❌ Failed to accept appointment:', res.error);
                          Alert.alert('Error', 'Failed to accept appointment. Please try again.');
                          setUpdatingStatus(false);
                        }
                      }
                    }}
                    disabled={updatingStatus}
                    activeOpacity={0.8}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>Accept</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={async () => {
                      if (appointment?.id) {
                        setUpdatingStatus(true);
                        const res = await updateBookingStatusRemote(appointment.id, 'Cancelled');
                        if (res.success) {
                          updateBookingStatus(appointment.id, 'Cancelled');
                          trackEvent('Doctor Appointment Cancelled', {
                            appointment_id: appointment.id,
                            patient_name: appointment.customerName,
                            appointment_amount: appointment.amount,
                            appointment_location: appointment.location,
                            source: 'details_screen',
                          });
                          fetchAppointmentDetails();
                          Alert.alert('Success', 'Appointment cancelled', [
                            { text: 'OK', onPress: () => navigation.goBack() }
                          ]);
                        } else {
                          Alert.alert('Error', 'Failed to cancel appointment. Please try again.');
                        }
                        setUpdatingStatus(false);
                      }
                    }}
                    disabled={updatingStatus}
                    activeOpacity={0.8}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator size="small" color="#FF3B30" />
                    ) : (
                      <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>Cancel</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.completeButton,
                      {
                        backgroundColor: (appointment?.paymentStatus || '').toLowerCase() === 'paid' ? '#26e07f' : '#d1d5db',
                        opacity: (appointment?.paymentStatus || '').toLowerCase() === 'paid' ? 1 : 0.6,
                      }
                    ]}
                    onPress={async () => {
                      const paymentStatus = (appointment?.paymentStatus || '').toLowerCase();
                      if (paymentStatus !== 'paid') {
                        Alert.alert('Payment Required', 'Please wait for payment to be completed before marking this appointment as completed.');
                        return;
                      }

                      // Validate that doctor has filled required fields
                      const hasDiagnosis = diagnosis.trim() !== '';
                      const hasPrescription = prescriptionUrl !== null || prescriptionFile !== null;
                      const hasDoctorNotes = doctorNotes.trim() !== '';

                      if (!hasDiagnosis || !hasPrescription || !hasDoctorNotes) {
                        const missingFields = [];
                        if (!hasDiagnosis) missingFields.push('Diagnosis');
                        if (!hasPrescription) missingFields.push('Prescription');
                        if (!hasDoctorNotes) missingFields.push('Additional Notes');

                        Alert.alert(
                          'Required Fields Missing',
                          `Please fill in the following fields before completing the appointment:\n\n• ${missingFields.join('\n• ')}\n\nThese fields are required to complete the appointment.`,
                          [
                            { text: 'OK' }
                          ]
                        );
                        return;
                      }

                      // If prescription file is selected but not uploaded, upload it first
                      if (prescriptionFile && !prescriptionUrl) {
                        Alert.alert(
                          'Save Required',
                          'Please save your notes first to upload the prescription, then complete the appointment.',
                          [{ text: 'OK' }]
                        );
                        return;
                      }

                      // Ensure data is saved before completing
                      if (appointment?.id && user?.id) {
                        try {
                          const patient = await PatientsService.getByBookingId(appointment.id);
                          if (patient) {
                            // Save doctor data one more time to ensure it's persisted
                            const updateData: {
                              diagnosis?: string | null;
                              prescription?: string | null;
                              doctor_notes?: string | null;
                            } = {
                              diagnosis: diagnosis.trim(),
                              prescription: prescriptionUrl,
                              doctor_notes: doctorNotes.trim(),
                            };

                            const saved = await PatientsService.updateByDoctor(patient.id, user.id, updateData);
                            if (!saved) {
                              Alert.alert('Error', 'Failed to save doctor notes. Please try again.');
                              return;
                            }
                          }
                        } catch (error) {
                          console.error('Error saving doctor data before completion:', error);
                          Alert.alert('Error', 'Failed to save doctor notes. Please try again.');
                          return;
                        }
                      }

                      if (appointment?.id) {
                        setUpdatingStatus(true);
                        // updateBookingStatusRemote will handle updating bookings table and patients table
                        const res = await updateBookingStatusRemote(appointment.id, 'Completed');
                        if (res.success) {
                          updateBookingStatus(appointment.id, 'Completed');
                          trackEvent('Doctor Appointment Completed', {
                            appointment_id: appointment.id,
                            patient_name: appointment.customerName,
                            appointment_amount: appointment.amount,
                            appointment_location: appointment.location,
                            service_name: appointment.serviceName,
                            has_diagnosis: true,
                            has_prescription: true,
                            has_notes: true,
                            source: 'details_screen',
                          });
                          fetchAppointmentDetails();
                          Alert.alert('Success', 'Appointment completed', [
                            { text: 'OK', onPress: () => navigation.goBack() }
                          ]);
                        } else {
                          Alert.alert('Error', 'Failed to complete appointment. Please try again.');
                        }
                        setUpdatingStatus(false);
                      }
                    }}
                    disabled={updatingStatus || (appointment?.paymentStatus || '').toLowerCase() !== 'paid'}
                    activeOpacity={0.8}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>Completed</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })()}
      </ScrollView>

      {/* Full Text Modal */}
      <Modal
        visible={fullTextModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullTextModal({ visible: false, title: '', text: '' })}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{fullTextModal.title}</Text>
              <TouchableOpacity
                onPress={() => setFullTextModal({ visible: false, title: '', text: '' })}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={moderateScale(24)} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
              <Text style={[styles.modalText, { color: colors.text }]}>{fullTextModal.text}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: moderateScale(10),
    paddingBottom: moderateScale(16),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(10),
  },
  backButtonHeader: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(40),
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(40),
  },
  loadingText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(40),
  },
  errorText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginBottom: moderateScale(24),
  },
  backButton: {
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(24),
    borderRadius: moderateScale(12),
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  card: {
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    marginBottom: moderateScale(16),
    borderWidth: 1,
  },
  headerSection: {
    marginBottom: moderateScale(20),
  },
  divider: {
    height: 1,
    marginVertical: moderateScale(16),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: moderateScale(40),
    gap: moderateScale(12),
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10),
    flexShrink: 1,
    minWidth: moderateScale(120),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
    gap: moderateScale(8),
  },
  cardTitle: {
    fontSize: moderateScale(16),
    fontWeight: '800',
  },
  infoValue: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    flexShrink: 1,
  },
  infoLabel: {
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  statusTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: moderateScale(20),
  },
  timelineContainer: {
    marginLeft: moderateScale(8),
  },
  timelineWrapper: {
    position: 'relative',
    paddingLeft: moderateScale(20),
  },
  statusTrack: {
    position: 'absolute',
    left: moderateScale(29),
    width: 2,
    top: moderateScale(22),
    bottom: moderateScale(22),
  },
  statusProgress: {
    position: 'absolute',
    left: moderateScale(29),
    width: 2,
    top: moderateScale(22),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(10),
  },
  statusDotContainer: {
    width: moderateScale(20),
    height: moderateScale(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  statusDot: {
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: moderateScale(6),
    borderWidth: 2,
  },
  statusDotActive: {
    backgroundColor: '#0BB48F',
    borderColor: '#0BB48F',
  },
  statusDotIdle: {
    backgroundColor: '#ffffff',
    borderColor: '#E5E7EB',
  },
  statusCheckmark: {
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: moderateScale(6),
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: moderateScale(18),
  },
  actionsContainer: {
    marginTop: moderateScale(8),
    gap: moderateScale(12),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(16),
    borderRadius: moderateScale(14),
    gap: moderateScale(8),
  },
  rejectButton: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  acceptButton: {
    backgroundColor: '#26e07f',
  },
  cancelButton: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  completeButton: {
    backgroundColor: '#26e07f',
  },
  actionButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: moderateScale(20),
  },
  modalContent: {
    width: '100%',
    maxWidth: moderateScale(400),
    maxHeight: '80%',
    borderRadius: moderateScale(16),
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: moderateScale(20),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    flex: 1,
  },
  modalCloseButton: {
    padding: moderateScale(4),
  },
  modalScrollView: {
    maxHeight: moderateScale(400),
  },
  modalText: {
    fontSize: moderateScale(16),
    lineHeight: moderateScale(24),
    padding: moderateScale(20),
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: moderateScale(20),
  },
  inputSection: {
    marginBottom: moderateScale(20),
  },
  inputLabel: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    marginBottom: moderateScale(8),
  },
  textInput: {
    borderWidth: 1,
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    fontSize: moderateScale(14),
    minHeight: moderateScale(100),
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(16),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    gap: moderateScale(8),
  },
  uploadButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  prescriptionContainer: {
    gap: moderateScale(12),
  },
  prescriptionPreview: {
    borderRadius: moderateScale(12),
    borderWidth: 1,
    padding: moderateScale(12),
    position: 'relative',
    minHeight: moderateScale(150),
    justifyContent: 'center',
    alignItems: 'center',
  },
  prescriptionImage: {
    width: '100%',
    height: moderateScale(200),
    borderRadius: moderateScale(8),
  },
  prescriptionFileContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
  },
  prescriptionFileName: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    textAlign: 'center',
  },
  removePrescriptionButton: {
    position: 'absolute',
    top: moderateScale(8),
    right: moderateScale(8),
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(12),
  },
  selectedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(12),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    marginTop: moderateScale(8),
    gap: moderateScale(8),
  },
  selectedFileName: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    flex: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    gap: moderateScale(8),
    marginTop: moderateScale(8),
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(15),
    fontWeight: '800',
  },
  requiredFieldsIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: moderateScale(12),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    marginTop: moderateScale(12),
    gap: moderateScale(8),
  },
  requiredFieldsText: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    flex: 1,
    lineHeight: moderateScale(16),
  },
  readOnlyTextContainer: {
    borderWidth: 1,
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    minHeight: moderateScale(100),
  },
  readOnlyText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
  },
});

export default DoctorAppointmentDetailsScreen;
