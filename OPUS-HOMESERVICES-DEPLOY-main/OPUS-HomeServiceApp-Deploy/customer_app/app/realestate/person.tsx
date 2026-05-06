import React, { useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, StatusBar, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { PropertyApplicationsApi } from '../../lib/propertyApplications';
import { hapticButtonPress, hapticSuccess } from '../../utils/haptics';

export default function PersonDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [houseType, setHouseType] = useState('');
  const [houseAddress, setHouseAddress] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Check if all required fields are filled
  const isFormValid = name.trim() !== '' && 
                     address.trim() !== '' && 
                     phone.trim() !== '' && 
                     houseType.trim() !== '' && 
                     houseAddress.trim() !== '';

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const renderInputField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    icon: any,
    keyboardType: any = 'default',
    fieldName: string
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
            onFocus={() => setFocusedField(fieldName)}
            onBlur={() => setFocusedField(null)}
            style={[styles.input, { color: colors.text }]}
          />
        </View>
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
            <Text style={[styles.headerTitle, { color: colors.text }]}>Post Your Property</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Step 1 of 3</Text>
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
                  Tell us about yourself
                </Text>
              </View>
            </View>

            {renderInputField('Full Name', name, setName, 'Enter your full name', 'person-outline', 'default', 'name')}
            {renderInputField('Address', address, setAddress, 'Enter your address', 'location-outline', 'default', 'address')}
            {renderInputField('Phone Number', phone, setPhone, 'Enter your phone number', 'call-outline', 'phone-pad', 'phone')}
          </View>

          {/* Property Information Section */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconBg, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="home" size={24} color={colors.secondary} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Property Details</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Information about your property
                </Text>
              </View>
            </View>

            {renderInputField('Property Type', houseType, setHouseType, 'e.g., Apartment, Villa, Commercial', 'business-outline', 'default', 'houseType')}
            {renderInputField('Property Address', houseAddress, setHouseAddress, 'Enter property address', 'navigate-outline', 'default', 'houseAddress')}
          </View>

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.secondary + '10', borderColor: colors.secondary + '30' }]}>
            <Ionicons name="information-circle" size={20} color={colors.secondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              Your information is secure and will only be used to verify your property listing.
            </Text>
          </View>
        </ScrollView>

        {/* Fixed Bottom Button */}
        <View style={[styles.bottomContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.primaryBtn,
              !isFormValid && styles.primaryBtnDisabled
            ]}
            disabled={!isFormValid}
            onPress={async () => {
              if (!isFormValid) return;
              
              hapticButtonPress();
              try {
                if (!user?.id) {
                  throw new Error('Please sign in to continue');
                }
                await PropertyApplicationsApi.create({
                  full_name: name || null,
                  address: address || null,
                  phone: phone || null,
                  house_type: houseType || null,
                  house_address: houseAddress || null,
                });
                hapticSuccess();
                router.push({ pathname: '/realestate/kyc', params: { name, address, phone, houseType, houseAddress } });
              } catch (e) {
                console.error('Failed to save application', e);
              }
            }}
          >
            <LinearGradient
              colors={isFormValid ? [colors.secondary, colors.secondary + 'dd'] : [colors.textSecondary, colors.textSecondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.primaryBtnText}>
                {isFormValid ? 'Continue to KYC' : 'Fill all fields to continue'}
              </Text>
              {isFormValid && <Ionicons name="arrow-forward" size={20} color="#fff" />}
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
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
});