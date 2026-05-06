import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';
import { supabase } from '../lib/supabase';

const SecurityScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Account deletion state
  const [deletingAccount, setDeletingAccount] = useState(false);

  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];

  const handleChangePassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Required', 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Done', 'Your password has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ],
    );
  };

  const confirmDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      // Step 1: delete all provider data rows via RPC
      const { error: rpcError } = await supabase.rpc('delete_provider_account');
      if (rpcError) throw rpcError;

      // Step 2: get the current session JWT for the Edge Function call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired. Please log in again to delete your account.');

      // Step 3: call Edge Function to delete auth.users row (requires service_role)
      const { error: fnError } = await supabase.functions.invoke('delete-auth-user', {
        method: 'POST',
      });
      if (fnError) throw fnError;

      // Step 4: sign out locally — NavigationController redirects to Login
      await supabase.auth.signOut();
    } catch (err: any) {
      setDeletingAccount(false);
      Alert.alert('Error', err?.message || 'Failed to delete account. Please contact support.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={sectorGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonHeader}>
              <Ionicons name="arrow-back" size={moderateScale(24)} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Privacy & Security</Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Change Password ── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="key-outline" size={moderateScale(22)} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Change Password</Text>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>New password</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              secureTextEntry={!showNew}
              placeholder="Min. 8 characters"
              placeholderTextColor={colors.textSecondary}
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowNew(v => !v)}>
              <Ionicons
                name={showNew ? 'eye-off-outline' : 'eye-outline'}
                size={moderateScale(20)}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: moderateScale(12) }]}>
            Confirm new password
          </Text>
          <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              secureTextEntry={!showConfirm}
              placeholder="Re-enter password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowConfirm(v => !v)}>
              <Ionicons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={moderateScale(20)}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: changingPassword ? 0.7 : 1 }]}
            onPress={handleChangePassword}
            disabled={changingPassword}
            activeOpacity={0.85}
          >
            {changingPassword ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Security Info ── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark-outline" size={moderateScale(22)} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Security Features</Text>
          </View>

          {[
            { icon: 'lock-closed-outline', text: 'End-to-end encryption for all data transmission' },
            { icon: 'key-outline', text: 'Secure authentication and password protection' },
            { icon: 'eye-off-outline', text: 'Privacy controls to manage your data sharing preferences' },
            { icon: 'shield-checkmark-outline', text: 'Regular security updates and monitoring' },
          ].map((item, i) => (
            <View key={i} style={styles.featureItem}>
              <Ionicons name={item.icon as any} size={moderateScale(18)} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.text }]}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Legal ── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={moderateScale(22)} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Legal</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.legalItem} 
            onPress={() => Linking.openURL('https://www.thefixit.in/partner-privacy-policy')}
            activeOpacity={0.7}
          >
            <Text style={[styles.legalText, { color: colors.text }]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.textSecondary} />
          </TouchableOpacity>
          
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          
          <TouchableOpacity 
            style={styles.legalItem} 
            onPress={() => Linking.openURL('https://www.thefixit.in/partner-terms-and-conditions')}
            activeOpacity={0.7}
          >
            <Text style={[styles.legalText, { color: colors.text }]}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={moderateScale(16)} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Delete Account ── */}
        <View style={[styles.card, styles.dangerCard, { backgroundColor: colors.card, borderColor: '#ef4444' }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="trash-outline" size={moderateScale(22)} color="#ef4444" />
            <Text style={[styles.cardTitle, { color: '#ef4444' }]}>Delete Account</Text>
          </View>
          <Text style={[styles.dangerText, { color: colors.textSecondary }]}>
            Permanently deletes your account, profile, bookings, tickets, and all associated data.
            This cannot be undone.
          </Text>
          <TouchableOpacity
            style={[styles.dangerBtn, { opacity: deletingAccount ? 0.7 : 1 }]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            activeOpacity={0.85}
          >
            {deletingAccount ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.dangerBtnText}>Delete My Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
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
  scrollView: { flex: 1 },
  scrollContent: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(48),
    gap: moderateScale(16),
  },
  card: {
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    borderWidth: 1,
  },
  dangerCard: {
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(16),
    gap: moderateScale(10),
  },
  cardTitle: {
    fontSize: moderateScale(17),
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    marginBottom: moderateScale(6),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    height: moderateScale(48),
  },
  input: {
    flex: 1,
    fontSize: moderateScale(15),
    paddingVertical: 0,
  },
  primaryBtn: {
    marginTop: moderateScale(18),
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: moderateScale(15),
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: moderateScale(14),
    gap: moderateScale(12),
  },
  featureText: {
    flex: 1,
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
  },
  dangerText: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    marginBottom: moderateScale(16),
  },
  dangerBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: moderateScale(13),
    borderRadius: moderateScale(12),
    alignItems: 'center',
  },
  dangerBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: moderateScale(15),
  },
  legalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: moderateScale(12),
  },
  legalText: {
    fontSize: moderateScale(15),
    fontWeight: '500',
  },
  divider: {
    height: 1,
    width: '100%',
  },
});

export default SecurityScreen;
