import React, { useMemo, useRef, useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const router = useRouter();
  const { verifyOTP, signInWithPhone, loading } = useAuth();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputs = useRef<(TextInput | null)[]>([]);
  const code = useMemo(() => digits.join(''), [digits]);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCooldown]);

  // Send OTP using signInWithPhone (same as login button) with cooldown
  const sendOtp = async () => {
    if (!phone) {
      Alert.alert("Error", "Phone number not found");
      return;
    }

    if (!canResend) {
      Alert.alert("Please wait", `You can resend OTP in ${resendCooldown} seconds`);
      return;
    }
    
    setIsResending(true);
    try {
      setCanResend(false);
      setResendCooldown(30); // 30 second cooldown
      
      const result = await signInWithPhone(phone);
      if (result.success) {
        // success: no toast/alert per requirement
      } else {
        Alert.alert("Error", result.message);
        // Reset cooldown if there's an error
        setCanResend(true);
        setResendCooldown(0);
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      Alert.alert("Error", "Failed to send OTP");
      // Reset cooldown if there's an error
      setCanResend(true);
      setResendCooldown(0);
    } finally {
      setIsResending(false);
    }
  };
 
  // Verify OTP using Supabase
  const verifyOtp = async () => {
    if (!phone) {
      Alert.alert("Error", "Phone number not found");
      return;
    }
    
    try {
      const result = await verifyOTP(phone, code);
      if (result.success) {
        // success: no toast/alert per requirement
        router.replace('/location/fetching');
      } else {
        Alert.alert("Error", result.message);
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      Alert.alert("Error", "Verification failed");
    }
  };

  const onChangeDigit = (index: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 5) inputs.current[index + 1]?.focus();
  };

  const onVerify = async () => {
    if (code.length !== 6) {
      Alert.alert("Error", "Please enter the 6-digit code");
      return;
    }
    await verifyOtp();
  };

  const handleEditPhone = () => {
    router.back();
  };

  const onKeyPressDigit = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>
  ) => {
    if (e.nativeEvent.key === 'Backspace') {
      // If current cell has a value, clear it
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
        return;
      }

      // If current is empty, move to previous and clear it
      if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        inputs.current[index - 1]?.focus();
      }
    }
  };

  // Start 30 second cooldown on mount (OTP already sent from login screen)
  useEffect(() => {
    if (phone) {
      // OTP was already sent from login screen, so start the cooldown timer
      // Don't send another OTP here to avoid rate limiting
      setCanResend(false);
      setResendCooldown(30);
    }
  }, [phone]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.whiteBackground}>
        <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.logoSection}>
            <Text style={styles.brandText}>Fixit</Text>
            <Text style={styles.subtitleText}>Your Daily Needs,{"\n"} One Tap Away.</Text>
          </View>

          <Text style={styles.title}>Enter verification code</Text>
          <Text style={styles.info}>A 6 Digit Code has been sent to</Text>
          {!!phone && (
            <View style={styles.phoneContainer}>
              <Text style={styles.phone}>{String(phone)}</Text>
              <TouchableOpacity onPress={handleEditPhone} style={styles.editButton}>
                <Ionicons name="create-outline" size={18} color="#004c8f" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                style={styles.otpCell}
                value={d}
                onChangeText={(v) => onChangeDigit(i, v)}
                onKeyPress={(e) => onKeyPressDigit(i, e)}
                keyboardType="number-pad"
                maxLength={1}
                autoFocus={i === 0}
              />
            ))}
          </View>

          <View style={styles.resendRow}>
            <TouchableOpacity onPress={sendOtp} disabled={!canResend || isResending || loading}>
              <Text style={[styles.resendText, (!canResend || isResending || loading) && styles.resendTextDisabled]}>
                {isResending || loading ? 'Requesting…' : canResend ? 'Resend code' : `Resend available in ${resendCooldown}s`}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={onVerify}
            disabled={loading}
            style={styles.verifyBtnContainer}
          >
            <LinearGradient
              colors={loading ? ['#666', '#666'] : ['#004c8f', '#0c1a5d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.verifyBtn}
            >
              <Text style={styles.verifyText}>{loading ? 'Verifying...' : 'Verify'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const CELL_SIZE = 46;

const styles = StyleSheet.create({
  container: { flex: 1 },
  whiteBackground: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flexGrow: 1, padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 20, marginTop: 130 },
  brandText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#004c8f',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleText: { fontSize: 20, color: '#000000', textAlign: 'center', fontWeight: 'bold' , marginBottom: 15},
  title: { color: '#000000', fontSize: 20, fontWeight: '700', marginBottom: 4, marginTop: 20, textAlign: 'center' },
  info: { color: '#666666', marginBottom: 2, textAlign: 'center' },
  phoneContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 14 
  },
  phone: { color: '#004c8f', fontWeight: '700', textAlign: 'center', marginRight: 8 },
  editButton: { 
    padding: 4,
    borderRadius: 4,
  },
  otpRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 11, gap: 12 },
  otpCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E1E5E9',
    color: '#000',
    fontSize: 18,
    textAlign: 'center',
  },
  resendRow: { marginTop: 12 },
  resendText: { color: '#004c8f', marginBottom: 8, textAlign: 'center', fontWeight: '600' },
  resendTextDisabled: { color: '#999999', fontWeight: '400' },
  chipsRow: { flexDirection: 'row', gap: 10 },
  chip: { backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  chipDisabled: { backgroundColor: 'rgba(255,255,255,0.05)' },
  chipText: { color: '#fff', fontWeight: '700' },
  chipTextDisabled: { color: 'rgba(255,255,255,0.5)' },
  verifyBtnContainer: { marginTop: 24, alignSelf: 'center', width: 350 },
  verifyBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  verifyText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
});