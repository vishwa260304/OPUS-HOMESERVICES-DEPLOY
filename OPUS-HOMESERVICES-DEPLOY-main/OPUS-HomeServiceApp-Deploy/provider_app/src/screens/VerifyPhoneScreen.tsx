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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../types/navigation';

const INDIA_CODE = '+91 ';

const VerifyPhoneScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [phoneNumber, setPhoneNumber] = useState<string>(INDIA_CODE);

  const normalizePhone = (input: string) => {
    // Ensure the value always starts with "+91 " and allow only digits after it
    const trimmed = input.startsWith(INDIA_CODE) ? input.slice(INDIA_CODE.length) : input.replace(/^\+91\s?/, '');
    const digits = trimmed.replace(/\D/g, '');
    return INDIA_CODE + digits;
  };

  const handleChange = (value: string) => {
    setPhoneNumber(normalizePhone(value));
  };

  const handleSendOTP = async () => {
    const digits = phoneNumber.replace(/\D/g, '');
    // Expecting +91 followed by 10 digits => total 12 characters with +91 (country code)
    if (!digits.startsWith('91') || digits.length !== 12) {
      Alert.alert('Invalid number', 'Enter a valid 10-digit Indian phone number.');
      return;
    }

    try {
      const phone = phoneNumber.trim();
      const { error } = await supabase.auth.signInWithOtp({ phone });

      if (error) {
        throw error;
      }

      Alert.alert('OTP sent', `We have sent an OTP to ${phone}`);
      navigation.navigate('VerifyOTP', { phone });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1a4a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Brand Name */}
      <View style={styles.brandContainer}>
        <Text style={styles.brandName}>Fixit</Text>
        <Text style={styles.subtitle}>Verify phone</Text>
      </View>

      {/* Phone Input */}
      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Phone (+91xxxxxxxxxx)"
            placeholderTextColor="#666"
            value={phoneNumber}
            onChangeText={handleChange}
            keyboardType="phone-pad"
            maxLength={INDIA_CODE.length + 10}
          />
        </View>
      </View>

      {/* Send OTP Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.sendOTPButton} onPress={handleSendOTP}>
          <Text style={styles.sendOTPButtonText}>Send OTP</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1a4a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    padding: 8,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 50,
  },
  brandName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'android' ? 'sans-serif-bold' : undefined,
  },
  subtitle: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '500',
  },
  formContainer: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 40,
  },
  sendOTPButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendOTPButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default VerifyPhoneScreen;
