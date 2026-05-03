import React, { useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function PrivacySecurityScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [openMap, setOpenMap] = useState<{ [key: string]: boolean }>({});
  const { colors } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  const items = [
    { q: 'Data we collect', a: 'Basic profile, contact info, order history and device identifiers. We avoid collecting unnecessary data.', icon: 'document-text-outline' as const },
    { q: 'How we use your data', a: 'To provide services, payments, support, fraud prevention and comply with legal requirements.', icon: 'settings-outline' as const },
    { q: 'Where your data is stored', a: 'Encrypted in transit and at rest on secure, compliant infrastructure.', icon: 'server-outline' as const },
    { q: 'Who we share data with', a: 'Payment gateways, delivery partners and analytics/fraud tools — only as needed to provide the service.', icon: 'people-outline' as const },
    { q: 'Delete my account/data', a: 'Contact support via Chat With Us or email to request deletion. Some records may be retained as required by law.', icon: 'trash-outline' as const },
    { q: 'Export my data', a: 'Email support to request a copy of your data. We’ll respond with next steps.', icon: 'download-outline' as const },
    { q: 'OTP and login security', a: 'OTP-based login only. Never share your OTP with anyone.', icon: 'key-outline' as const },
    { q: 'Payment security', a: 'Card details are processed by PCI-DSS compliant providers. We do not store full card numbers.', icon: 'card-outline' as const },
    { q: 'Report a security issue', a: 'Email security@fixit.com with details. We aim to respond within 72 hours.', icon: 'shield-checkmark-outline' as const },
    { q: 'Cookie and tracking policy', a: 'We use limited analytics and error tracking. Opt-out controls are available in your device settings.', icon: 'book-outline' as const },
    { q: 'Parental/age policy', a: 'You must be of legal age to use the app. Underage accounts may be disabled.', icon: 'warning-outline' as const },
    { q: 'Policy updates', a: 'We will notify you in-app or via email when important changes are made.', icon: 'refresh-outline' as const },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy & Security</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Your data. Your control.</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[styles.sectionHeader, { backgroundColor: colors.surface }]}><Text style={[styles.sectionHeaderText, { color: colors.text }]}>Your Privacy</Text></View>
        {items.map((item, i) => (
          <View key={i}>
            <TouchableOpacity style={[styles.cardRow, { backgroundColor: colors.card, shadowColor: colors.shadow }]} onPress={() => setOpenMap(prev => ({ ...prev, [item.q]: !prev[item.q] }))}>
              <View style={styles.cardRowLeft}>
                <LinearGradient colors={["#eff6ff", "#e0f2fe"]} style={[styles.iconChip, { backgroundColor: undefined }]}>
                  <Ionicons name={item.icon} size={18} color={'#004c8f' as any} />
                </LinearGradient>
                <Text style={[styles.cardRowText, { color: colors.text }]}>{item.q}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary as any} />
            </TouchableOpacity>
            {openMap[item.q] && (
              <View style={[styles.answerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.answerText, { color: colors.textSecondary }]}>{item.a}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSubtitle: { color: '#6B7280', fontSize: 12 },
  sectionHeader: { backgroundColor: '#EEF2FF', paddingVertical: 10, paddingHorizontal: 16 },
  sectionHeaderText: { color: '#111827', fontWeight: '800' },
  row: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowText: { color: '#111827', fontWeight: '600' },
  cardRow: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 16, marginHorizontal: 16, marginTop: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardRowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconChip: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardRowText: { color: '#111827', fontWeight: '700' },
  answerCard: { backgroundColor: '#fff', marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: '#eef2f7' },
  answerText: { color: '#4B5563' },
});