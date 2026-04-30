import React, { useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Bank = { id: string; name: string; logo?: any };

const POPULAR_BANKS: Bank[] = [
  { id: 'hdfc', name: 'HDFC' },
  { id: 'kotak', name: 'Kotak' },
  { id: 'icici', name: 'ICICI' },
  { id: 'sbi', name: 'SBI' },
  { id: 'axis', name: 'Axis' },
];

const ALL_BANKS: Bank[] = [
  { id: 'sbi', name: 'State Bank of India (SBI)' },
  { id: 'indian', name: 'Indian Bank' },
  { id: 'hdfc', name: 'HDFC Bank' },
  { id: 'icici', name: 'ICICI Bank' },
  { id: 'axis-corporate', name: 'Axis Corporate Netbanking' },
  { id: 'ubi', name: 'Union Bank of India' },
  { id: 'boi', name: 'Bank of India' },
  { id: 'canara', name: 'Canara Bank' },
  { id: 'cbi', name: 'Central Bank of India' },
  { id: 'bandhan', name: 'Bandhan Bank' },
];

export default function NetbankingScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  const filteredBanks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_BANKS;
    return ALL_BANKS.filter(b => b.name.toLowerCase().includes(q));
  }, [query]);

  const selectBank = async (bank: Bank) => {
    await AsyncStorage.setItem('selected_netbanking_bank', JSON.stringify(bank));
    router.back();
  };

  const BankChip = ({ bank }: { bank: Bank }) => (
    <TouchableOpacity style={styles.popularChip} onPress={() => selectBank(bank)}>
      <View style={[styles.popularLogo, { backgroundColor: colors.surface }]}>
        <Text style={[styles.popularLogoText, { color: colors.textSecondary }]}>{bank.name.slice(0,1)}</Text>
      </View>
      <Text style={[styles.popularName, { color: colors.text }]}>{bank.name}</Text>
    </TouchableOpacity>
  );

  const BankRow = ({ bank }: { bank: Bank }) => (
    <TouchableOpacity style={[styles.bankRow, { backgroundColor: colors.card }]} onPress={() => selectBank(bank)}>
      <View style={[styles.bankLogo, { backgroundColor: colors.surface }]}><Text style={[styles.bankLogoText, { color: colors.textSecondary }]}>{bank.name.slice(0,1)}</Text></View>
      <Text style={[styles.bankName, { color: colors.text }]}>{bank.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Select Bank</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary as any} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search By Bank Name"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Popular Banks</Text>
        <View style={[styles.popularRow, { backgroundColor: colors.card }]}>
          {POPULAR_BANKS.map(b => (
            <BankChip key={b.id} bank={b} />
          ))}
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 12, color: colors.textSecondary }]}>All Banks</Text>
        <View style={{ backgroundColor: colors.card }}>
          {filteredBanks.map((b, i) => (
            <View key={b.id}>
              <BankRow bank={b} />
              {i < filteredBanks.length - 1 ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  searchBox: { margin: 16, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { marginLeft: 8, flex: 1, color: '#111827' },
  sectionHeader: { color: '#6B7280', fontWeight: '700', fontSize: 12, paddingHorizontal: 16, marginBottom: 8 },
  popularRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#fff', paddingVertical: 12 },
  popularChip: { alignItems: 'center', width: 56 },
  popularLogo: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  popularLogoText: { color: '#4F46E5', fontWeight: '700' },
  popularName: { color: '#111827', fontSize: 11 },
  bankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff' },
  bankLogo: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bankLogoText: { color: '#6B7280', fontWeight: '700' },
  bankName: { color: '#111827' },
  separator: { height: 1, backgroundColor: '#E5E7EB', marginLeft: 60 },
});