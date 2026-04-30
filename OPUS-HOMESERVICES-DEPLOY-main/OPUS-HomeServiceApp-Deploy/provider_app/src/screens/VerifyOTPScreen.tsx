import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Platform, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

const VerifyOTPScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const phone: string | undefined = route.params?.phone;

  const [otp, setOtp] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState<number>(RESEND_SECONDS);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Ensure input focuses any time the screen gains focus (addresses Android not opening keyboard)
  useFocusEffect(
    React.useCallback(() => {
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
      return () => clearTimeout(t);
    }, [])
  );

  const canResend = secondsLeft === 0;
  const canVerify = otp.replace(/\D/g, '').length === OTP_LENGTH;

  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
  };

  const handleResend = async () => {
    if (!canResend || !phone) return;

    setSecondsLeft(RESEND_SECONDS);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleVerify = async () => {
    if (!canVerify || !phone) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (error) {
        Alert.alert('Invalid OTP', error.message);
      } else {
        navigation.navigate('Dashboard' as never);
      }
    } catch (error) {
      Alert.alert('Error', 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const boxes = useMemo(() => {
    const chars = otp.split('');
    return new Array(OTP_LENGTH).fill(0).map((_, idx) => chars[idx] ?? '');
  }, [otp]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1a4a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.brandContainer}>
        <Text style={styles.brandName}>Fixit</Text>
        <Text style={styles.subtitle}>Enter OTP</Text>
        {phone ? <Text style={styles.helper}>Sent to {phone}</Text> : null}
      </View>

      {/* Hidden input captures all digits */}
      <TextInput
        ref={inputRef}
        value={otp}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        enterKeyHint="done"
        maxLength={OTP_LENGTH}
        style={styles.hiddenInput}
        autoFocus
        importantForAutofill="yes"
      />

      {/* OTP boxes */}
      <TouchableOpacity activeOpacity={0.9} onPress={() => inputRef.current?.focus()}>
        <View style={styles.otpRow}>
          {boxes.map((char, idx) => (
            <View key={idx} style={[styles.otpBox, char ? styles.otpBoxFilled : undefined]}>
              <Text style={styles.otpChar}>{char}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleResend}
          disabled={!canResend}
          style={[styles.resendLink, !canResend && styles.resendLinkDisabled]}
        >
          <Text style={styles.resendText}>{canResend ? 'Resend OTP' : `Resend in ${secondsLeft}s`}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleVerify}
          disabled={!canVerify || isLoading}
          style={[styles.verifyButton, !canVerify && styles.verifyButtonDisabled]}
        >
          {isLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.verifyText}>Verify</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1a4a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
  backButton: { padding: 8 },
  brandContainer: { alignItems: 'center', marginTop: 40, marginBottom: 30 },
  brandName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'android' ? 'sans-serif-bold' : undefined,
  },
  subtitle: { fontSize: 18, color: '#ffffff', fontWeight: '500' },
  helper: { marginTop: 6, color: '#ffffff', opacity: 0.8 },
  // Keep the input large enough and visible to the system so Android reliably shows the keyboard,
  // but visually hidden for the user.
  hiddenInput: { position: 'absolute', opacity: 0.02, height: 56, width: 160, top: 0, left: 0 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  otpBox: {
    height: 40,
    width: 40,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    marginHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpBoxFilled: { backgroundColor: '#e9efff' },
  otpChar: { fontSize: 18, color: '#000', fontWeight: '600' },
  actions: { paddingHorizontal: 20, marginTop: 24 },
  resendLink: { alignSelf: 'center', marginBottom: 20 },
  resendLinkDisabled: { opacity: 0.6 },
  resendText: { color: '#cfd8ff', fontSize: 16 },
  verifyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonDisabled: { opacity: 0.7 },
  verifyText: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
});

export default VerifyOTPScreen;
