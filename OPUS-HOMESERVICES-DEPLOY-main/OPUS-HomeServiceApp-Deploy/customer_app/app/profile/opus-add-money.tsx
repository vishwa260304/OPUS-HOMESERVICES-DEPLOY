import React, { useLayoutEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function OpusAddMoneyScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [autoAdd, setAutoAdd] = useState(true);
  const [amountText, setAmountText] = useState('');
  const amount = useMemo(() => {
    const n = parseInt(amountText.replace(/\D/g, ''));
    return isNaN(n) ? 0 : n;
  }, [amountText]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text as any} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Add money</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={[styles.segment, { backgroundColor: colors.surface }]}
        >
          <TouchableOpacity style={styles.segmentBtn} onPress={() => setAutoAdd(true)}>
            {autoAdd ? (
              <LinearGradient
                colors={["#004c8f", "#0c1a5d"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBg}
              />
            ) : null}
            <Text style={[styles.segmentText, { color: colors.text }, autoAdd && styles.segmentTextActive]}>Auto add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.segmentBtn} onPress={() => setAutoAdd(false)}>
            {!autoAdd ? (
              <LinearGradient
                colors={["#004c8f", "#0c1a5d"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBg}
              />
            ) : null}
            <Text style={[styles.segmentText, { color: colors.text }, !autoAdd && styles.segmentTextActive]}>Add once</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.amountCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.lightText, { color: colors.textSecondary }]}>{autoAdd ? 'Automatically add' : 'You will add'}</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="₹ Amount"
            placeholderTextColor={colors.textSecondary as any}
            keyboardType="number-pad"
            value={amountText}
            onChangeText={setAmountText}
          />
          {autoAdd ? (
            <Text style={[styles.lightText, { color: colors.textSecondary }]}>when balance goes below <Text style={{ color: '#059669' }}>₹500</Text></Text>
          ) : null}
        </View>

        <View style={[styles.noteCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.noteTitle, { color: colors.text }]}>NOTE</Text>
          {[
            'Fixit Wallet balance is valid for 1 year from the date of money added',
            'Fixit Wallet is usable across the app',
            'Fixit Wallet cannot be transferred to a bank account as per RBI guidelines.',
          ].map((t, i) => (
            <View key={i} style={styles.noteRow}>
              <View style={[styles.bullet, { backgroundColor: colors.textSecondary }]} />
              <Text style={[styles.noteText, { color: colors.textSecondary }]}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.payBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={styles.payLeft}>
          <Ionicons name="logo-usd" size={16} color={colors.textSecondary as any} />
          <Text style={[styles.payUsing, { color: colors.textSecondary }]}>PAY USING</Text>
          <Ionicons name="chevron-up" size={16} color={colors.textSecondary as any} />
        </View>
        <TouchableOpacity style={[styles.payBtn, { backgroundColor: colors.surface }]}>
          <Text style={[styles.total, { color: colors.text }]}>₹{amount.toLocaleString('en-IN')}.00</Text>
          <Text style={[styles.totalSub, { color: colors.textSecondary }]}>TOTAL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primary, amount <= 0 && styles.primaryDisabled]}
          disabled={amount <= 0}
          onPress={async () => {
            await AsyncStorage.setItem('opus_add_money_amount', String(amount));
            router.push('/profile/opus-add-money-method' as any);
          }}
        >
          {amount > 0 ? (
            <LinearGradient
              colors={["#004c8f", "#0c1a5d"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientPrimary}
            />
          ) : null}
          <Text style={styles.primaryText}>Add money</Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  segment: { backgroundColor: '#E5E7EB', flexDirection: 'row', borderRadius: 30, padding: 6, marginTop: 8 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 24 },
  segmentBtnActive: { backgroundColor: '#004c8f' },
  gradientBg: { ...StyleSheet.absoluteFillObject, borderRadius: 24 },
  segmentText: { color: '#6B7280', fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  amountCard: { alignItems: 'center', paddingVertical: 24, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, marginTop: 12 },
  lightText: { },
  amountText: { fontSize: 36, fontWeight: '800', color: '#111827', marginVertical: 10 },
  noteCard: { marginTop: 16, borderRadius: 16, padding: 16 },
  noteTitle: { color: '#6B7280', fontWeight: '800', marginBottom: 8 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6B7280', marginRight: 10, marginTop: 7 },
  noteText: { flex: 1 },
  payBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1 },
  payLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payUsing: { marginHorizontal: 6 },
  payBtn: { marginLeft: 'auto', marginRight: 10, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  total: { fontWeight: '800' },
  totalSub: { fontSize: 10 },
  primary: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  primaryDisabled: { backgroundColor: '#7aa3c8' },
  primaryText: { color: '#fff', fontWeight: '700', marginRight: 6 },
  amountInput: { marginTop: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, fontSize: 22, fontWeight: '800' },
  gradientPrimary: { ...StyleSheet.absoluteFillObject, borderRadius: 12 },
});