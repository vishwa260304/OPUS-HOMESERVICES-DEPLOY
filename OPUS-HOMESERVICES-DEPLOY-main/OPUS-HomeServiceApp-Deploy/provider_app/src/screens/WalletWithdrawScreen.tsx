import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { getBankAccounts, upsertBankAccount, getSelectedSector } from '../utils/appState';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const WalletWithdrawScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [selectedBankId, setSelectedBankId] = useState<string | number | null>(null);
  const [holder, setHolder] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [method, setMethod] = useState<'IMPS' | 'NEFT' | 'UPI'>('IMPS');
  const [upiId, setUpiId] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const banks = useMemo(() => getBankAccounts(), []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('bookings')
        .select('total, status')
        .or(`provider_id.eq.${user.id},doctor_user_id.eq.${user.id},acting_driver_id.eq.${user.id}`)
        .eq('status', 'completed');
      if (data) {
        const balance = data.reduce((s, b) => s + (Number(b.total) || 0), 0);
        setWalletBalance(balance);
      }
    })();
  }, []);

  useEffect(() => {
    if (banks && banks.length > 0) {
      setSelectedBankId((prev) => prev ?? banks[0].id);
    }
  }, [banks]);


  const isHealthcare = (getSelectedSector?.() === 'healthcare');
  const sectorPrimary = isHealthcare ? '#0AAE8A' : '#3B5BFD';
  const sectorGradient: [string, string] = isHealthcare ? ['#0BB48F', '#0A8F6A'] : ['#004c8f', '#0c1a5d'];

  const canSubmit = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return false;
    if (method === 'UPI') {
      return upiId.trim().length >= 6; // simple validation
    }
    if (selectedBankId) return true;
    return holder.trim().length > 2 && accountNo.trim().length >= 8 && ifsc.trim().length >= 8;
  };

  const addBank = () => {
    const id = Date.now();
    upsertBankAccount({ id, holder, accountNo, ifsc });
    setSelectedBankId(id);
  };

  const submitWithdraw = async () => {
    const amt = Number(amount);
    if (!amt || amt < 100) {
      Alert.alert('Minimum ₹100', 'Enter an amount of at least ₹100.');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const selectedBank = banks.find(b => b.id === selectedBankId) ?? null;

      const { error } = await supabase.from('provider_withdrawals').insert({
        user_id: user.id,
        amount: amt,
        method,
        account_holder: method !== 'UPI' ? (selectedBank?.holder ?? holder ?? null) : null,
        account_number: method !== 'UPI' ? (selectedBank?.accountNo ?? accountNo ?? null) : null,
        ifsc_code: method !== 'UPI' ? (selectedBank?.ifsc ?? ifsc ?? null) : null,
        upi_id: method === 'UPI' ? upiId : null,
        status: 'pending',
      });

      if (error) throw error;

      Alert.alert(
        'Request Submitted',
        `Your withdrawal of ₹${amt} via ${method} has been received. Processing typically takes 1–3 business days.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit withdrawal. Please try again.');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingHorizontal: moderateScale(16), paddingBottom: moderateScale(16), paddingTop: (insets.top || 0) + moderateScale(4) }}>
      <LinearGradient colors={sectorGradient} start={{ x:0, y:0 }} end={{ x:0, y:1 }} style={styles.headerGradient}>
        <StatusBar barStyle="light-content" />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor:'rgba(255,255,255,0.18)', borderRadius: 12 }]}>
            <Ionicons name="chevron-back" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={[styles.title, { color: '#ffffff' }]}>Withdraw</Text>
        </View>
      </LinearGradient>

      <View style={[styles.balanceCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
        <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Available balance</Text>
        <Text style={[styles.balanceValue, { color: sectorPrimary }]}>₹{walletBalance}</Text>
      </View>

      {/* Method selector */}
      <View style={{ marginTop: moderateScale(14) }}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Method</Text>
        <View style={styles.segmentWrap}>
          {(['IMPS','NEFT','UPI'] as const).map(m => (
            <TouchableOpacity key={m} onPress={() => setMethod(m)} activeOpacity={0.9}
              style={[styles.segmentBtn, method===m && [styles.segmentBtnActive, { borderColor: sectorPrimary }]]}>
              <Text style={[styles.segmentText, { color: method===m ? '#ffffff' : colors.textSecondary }]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {method !== 'UPI' && banks.length > 0 ? (
        <View style={{ marginTop: moderateScale(16) }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Select bank account</Text>
          {/* Quick saved from Profile */}
          <View style={[styles.savedCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: selectedBankId ? sectorPrimary : colors.border, borderWidth: 1 }]}>
            <View style={{ flex:1 }}>
              <Text style={[styles.savedTitle, { color: colors.text }]}>Saved from Profile</Text>
              <Text style={[styles.savedSub, { color: colors.textSecondary }]}>
                {(() => { const b = banks.find(x => x.id === selectedBankId) || banks[0]; return b ? `${b.holder || 'A/c Holder'} · ${b.accountNo?.slice(-4) ? '****'+String(b.accountNo).slice(-4) : 'XXXX'}` : 'No bank saved'; })()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedBankId(banks[0]?.id)} activeOpacity={0.9} style={[styles.useBtn, { borderColor: sectorPrimary }]}>
              <Text style={[styles.useBtnText, { color: sectorPrimary }]}>Use</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: moderateScale(8) }}>
            <TouchableOpacity onPress={() => navigation.navigate('BankDetails')} activeOpacity={0.85}>
              <Text style={{ color: sectorPrimary, fontWeight:'800' }}>Manage bank accounts →</Text>
            </TouchableOpacity>
          </View>
          {banks.map(b => (
            <TouchableOpacity key={String(b.id)} onPress={() => setSelectedBankId(b.id)} activeOpacity={0.9}
              style={[styles.bankItem, styles.cardShadow, { borderColor: selectedBankId===b.id ? sectorPrimary : colors.border, backgroundColor: colors.card, borderWidth: 1 }]}> 
              <Ionicons name="card" size={18} color={sectorPrimary} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={[styles.bankTitle, { color: colors.text }]}>{b.holder || 'A/c Holder'}</Text>
                <Text style={[styles.bankSub, { color: colors.textSecondary }]}>{b.accountNo || 'XXXXXX'} · {b.ifsc || 'IFSC'}</Text>
              </View>
              {selectedBankId===b.id ? <Ionicons name="checkmark-circle" size={18} color={sectorPrimary} /> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {method === 'UPI' ? (
        <View style={{ marginTop: moderateScale(16) }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>UPI ID</Text>
          <TextInput placeholder="yourname@bank" placeholderTextColor="#9CA3AF" value={upiId} onChangeText={setUpiId} autoCapitalize="none" autoCorrect={false} style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} />
        </View>
      ) : (
      <View style={{ marginTop: moderateScale(16) }}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{banks.length ? 'Or add new bank' : 'Add bank details'}</Text>

        <View style={styles.fieldRow}><Text style={[styles.label, { color: colors.textSecondary }]}>Account holder</Text>
          <TextInput placeholder="Full name" placeholderTextColor="#9CA3AF" value={holder} onChangeText={setHolder} style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} /></View>
        <View style={styles.fieldRow}><Text style={[styles.label, { color: colors.textSecondary }]}>Account number</Text>
          <TextInput placeholder="XXXXXXXX" placeholderTextColor="#9CA3AF" value={accountNo} onChangeText={setAccountNo} keyboardType="number-pad" style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} /></View>
        <View style={styles.fieldRow}><Text style={[styles.label, { color: colors.textSecondary }]}>IFSC</Text>
          <TextInput placeholder="ABCD0123456" placeholderTextColor="#9CA3AF" value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} /></View>
        {(!selectedBankId && holder && accountNo && ifsc) ? (
          <TouchableOpacity onPress={addBank} activeOpacity={0.9} style={[styles.addBankBtn, { backgroundColor: sectorPrimary }]}>
            <Text style={styles.addBankText}>Save bank</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      )}

      <View style={{ marginTop: moderateScale(16) }}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Withdraw amount</Text>
        <TextInput placeholder="₹0" placeholderTextColor="#9CA3AF" value={amount} onChangeText={setAmount} keyboardType="number-pad" style={[styles.input, { fontSize: moderateScale(18), color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} />
      </View>

      {/* Info / limits */}
      <View style={[styles.infoCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>Transfer details</Text>
        <View style={styles.infoRow}><Text style={[styles.infoKey, { color: colors.textSecondary }]}>Fees</Text><Text style={[styles.infoVal, { color: colors.text }]}>₹0</Text></View>
        <View style={styles.infoRow}><Text style={[styles.infoKey, { color: colors.textSecondary }]}>Min amount</Text><Text style={[styles.infoVal, { color: colors.text }]}>₹100</Text></View>
        <View style={styles.infoRow}><Text style={[styles.infoKey, { color: colors.textSecondary }]}>Limits</Text><Text style={[styles.infoVal, { color: colors.text }]}>₹25,000/day</Text></View>
        <View style={styles.infoRow}><Text style={[styles.infoKey, { color: colors.textSecondary }]}>Processing</Text><Text style={[styles.infoVal, { color: colors.text }]}>{method==='UPI' ? 'Instant (UPI)' : (method==='IMPS' ? 'Instant (IMPS)' : 'Same day (NEFT)')}</Text></View>
      </View>

      {/* Terms */}
      <TouchableOpacity onPress={() => setAgreed(a => !a)} activeOpacity={0.8} style={styles.termsRow}>
        <View style={[styles.checkbox, { borderColor: agreed ? sectorPrimary : colors.border, backgroundColor: agreed ? sectorPrimary : 'transparent' }]}>
          {agreed ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
        </View>
        <Text style={[styles.termsText, { color: colors.textSecondary }]}>I confirm the account/UPI details are correct.</Text>
      </TouchableOpacity>

      <TouchableOpacity disabled={!(canSubmit() && agreed)} activeOpacity={0.9} onPress={submitWithdraw} style={[styles.withdrawBtn, { backgroundColor: (canSubmit() && agreed) ? sectorPrimary : '#A5B4FC' }]}>
        <Text style={styles.withdrawText}>Withdraw</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection:'row', alignItems:'center' },
  backBtn: { padding: 8, marginRight: 6 },
  headerGradient: { borderRadius: 14, paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(10), marginBottom: moderateScale(8) },
  title: { fontSize: moderateScale(18), fontWeight:'800' },
  balanceCard: { borderRadius: moderateScale(16), padding: moderateScale(16), marginTop: moderateScale(12) },
  balanceLabel: { fontWeight:'700' },
  balanceValue: { fontSize: moderateScale(28), fontWeight:'800', marginTop: moderateScale(6) },
  sectionTitle: { fontWeight:'800', marginBottom: moderateScale(8) },
  bankItem: { flexDirection:'row', alignItems:'center', padding: moderateScale(12), borderRadius: moderateScale(12), marginBottom: moderateScale(8) },
  bankTitle: { fontWeight:'800' },
  bankSub: { },
  fieldRow: { marginBottom: moderateScale(10) },
  label: { fontWeight:'700', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  addBankBtn: { paddingVertical: 12, borderRadius: 12, alignItems:'center', marginTop: 6 },
  addBankText: { color:'#ffffff', fontWeight:'800' },
  withdrawBtn: { paddingVertical: 14, borderRadius: 14, alignItems:'center', marginTop: 10 },
  withdrawText: { color:'#ffffff', fontWeight:'800' },
  cardShadow: { shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, shadowOffset:{ width:0, height:4 }, elevation:2 },
  // Segmented control
  segmentWrap: { flexDirection:'row', backgroundColor:'rgba(59,91,253,0.10)', borderRadius: moderateScale(12), padding: moderateScale(4) },
  segmentBtn: { flex:1, alignItems:'center', justifyContent:'center', paddingVertical: moderateScale(8), borderRadius: moderateScale(8), borderWidth: 1, borderColor: 'transparent' },
  segmentBtnActive: { backgroundColor:'rgba(59,91,253,0.18)' },
  segmentText: { fontWeight:'800' },
  // Saved bank quick card
  savedCard: { borderRadius: moderateScale(12), padding: moderateScale(12), marginBottom: moderateScale(10), flexDirection:'row', alignItems:'center' },
  savedTitle: { fontWeight:'800' },
  savedSub: { marginTop: 4 },
  useBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  useBtnText: { fontWeight:'800' },
  // Info card
  infoCard: { borderRadius: moderateScale(14), padding: moderateScale(14), marginTop: moderateScale(16) },
  infoTitle: { fontWeight:'800', marginBottom: moderateScale(10) },
  infoRow: { flexDirection:'row', justifyContent:'space-between', marginTop: moderateScale(6) },
  infoKey: { fontWeight:'700' },
  infoVal: { fontWeight:'800' },
  // Terms
  termsRow: { flexDirection:'row', alignItems:'center', marginTop: moderateScale(14) },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1, alignItems:'center', justifyContent:'center', marginRight: 8 },
  termsText: { fontWeight:'700' },
});

export default WalletWithdrawScreen;


