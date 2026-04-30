import React, { useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SupportFeedbackScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [openMap, setOpenMap] = useState<{ [key: string]: boolean }>({});
  const { colors } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  const questions = [
    'Tell me a little about your rider safety initiative.',
    'Any feedback / review',
    
  ];

  const answers: { [key: string]: string } = {
    'Tell me a little about your rider safety initiative.': 'Our model and store mapping ensure that our rider partners operate in a 10 km radius, building greater familiarity, safety, and comfort.',
    'Any feedback / review': 'We love to hear from you! Please reach out to us and we will get back to you in a bit!\n\nHave a non-urgent question or comment?\n\nEmail support@fixit.com',
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
        <View style={[styles.sectionHeader, { backgroundColor: colors.surface }]}><Text style={[styles.sectionHeaderText, { color: colors.text }]}>Feedback & Suggestions</Text></View>
        {questions.map((q, i) => (
          <View key={i}>
            <TouchableOpacity style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={() => setOpenMap(prev => ({ ...prev, [q]: !prev[q] }))}>
              <Text style={[styles.rowText, { color: colors.text }]}>{q}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary as any} />
            </TouchableOpacity>
            {openMap[q] && answers[q] && (
              <View style={[styles.answerBox, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.answerText, { color: colors.textSecondary }]}>{answers[q]}</Text>
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