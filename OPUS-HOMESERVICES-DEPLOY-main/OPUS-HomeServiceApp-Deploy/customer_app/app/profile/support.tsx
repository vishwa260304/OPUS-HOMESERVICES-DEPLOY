import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function SupportScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Help & Support</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[styles.sectionHeader, { backgroundColor: colors.surface }]}><Text style={[styles.sectionHeaderText, { color: colors.text }]}>FAQs</Text></View>

        {[
          { label: 'General Questions', route: '/profile/support-general', icon: 'information-circle-outline' as const },
          { label: 'Payment Related', route: '/profile/support-payments', icon: 'card-outline' as const },
          { label: 'Feedback & Suggestions', route: '/profile/support-feedback', icon: 'chatbubbles-outline' as const },
          { label: 'Order / Products Related', route: '/profile/support-orders', icon: 'cube-outline' as const },
          { label: 'Wallet Related', route: '/profile/support-wallet', icon: 'wallet-outline' as const },
        ].map((item, idx) => (
          <TouchableOpacity key={idx} style={[styles.cardRow, { backgroundColor: colors.card, shadowColor: colors.shadow }]} onPress={() => item.route && router.push(item.route as any)}>
              <View style={styles.cardRowLeft}>
                <LinearGradient colors={["#eff6ff", "#e0f2fe"]} style={[styles.iconChip, { backgroundColor: undefined }]}>
                  <Ionicons name={item.icon} size={18} color={'#004c8f' as any} />
                </LinearGradient>
              <Text style={[styles.cardRowText, { color: colors.text }]}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary as any} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  sectionHeader: { backgroundColor: '#EEF2FF', paddingVertical: 10, paddingHorizontal: 16 },
  sectionHeaderText: { color: '#111827', fontWeight: '800' },
  row: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowText: { color: '#111827', fontWeight: '600' },
  cardRow: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 16, marginHorizontal: 16, marginTop: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardRowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconChip: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardRowText: { color: '#111827', fontWeight: '700' },
});