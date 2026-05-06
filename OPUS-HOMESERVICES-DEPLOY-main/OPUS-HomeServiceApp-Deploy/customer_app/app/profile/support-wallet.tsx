import React, { useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SupportWalletScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [openMap, setOpenMap] = useState<{ [key: string]: boolean }>({});
  const { colors } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  const questions = [
    'What is Fixit Cash?',
    'I am unable to use my wallet',
  ];

  const answers: { [key: string]: string } = {
    'What is Fixit Cash?': '1. Fixit Cash is valid for 12 months from the date of issue unless specified a validity period. Fixit Cash is not refundable.\n\n2. You can purchase Fixit Cash using any available payment methods. You can also redeem vouchers to add Fixit Cash into your wallet.',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Help</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[styles.sectionHeader, { backgroundColor: colors.surface }]}><Text style={[styles.sectionHeaderText, { color: colors.text }]}>Wallet Related</Text></View>
        {questions.map((q, i) => (
          <View key={i}>
            <TouchableOpacity style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={() => setOpenMap(prev => ({ ...prev, [q]: !prev[q] }))}>
              <Text style={[styles.rowText, { color: colors.text }]}>{q}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary as any} />
            </TouchableOpacity>
            {openMap[q] && q === 'What is Fixit Cash?' && (
              <View style={[styles.answerBox, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.answerText, { color: colors.textSecondary }]}>{answers[q]}</Text>
              </View>
            )}
            {openMap[q] && q === 'I am unable to use my wallet' && (
              <View style={[styles.answerBox, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.answerTitle, { color: colors.text }]}>I am unable to use my wallet</Text>
                <Text style={[styles.answerText, { marginBottom: 16, color: colors.textSecondary }]}>We’re really sorry for the experience. Please reach out to us using the below option</Text>
                <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 16 }} />
                <Text style={[styles.answerTitle, { marginBottom: 12, color: colors.text }]}>Still need support?</Text>
                <TouchableOpacity style={[styles.chatButton, { backgroundColor: colors.primaryDark }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
                  <Text style={styles.chatButtonText}>Chat With Us</Text>
                </TouchableOpacity>
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
  sectionHeader: { backgroundColor: '#EEF2FF', paddingVertical: 10, paddingHorizontal: 16 },
  sectionHeaderText: { color: '#111827', fontWeight: '800' },
  row: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowText: { color: '#111827', fontWeight: '600' },
  answerBox: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  answerTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 8 },
  answerText: { color: '#4B5563' },
  chatButton: { marginTop: 4, alignSelf: 'flex-start', backgroundColor: '#004c8f', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  chatButtonText: { color: '#fff', fontWeight: '700', marginLeft: 10 },
});