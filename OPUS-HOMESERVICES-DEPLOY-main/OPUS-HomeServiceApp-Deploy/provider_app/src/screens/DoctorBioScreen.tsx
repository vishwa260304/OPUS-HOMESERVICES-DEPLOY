import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { getDoctorDetails, upsertDoctorDetails, updateDoctorBio } from '../lib/doctorDetailsHelper';
import { moderateScale } from '../utils/responsive';
import { useScreenTracking } from '../hooks/useScreenTracking';
import { trackEvent } from '../services/analytics';
import BackButton from '../components/BackButton';

const MAX_BIO_LENGTH = 250;
const MIN_BIO_LENGTH = 50;

const DoctorBioScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consultationFee, setConsultationFee] = useState<string>('');
  const bioInputRef = useRef<TextInput>(null);

  // Check if this is onboarding mode
  const isOnboarding = (route.params as any)?.onboarding === true;

  // Default blue theme
  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];
  const sectorPrimary = '#3B5BFD';

  // Track screen view
  useScreenTracking('Doctor Bio Screen', {
    is_onboarding: isOnboarding,
    has_existing_bio: bio.length > 0,
    bio_length: bio.length,
  });

  useEffect(() => {
    if (!isOnboarding) {
      fetchDoctorBio();
    } else {
      setLoading(false);
    }
  }, [user, isOnboarding]);

  const fetchDoctorBio = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('providers_doctor_details')
        .select('doctor_bio, consultation_fee')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching doctor bio:', error);
      } else if (data) {
        setBio((data as any).doctor_bio || '');
        const feeVal = (data as any).consultation_fee;
        if (feeVal !== null && feeVal !== undefined) {
          setConsultationFee(String(feeVal));
        }
      }
    } catch (error) {
      console.error('Error fetching doctor bio:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to continue');
      return;
    }

    const trimmedBio = bio.trim();

    if (trimmedBio.length > 0 && trimmedBio.length < MIN_BIO_LENGTH) {
      Alert.alert(
        'Bio Too Short',
        `Please write at least ${MIN_BIO_LENGTH} characters about yourself.`
      );
      return;
    }

    if (trimmedBio.length > MAX_BIO_LENGTH) {
      Alert.alert('Bio Too Long', `Please keep your bio under ${MAX_BIO_LENGTH} characters.`);
      return;
    }

    try {
      setSaving(true);

      // Ensure a doctor_details row exists to satisfy NOT NULL constraints
      let hasRow = false;
      try {
        const existing = await getDoctorDetails(user.id);
        hasRow = !!existing.data && !existing.error;
      } catch {}

      if (!hasRow) {
        const fallbackName =
          (user as any)?.user_metadata?.full_name ||
          (user as any)?.user_metadata?.name ||
          (user.email ? String(user.email).split('@')[0] : null) ||
          'Doctor';

        const createResult = await upsertDoctorDetails(user.id, {
          doctor_name: fallbackName,
          medical_registration_number: 'N/A',
          address: 'N/A',
          doctor_bio: trimmedBio.length > 0 ? trimmedBio : null,
          consultation_fee: consultationFee === '' ? null : Number(consultationFee),
        });

        if (createResult.error) {
          console.error('Error creating doctor row:', createResult.error);
          Alert.alert('Error', createResult.error.message || 'Failed to save bio');
          return;
        }
      } else {
        const updateResult = await supabase
          .from('providers_doctor_details')
          .update({
            doctor_bio: trimmedBio.length > 0 ? trimmedBio : null,
            consultation_fee: consultationFee === '' ? null : Number(consultationFee),
          })
          .eq('user_id', user.id)
          .select();
        if (updateResult.error) {
          console.error('Error updating bio:', updateResult.error);
          Alert.alert('Error', updateResult.error.message || 'Failed to save bio');
          return;
        }
      }

      // Track analytics
      trackEvent('Doctor Bio Updated', {
        is_onboarding: isOnboarding,
        bio_length: trimmedBio.length,
        was_skipped: trimmedBio.length === 0,
      });

      if (isOnboarding) {
        // Navigate to dashboard after onboarding
        (navigation as any).reset({
          index: 0,
          routes: [{ name: 'DoctorDashboard' }],
        });
      } else {
        Alert.alert('Success', 'Your bio has been saved.', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error saving bio:', error);
      Alert.alert('Error', 'Failed to save bio');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    trackEvent('Doctor Bio Skipped', {
      is_onboarding: isOnboarding,
      had_content: bio.length > 0,
    });

    if (isOnboarding) {
      // Navigate to dashboard
      (navigation as any).reset({
        index: 0,
        routes: [{ name: 'DoctorDashboard' }],
      });
    } else {
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={sectorPrimary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />
      
      {/* Header */}
      <LinearGradient colors={sectorGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.header}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <View style={styles.headerContent}>
            {isOnboarding ? (
              <View style={styles.headerSpacer} />
            ) : (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="chevron-back" size={moderateScale(24)} color="#ffffff" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>Professional Bio</Text>
            <View style={styles.headerSpacer} />
          </View>
          {isOnboarding && (
            <Text style={styles.headerSubtitle}>
              Step 3 of 3: Tell patients about yourself
            </Text>
          )}
        </SafeAreaView>
      </LinearGradient>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Professional Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            Write Your Professional Bio
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Share your medical expertise, specialization, and experience. This information helps patients 
            understand your qualifications and choose the right doctor for their needs.
          </Text>
        </View>

        {/* Skip Notice - Only show in onboarding */}
        {isOnboarding && (
          <View style={[styles.skipNotice, { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' }]}>
            <Ionicons name="information-circle-outline" size={moderateScale(18)} color="#666" />
            <Text style={styles.skipNoticeText}>
              You can skip this step and complete it later in{' '}
              <Text style={styles.skipNoticeBold}>Profile → My Account → About Doctor (Bio)</Text>
            </Text>
          </View>
        )}

        {/* Bio Input */}
        <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
          <View style={styles.inputHeader}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Bio</Text>
            <Text style={[styles.characterCount, { color: colors.textSecondary }]}>
              {bio.length} / {MAX_BIO_LENGTH}
            </Text>
          </View>

          <TextInput
            ref={bioInputRef}
            style={[
              styles.bioInput,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: bio.length > 0 && bio.length < MIN_BIO_LENGTH ? '#FF6B6B' : colors.border,
              },
            ]}
            value={bio}
            onChangeText={setBio}
            placeholder="Example: Dr. [Name] is a board-certified [Specialization] with [X] years of experience. Specialized in [areas], committed to providing evidence-based care..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
            maxLength={MAX_BIO_LENGTH}
            blurOnSubmit={false}
            returnKeyType="default"
          />

          {/* Validation Message */}
          {bio.length > 0 && bio.length < MIN_BIO_LENGTH && (
            <View style={styles.validationMessage}>
              <Ionicons name="alert-circle" size={moderateScale(14)} color="#FF6B6B" />
              <Text style={styles.validationText}>
                Minimum {MIN_BIO_LENGTH} characters required ({MIN_BIO_LENGTH - bio.length} more)
              </Text>
            </View>
          )}

          {/* Helpful Guidelines */}
          <View style={styles.guidelinesContainer}>
            <Text style={[styles.guidelinesTitle, { color: colors.textSecondary }]}>Guidelines:</Text>
            <View style={styles.guidelinesList}>
              <Text style={[styles.guidelineItem, { color: colors.textSecondary }]}>
                • Minimum {MIN_BIO_LENGTH} characters recommended
              </Text>
              <Text style={[styles.guidelineItem, { color: colors.textSecondary }]}>
                • Mention your specialization and experience
              </Text>
              <Text style={[styles.guidelineItem, { color: colors.textSecondary }]}>
                • Keep it professional and concise
              </Text>
            </View>
          </View>
          {/* Consultation Fee */}
          <View style={{ marginTop: moderateScale(16) }}>
            <Text style={[styles.inputLabel, { color: colors.text, marginBottom: moderateScale(8) }]}>Consultation Fee (₹)</Text>
            <TextInput
              style={[
                styles.bioInput,
                {
                  color: colors.text,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  minHeight: moderateScale(48),
                  maxHeight: moderateScale(60),
                },
              ]}
              value={consultationFee}
              onChangeText={(t) => {
                // allow only digits
                const digitsOnly = t.replace(/[^0-9]/g, '');
                setConsultationFee(digitsOnly);
              }}
              placeholder="e.g., 500"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              returnKeyType="done"
              multiline={false}
              numberOfLines={1}
            />
          </View>
        </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {isOnboarding && (
          <TouchableOpacity
            style={[styles.skipButton, { borderColor: colors.border }]}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>Skip for now</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor:
                bio.length === 0 || bio.length >= MIN_BIO_LENGTH ? sectorPrimary : colors.border,
              opacity: bio.length === 0 || bio.length >= MIN_BIO_LENGTH ? 1 : 0.5,
              flex: isOnboarding ? 2 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={saving || (bio.length > 0 && bio.length < MIN_BIO_LENGTH)}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={moderateScale(18)} color="#ffffff" />
              <Text style={styles.saveButtonText}>
                {isOnboarding ? 'Continue' : 'Save Bio'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: moderateScale(16),
    fontSize: moderateScale(16),
  },
  header: {
    paddingTop: moderateScale(10),
    paddingBottom: moderateScale(20),
    paddingHorizontal: moderateScale(20),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: moderateScale(8),
  },
  backButton: {
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: moderateScale(22),
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#E8F5E9',
    fontSize: moderateScale(14),
    textAlign: 'center',
    marginTop: moderateScale(4),
  },
  headerSpacer: {
    width: moderateScale(40),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: moderateScale(20),
    paddingBottom: moderateScale(100),
  },
  infoCard: {
    borderRadius: moderateScale(12),
    padding: moderateScale(20),
    marginBottom: moderateScale(20),
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  infoTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    marginBottom: moderateScale(8),
  },
  infoText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
  },
  skipNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: moderateScale(12),
    padding: moderateScale(14),
    marginBottom: moderateScale(20),
    borderWidth: 1,
    gap: moderateScale(10),
  },
  skipNoticeText: {
    fontSize: moderateScale(13),
    color: '#666',
    flex: 1,
    lineHeight: moderateScale(18),
  },
  skipNoticeBold: {
    fontWeight: '600',
    color: '#333',
  },
  inputContainer: {
    borderRadius: moderateScale(12),
    padding: moderateScale(20),
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(12),
  },
  inputLabel: {
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  characterCount: {
    fontSize: moderateScale(13),
  },
  bioInput: {
    borderRadius: moderateScale(8),
    padding: moderateScale(16),
    fontSize: moderateScale(15),
    minHeight: moderateScale(180),
    maxHeight: moderateScale(300),
    textAlignVertical: 'top',
    borderWidth: 1,
    marginBottom: moderateScale(12),
    lineHeight: moderateScale(22),
  },
  validationMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(12),
    gap: moderateScale(6),
  },
  validationText: {
    fontSize: moderateScale(12),
    color: '#FF6B6B',
    flex: 1,
  },
  guidelinesContainer: {
    marginTop: moderateScale(8),
    paddingTop: moderateScale(12),
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  guidelinesTitle: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    marginBottom: moderateScale(8),
  },
  guidelinesList: {
    gap: moderateScale(4),
  },
  guidelineItem: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: moderateScale(16),
    gap: moderateScale(12),
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  skipButton: {
    flex: 1,
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(10),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '500',
  },
  saveButton: {
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: moderateScale(8),
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(15),
    fontWeight: '600',
  },
});

export default DoctorBioScreen;
