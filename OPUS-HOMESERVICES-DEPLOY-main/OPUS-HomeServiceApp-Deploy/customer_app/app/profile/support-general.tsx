import React, { useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// removed gradient icon inside rows per request

export default function SupportGeneralScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [loginInfoVisible, setLoginInfoVisible] = useState(false);
  const [deleteInfoVisible, setDeleteInfoVisible] = useState(false);
  const [taxInfoVisible, setTaxInfoVisible] = useState(false);
  const [fixitInfoVisible, setFixitInfoVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  const questions = [
    'What is Fixit App?',
    'How do I delete my account?',
    'Do you charge any taxes over and above the price of each item?',
  ];

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
        <View style={[styles.sectionHeader, { backgroundColor: colors.surface }]}><Text style={[styles.sectionHeaderText, { color: colors.text }]}>General Questions</Text></View>
        {questions.map((q, i) => (
          <View key={i}>
            <TouchableOpacity style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={() => {
              if (q === 'What is Fixit App?') {
                setFixitInfoVisible(!fixitInfoVisible);
              }
              if (q === 'How do I delete my account?') {
                setDeleteInfoVisible(!deleteInfoVisible);
              }
              if (q === 'Do you charge any taxes over and above the price of each item?') {
                setTaxInfoVisible(!taxInfoVisible);
              }
            }}>
              <Text style={[styles.rowText, { color: colors.text }]}>{q}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary as any} />
            </TouchableOpacity>
            {q === 'What is Fixit App?' && fixitInfoVisible && (
              <View style={[styles.answerBox, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.answerText, { color: colors.textSecondary }]}>
                  Fixit is a services marketplace app that connects users with trusted professionals for home, health, education, and personal needs. Our goal is to make daily services simple, safe, and accessible for everyone.
                </Text>
                <Text style={[styles.answerText, { marginTop: 12, color: colors.textSecondary }]}>Have a non-urgent question or comment?</Text>
                <Text style={[styles.answerText, { marginTop: 4, color: colors.textSecondary }]}>Email support@zeptonow.com</Text>
              </View>
            )}
            {q === 'How do I delete my account?' && deleteInfoVisible && (
              <View style={[styles.answerBox, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.answerText, { color: colors.textSecondary }]}>
                  You will need to contact our customer support through the "Chat with us" option or email to delete your account.
                </Text>
              </View>
            )}
            {q === 'Do you charge any taxes over and above the price of each item?' && taxInfoVisible && (
              <View style={[styles.answerBox, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.answerText, { color: colors.textSecondary }]}>
                  All our product prices are inclusive of taxes. We charge a nominal fee for the services of packing and delivering your products. If applicable, the delivery fee and small-cart fee will be specified on the checkout page.
                </Text>
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
  answerBox: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  answerText: { color: '#4B5563' },
});