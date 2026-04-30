import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithPhone, loading, session } = useAuth();
  const [countryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (!phone) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    
    const e164 = `${countryCode}${phone.replace(/\D/g, '')}`;
    setIsLoading(true);
    
    try {
      const result = await signInWithPhone(e164);
      if (result.success) {
        Alert.alert('Success', result.message);
        router.push({ pathname: '/subcategories/otp', params: { phone: e164 } } as any);
      } else {
        Alert.alert('Error', result.message);
      }
    } catch {
      Alert.alert('Error', 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.whiteBackground}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => {
              if (session) {
                router.replace('/location/fetching' as any);
                return;
              }
              router.replace('/location/fetching' as any);
            }}
            activeOpacity={0.8}
            style={styles.skipTopContainer}
          >
            <View style={styles.skipTop}>
              <Text style={styles.skipBottomText}>Skip</Text>
              <Ionicons name="chevron-forward" size={16} color="#000000" style={styles.skipArrow} />
            </View>
          </TouchableOpacity>
          <View style={styles.logoSection}>
            <Text style={styles.brandText}>Fixit</Text>
            <Text style={styles.subtitleText}>Your Daily Needs,{"\n"} One Tap Away.</Text>
          </View>

          <Text style={styles.formTitle}>Enter your phone number</Text>

          <View style={styles.phoneRow}>
            <View style={styles.ccPill}>
              <Text style={styles.ccText}>{countryCode}</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="Enter your number"
              placeholderTextColor="#ccc"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <Text style={styles.helperText}>
            We will send you a verification code.{"\n"}
            Please enter it to verify your account.
          </Text>

          <TouchableOpacity
            onPress={handleRequestOtp}
            disabled={isLoading || loading}
            style={styles.loginButtonContainer}
          >
            <LinearGradient
              colors={(isLoading || loading) ? ['#666', '#666'] : ['#004c8f', '#0c1a5d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginButton}
            >
              <Text style={styles.loginButtonText}>{isLoading || loading ? 'Requesting...' : 'Request OTP'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By proceeding, you acknowledge and agree to our Terms and Conditions.
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  whiteBackground: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'flex-start', 
    paddingHorizontal: 24, 
    paddingVertical: 20,
    minHeight: '100%'
  },
  skipTopContainer: {
    alignItems: 'flex-end',
    marginTop: 30,
  },
  skipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logoSection: { 
    alignItems: 'center', 
    marginBottom: 40, 
    marginTop: 100
  },
  brandText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#004c8f',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeText: { 
    fontSize: 34, 
    fontWeight: '800', 
    color: '#000000', 
    marginBottom: 10,
    textAlign: 'center'
  },
  subtitleText: { 
    fontSize: 18, 
    color: '#666666', 
    textAlign: 'center', 
    fontWeight: '600', 
    marginBottom: -10,
    lineHeight: 24
  },
  formTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#000000', 
    marginBottom: 20,
    marginTop: 20,
    textAlign: 'center'
  },
  phoneRow: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F8F9FA',
    borderRadius: 12, 
    marginBottom: 16, 
    paddingHorizontal: 12, 
    height: 52,
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  ccPill: {
    backgroundColor: '#E5E7EB', 
    paddingHorizontal: 14, 
    paddingVertical: 8,
    borderRadius: 18, 
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  ccText: { 
    color: '#374151', 
    fontWeight: '700',
    fontSize: 14
  },
  phoneInput: { 
    flex: 1, 
    color: '#000000', 
    fontSize: 16,
    fontWeight: '500'
  },
  helperText: { 
    color: '#666666', 
    fontSize: 13, 
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 18
  },
  loginButtonContainer: { marginBottom: 20 },
  loginButton: { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  dividerText: { color: '#fff', marginHorizontal: 15, fontSize: 14 },
  skipBottomContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  skipBottom: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
    alignItems: 'center',
    minWidth: 100,
  },
  skipBottomText: { 
    color: '#000000', 
    fontSize: 16, 
    fontWeight: '500',
    marginRight: 4,
  },
  skipArrow: {
    marginLeft: 2,
  },
  disclaimer: { 
    color: '#8E8E93', 
    fontSize: 12, 
    marginTop: 16, 
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 4
  },
});
