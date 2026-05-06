import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getSelectedSector, getDoctorSpecializations, setDoctorSpecializations } from '../utils/appState';
import { getDoctorDetails, upsertDoctorDetails } from '../lib/doctorDetailsHelper';
import { supabase } from '../lib/supabase';
import BackButton from '../components/BackButton';
import { useScreenTracking } from '../hooks/useScreenTracking';
import { trackEvent } from '../services/analytics';

interface Specialization {
  id: string;
  name: string;
  icon: string;
  category: string;
}

const specializations: Specialization[] = [
  { id: 'general', name: 'General Physician', icon: 'medical-outline', category: 'Medicine' },
  { id: 'cardiology', name: 'Cardiology', icon: 'heart-outline', category: 'Medicine' },
  { id: 'pediatrics', name: 'Pediatrics', icon: 'happy-outline', category: 'Medicine' },
  { id: 'orthopedics', name: 'Orthopedics', icon: 'body-outline', category: 'Surgery' },
  { id: 'dermatology', name: 'Dermatology', icon: 'sparkles-outline', category: 'Medicine' },
  { id: 'gynecology', name: 'Gynecology & Obstetrics', icon: 'female-outline', category: 'Medicine' },
  { id: 'psychiatry', name: 'Psychiatry', icon: 'chatbubbles-outline', category: 'Medicine' },
  { id: 'ent', name: 'ENT', icon: 'ear-outline', category: 'Surgery' },
  { id: 'neurology', name: 'Neurology', icon: 'albums-outline', category: 'Medicine' },
  { id: 'ophthalmology', name: 'Ophthalmology', icon: 'eye-outline', category: 'Surgery' },
  { id: 'gastroenterology', name: 'Gastroenterology', icon: 'restaurant-outline', category: 'Medicine' },
  { id: 'urology', name: 'Urology', icon: 'medical-outline', category: 'Surgery' },
  { id: 'pulmonology', name: 'Pulmonology', icon: 'airplane-outline', category: 'Medicine' },
  { id: 'endocrinology', name: 'Endocrinology', icon: 'flask-outline', category: 'Medicine' },
  { id: 'oncology', name: 'Oncology', icon: 'medical-outline', category: 'Medicine' },
];

const DoctorSpecializationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Track screen view
  useScreenTracking('Doctor Specialization Screen', {
    is_edit_mode: (route.params as any)?.editMode || false,
    existing_specializations_count: selectedSpecializations.length,
  });

  const isEditMode = (route.params as any)?.editMode || false;
  const isHealthcare = (getSelectedSector?.() === 'healthcare' || getSelectedSector?.() === 'doctor consultation');
  const sectorGradient: [string, string] = isHealthcare ? ['#0BB48F', '#0A8F6A'] : ['#004c8f', '#0c1a5d'];
  const sectorPrimary = isHealthcare ? '#0AAE8A' : '#004c8f';

  useEffect(() => {
    // Load existing specializations if in edit mode
    if (isEditMode) {
      const loadSpecializations = async () => {
        const existing = await getDoctorSpecializations();
        setSelectedSpecializations(existing.map((s: any) => s.id));
      };
      loadSpecializations();
    }
  }, [isEditMode]);

  const filteredSpecializations = specializations.filter(spec =>
    spec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    spec.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSpecialization = (id: string) => {
    setSelectedSpecializations(prev => {
      if (prev.includes(id)) {
        return prev.filter(s => s !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleContinue = async () => {
    if (selectedSpecializations.length === 0) {
      // Show alert or validation message
      trackEvent('Doctor Specialization Selection Failed', {
        reason: 'no_specializations_selected',
      });
      return;
    }

    // Save selected specializations
    const selectedSpecs = specializations
      .filter(s => selectedSpecializations.includes(s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        category: s.category,
      }));

    await setDoctorSpecializations(selectedSpecs);

    // Persist to providers_doctor_details.doctor_speciality as a comma-separated list
    try {
      const specialtyCsv = selectedSpecs.map(s => s.name).join(', ');
      const userId = user?.id || '';
      if (!userId) {
        trackEvent('Doctor Specialization Save Error', { message: 'missing_user_id' });
        return;
      }

      // Ensure a row exists to satisfy NOT NULL constraints on required fields
      let exists = false;
      try {
        const existing = await getDoctorDetails(userId);
        exists = !!existing.data && !existing.error;
      } catch {}

      if (!exists) {
        const fallbackName =
          (user as any)?.user_metadata?.full_name ||
          (user as any)?.user_metadata?.name ||
          (user?.email ? String(user.email).split('@')[0] : null) ||
          'Doctor';

        const createRes = await upsertDoctorDetails(userId, {
          doctor_name: fallbackName,
          medical_registration_number: 'N/A',
          address: 'N/A',
        });
        if (createRes.error) {
          trackEvent('Doctor Specialization Save Error', { message: createRes.error.message || 'create_row_failed' });
          return;
        }
      }

      // Update specialization only (avoid accidental inserts)
      const { error: updateError } = await supabase
        .from('providers_doctor_details')
        .update({ doctor_speciality: specialtyCsv })
        .eq('user_id', userId);

      if (updateError) {
        trackEvent('Doctor Specialization Save Error', { message: updateError.message || 'unknown_update_error' });
      } else {
        trackEvent('Doctor Specialization Saved To DB', { specialty_csv: specialtyCsv });
      }
    } catch (e: any) {
      trackEvent('Doctor Specialization Save Exception', { message: String(e?.message || e) });
    }

    // Track specialization selection
    trackEvent('Doctor Specializations Selected', {
      specialization_count: selectedSpecs.length,
      specializations: selectedSpecs.map(s => s.name),
      specialization_ids: selectedSpecs.map(s => s.id),
      categories: [...new Set(selectedSpecs.map(s => s.category))],
    });

    // After selecting specializations, navigate to DoctorBio (Step 3 of onboarding)
    (navigation as any).navigate('DoctorBio', { onboarding: true });
  };

  // Removed skip behavior to enforce specialization selection

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />
      
      {/* Header */}
      <LinearGradient colors={sectorGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.headerGradient}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <View style={styles.headerRow}>
            {!isEditMode && (
              <BackButton style={styles.backButton} color="#ffffff" size={moderateScale(24)} />
            )}
            {isEditMode && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="chevron-back" size={moderateScale(24)} color="#ffffff" />
              </TouchableOpacity>
            )}
            <Text style={styles.headerTitle}>
              {isEditMode ? 'Edit Specializations' : 'Choose Your Specialization'}
            </Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
          {!isEditMode && (
            <Text style={styles.headerSubtitle}>
              Select one or more specialties you practice
            </Text>
          )}
        </SafeAreaView>
      </LinearGradient>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={moderateScale(20)} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search specializations..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={moderateScale(20)} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Selection Info */}
        {selectedSpecializations.length > 0 && (
          <View style={[styles.selectionInfo, { backgroundColor: '#E3F2FD', borderColor: sectorPrimary }]}>
            <Ionicons name="checkmark-circle" size={moderateScale(20)} color={sectorPrimary} />
            <Text style={[styles.selectionInfoText, { color: sectorPrimary }]}>
              {selectedSpecializations.length} specialization{selectedSpecializations.length !== 1 ? 's' : ''} selected
            </Text>
          </View>
        )}

        {/* Specializations Grid */}
        <View style={styles.gridContainer}>
          {filteredSpecializations.map((spec) => {
            const isSelected = selectedSpecializations.includes(spec.id);
            return (
              <TouchableOpacity
                key={spec.id}
                style={[
                  styles.specCard,
                  { 
                    backgroundColor: colors.card, 
                    borderColor: isSelected ? sectorPrimary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  }
                ]}
                onPress={() => toggleSpecialization(spec.id)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.iconContainer,
                  { backgroundColor: isSelected ? `${sectorPrimary}15` : colors.surface }
                ]}>
                  <Ionicons 
                    name={spec.icon as any} 
                    size={moderateScale(32)} 
                    color={isSelected ? sectorPrimary : colors.textSecondary} 
                  />
                </View>
                <Text style={[
                  styles.specName,
                  { color: isSelected ? sectorPrimary : colors.text }
                ]}>
                  {spec.name}
                </Text>
                <Text style={[styles.specCategory, { color: colors.textSecondary }]}>
                  {spec.category}
                </Text>
                {isSelected && (
                  <View style={[styles.checkmarkBadge, { backgroundColor: sectorPrimary }]}>
                    <Ionicons name="checkmark" size={moderateScale(16)} color="#ffffff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {filteredSpecializations.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={moderateScale(48)} color={colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: colors.text }]}>No specializations found</Text>
            <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
              Try adjusting your search query
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={[styles.bottomActions, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {/* Skip button removed to require selection */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            { 
              backgroundColor: selectedSpecializations.length > 0 ? sectorPrimary : colors.border,
              opacity: selectedSpecializations.length > 0 ? 1 : 0.5,
            }
          ]}
          onPress={handleContinue}
          disabled={selectedSpecializations.length === 0}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={selectedSpecializations.length > 0 ? sectorGradient : [colors.border, colors.border]}
            style={styles.continueButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <Text style={styles.continueButtonText}>
              {isEditMode ? 'Save Changes' : 'Continue'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(20),
    paddingTop: moderateScale(10),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(8),
  },
  backButton: {
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: moderateScale(24),
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#cfe0ff',
    fontSize: moderateScale(14),
    marginTop: moderateScale(4),
    textAlign: 'center',
  },
  scrollContent: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(100),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: moderateScale(12),
    borderWidth: 1,
    paddingHorizontal: moderateScale(12),
    height: moderateScale(48),
    marginBottom: moderateScale(16),
  },
  searchIcon: {
    marginRight: moderateScale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(16),
    paddingVertical: 0,
  },
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(12),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    marginBottom: moderateScale(16),
  },
  selectionInfoText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    marginLeft: moderateScale(8),
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: moderateScale(12),
  },
  specCard: {
    width: '48%',
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    alignItems: 'center',
    marginBottom: moderateScale(12),
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: moderateScale(12),
  },
  specName: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: moderateScale(4),
  },
  specCategory: {
    fontSize: moderateScale(12),
    textAlign: 'center',
  },
  checkmarkBadge: {
    position: 'absolute',
    top: moderateScale(8),
    right: moderateScale(8),
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: moderateScale(60),
  },
  emptyStateText: {
    fontWeight: '600',
    fontSize: moderateScale(16),
    marginTop: moderateScale(12),
  },
  emptyStateSubtext: {
    fontSize: moderateScale(14),
    marginTop: moderateScale(4),
    textAlign: 'center',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: moderateScale(16),
    borderTopWidth: 1,
    gap: moderateScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  skipButton: {
    flex: 1,
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  continueButton: {
    flex: 2,
    borderRadius: moderateScale(12),
    overflow: 'hidden',
  },
  continueButtonGradient: {
    paddingVertical: moderateScale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(16),
    fontWeight: '800',
  },
});

export default DoctorSpecializationScreen;

