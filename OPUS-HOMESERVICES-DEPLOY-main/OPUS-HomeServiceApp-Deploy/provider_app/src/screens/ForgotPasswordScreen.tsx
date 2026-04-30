import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { moderateScale } from '../utils/responsive';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../types/navigation';

const ForgotPasswordScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOTP = async () => {
    const cleaned = phoneNumber.replace(/[^0-9]/g, '');

    if (cleaned.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    
    try {
      const phone = `+91${cleaned}`;
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        throw error;
      }

      navigation.navigate('VerifyOTP', { phone });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#0A0F4A", "#001973"]} start={{x:0,y:0}} end={{x:0,y:1}} style={styles.gradientBg}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F4A" />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={moderateScale(24)} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Brand Section */}
            <View style={styles.brandSection}>
              <View style={styles.logoContainer}>
                <View style={styles.logoCircle}>
                  <Ionicons name="key-outline" size={moderateScale(32)} color="#FFFFFF" />
                </View>
                <Text style={styles.brandName}>Fixit</Text>
              </View>
              <Text style={styles.title}>Forgot Password</Text>
              <Text style={styles.subtitle}>Reset your password</Text>
            </View>

            {/* Instruction Section */}
            <View style={styles.instructionSection}>
              <Text style={styles.instructionText}>
                Enter your phone number and we'll send you an OTP to reset your password
              </Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={moderateScale(20)} color="#8E9BB9" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter your phone number"
                    placeholderTextColor="#8E9BB9"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Send OTP Button */}
              <TouchableOpacity
                style={[styles.sendOTPButton, isLoading && styles.sendOTPButtonDisabled]}
                onPress={handleSendOTP}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isLoading ? ['#6B7280', '#4B5563'] : ['#3B5BFD', '#2563EB']}
                  start={{x:0,y:0}}
                  end={{x:1,y:0}}
                  style={styles.sendOTPButtonGradient}
                >
                  <Text style={styles.sendOTPButtonText}>
                    {isLoading ? 'Sending OTP...' : 'Send OTP'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Help Section */}
            <View style={styles.helpSection}>
              <Text style={styles.helpText}>
                Didn't receive the OTP?{' '}
                <Text style={styles.helpLink}>Resend</Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBg: { 
    flex: 1 
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: moderateScale(24),
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(20),
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(20),
  },
  backButton: {
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Brand Section
  brandSection: {
    alignItems: 'center',
    marginBottom: moderateScale(40),
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: moderateScale(24),
  },
  logoCircle: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: moderateScale(16),
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  brandName: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  title: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: moderateScale(8),
  },
  subtitle: {
    fontSize: moderateScale(16),
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
  },

  // Instruction Section
  instructionSection: {
    marginBottom: moderateScale(32),
  },
  instructionText: {
    fontSize: moderateScale(16),
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: moderateScale(24),
    fontWeight: '400',
  },

  // Form Section
  formSection: {
    marginBottom: moderateScale(32),
  },
  inputContainer: {
    marginBottom: moderateScale(24),
  },
  inputLabel: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: moderateScale(8),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: moderateScale(16),
    paddingHorizontal: moderateScale(16),
    height: moderateScale(56),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  inputIcon: {
    marginRight: moderateScale(12),
  },
  textInput: {
    flex: 1,
    fontSize: moderateScale(16),
    color: '#1F2937',
    fontWeight: '500',
  },

  // Send OTP Button
  sendOTPButton: {
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    shadowColor: '#3B5BFD',
    shadowOpacity: 0.3,
    shadowRadius: moderateScale(12),
    shadowOffset: { width: 0, height: moderateScale(6) },
    elevation: 8,
  },
  sendOTPButtonDisabled: {
    shadowOpacity: 0.1,
    elevation: 2,
  },
  sendOTPButtonGradient: {
    paddingVertical: moderateScale(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOTPButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Help Section
  helpSection: {
    alignItems: 'center',
    marginTop: moderateScale(20),
  },
  helpText: {
    fontSize: moderateScale(14),
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
  },
  helpLink: {
    color: '#60A5FA',
    fontWeight: '600',
  },
});

export default ForgotPasswordScreen;
