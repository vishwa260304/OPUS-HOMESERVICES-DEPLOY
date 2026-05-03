import React, { useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AddCardScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [nameOnCard, setNameOnCard] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [nicknameType, setNicknameType] = useState<'Personal' | 'Business' | 'Other'>('Personal');
  const [customNickname, setCustomNickname] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  const isValid = useMemo(() => {
    const hasName = nameOnCard.trim().length >= 2;
    const digitsOnly = cardNumber.replace(/\D/g, '');
    const hasCard = digitsOnly.length >= 12; // basic length check
    const hasExpiry = /^(0[1-9]|1[0-2])\/(\d{2})$/.test(expiry.trim());
    const hasNickname =
      nicknameType === 'Other' ? customNickname.trim().length >= 2 : true;
    return hasName && hasCard && hasExpiry && hasNickname;
  }, [nameOnCard, cardNumber, expiry, nicknameType, customNickname]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Add a card</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={styles.acceptText}>
          We accept Credit and Debit Cards from Visa, Mastercard, Rupay, Pluxee, American Express & Diners.
        </Text>

        <Text style={[styles.label, { color: colors.text }]}>Name on card</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
          placeholder="Name on card"
          placeholderTextColor="#9CA3AF"
          value={nameOnCard}
          onChangeText={setNameOnCard}
        />

        <Text style={[styles.label, { color: colors.text }]}>Card number</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
          placeholder="Card number"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          value={cardNumber}
          onChangeText={setCardNumber}
          maxLength={19}
        />

        <Text style={[styles.label, { color: colors.text }]}>Expiry date (MM/YY)</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
          placeholder="MM/YY"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          value={expiry}
          onChangeText={setExpiry}
          maxLength={5}
        />

        <Text style={[styles.label, { color: colors.text }]}>Nickname for card</Text>
        <View style={styles.segmentRow}>
          {(['Personal','Business','Other'] as const).map(opt => (
            <TouchableOpacity key={opt} style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }, nicknameType===opt && [styles.segmentActive, { borderColor: colors.primaryDark }]]} onPress={()=>setNicknameType(opt)}>
              <Text style={[styles.segmentText, { color: colors.textSecondary }, nicknameType===opt && [styles.segmentTextActive, { color: colors.primaryDark }]]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {nicknameType === 'Other' ? (
          <TextInput
            style={[styles.input, { marginTop: 8, borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
            placeholder="Type the nickname"
            placeholderTextColor="#9CA3AF"
            value={customNickname}
            onChangeText={setCustomNickname}
          />
        ) : null}

        <Text style={[styles.disclaimer, { color: '#004c8f' }]}>
          I agree to tokenize my card details with card network (e.g. Visa, Mastercard, Rupay, etc.) for future payments.
        </Text>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          disabled={!isValid}
          style={[styles.primaryBtn, { backgroundColor: colors.primaryDark }, !isValid && { opacity: 0.6 }]}
          onPress={() => {
            if (!isValid) return;
            Alert.alert('Saved', 'Your card will be securely tokenized.');
          }}
        >
          <Text style={styles.primaryBtnText}>Add & Secure Card</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  acceptText: { color: '#6B7280', marginBottom: 16 },
  label: { color: '#111827', fontWeight: '600', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#111827' },
  segmentRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  segment: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  segmentActive: { backgroundColor: '#E6EEF7', borderColor: '#004c8f' },
  segmentText: { color: '#6B7280', fontWeight: '600' },
  segmentTextActive: { color: '#004c8f' },
  disclaimer: { color: '#6B7280', marginTop: 16 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  primaryBtn: { backgroundColor: '#004c8f', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnDisabled: { backgroundColor: '#7aa3c8' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});