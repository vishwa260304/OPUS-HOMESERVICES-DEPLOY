import React, { useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// removed gradient icon inside rows per request

export default function SupportPaymentScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [openMap, setOpenMap] = useState<{ [key: string]: boolean }>({});
  const { colors } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  const questions = [
    'What are the modes of payment?',
    'How do I change the mode of the payment?',
    'How can I delete my saved card details?',
    'Why is my COD blocked?',
    'What is the limit to place a COD order?',
    'Is there a delivery fee for each order?',
    'Do you charge for the Bag?',
  ];

  const answers: { [key: string]: string } = {
    'What are the modes of payment?': 'The following modes of payment are available on our app:\n\n a. Cash on Delivery (COD), after the first order is placed via Online Payment.\n\n b. Visa, Mastercard, and Rupay-credit and debit cards.\n\n c. UPI methods\n\n d. Wallets\n\nIf the order must be left at the security gate, please continue to pay online using wallets, UPI, net banking, or credit/debit cards.',
    'How do I change the mode of the payment?': "Since the orders are already out for delivery shortly, it's not possible to change the payment method at this time.",
    'How can I delete my saved card details?': 'You can contact us through the email mentioned below to delete your card details.',
    'Why is my COD blocked?': "When orders are placed and cancelled post packing or delivering, the COD gets disabled. Please place an order using the 'Online Payment' option. As soon as your order is marked as 'Delivered', the system will automatically enable COD on your account.",
    'What is the limit to place a COD order?': 'You can place a COD order with a value of upto Rs 500.',
    'Is there a delivery fee for each order?': 'The delivery fee is levied based on the location at which the order is being delivered, as each store has its unique delivery fee structure. If applicable, the delivery fee will be specified on the checkout page.',
    'Do you charge for the Bag?': 'As a policy, Fixit does not charge for the bag. There is a packaging fee that is applicable to the consumer which is essentially rendered towards the efforts of the picker who picks the products for you at our warehouse.',
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
        <View style={[styles.sectionHeader, { backgroundColor: colors.surface }]}><Text style={[styles.sectionHeaderText, { color: colors.text }]}>Payment Related</Text></View>
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