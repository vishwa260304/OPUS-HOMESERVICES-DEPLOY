import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Row = ({ icon, title, onPress, titleColor, chevronColor, iconBoxBg }: { icon: React.ReactNode; title: string; onPress?: () => void; titleColor: string; chevronColor: string; iconBoxBg: string }) => (
  <TouchableOpacity style={styles.row} onPress={onPress}>
    <View style={styles.rowLeft}>
      <View style={[styles.iconBox, { backgroundColor: iconBoxBg }]}>{icon}</View>
      <Text style={[styles.rowTitle, { color: titleColor }]}>{title}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={chevronColor} />
  </TouchableOpacity>
);

export default function OpusAddMoneyMethodScreen() {
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
          <Ionicons name="arrow-back" size={24} color={colors.text as any} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Select Payment Method</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommended</Text>
          <Row
            icon={<Ionicons name="cash-outline" size={18} color={colors.textSecondary as any} />}
            title="Supermoney UPI"
            titleColor={colors.text as any}
            chevronColor={colors.textSecondary as any}
            iconBoxBg={colors.surface as any}
            onPress={async () => {
              const amount = await AsyncStorage.getItem('opus_add_money_amount');
              const upiUrl = `upi://pay?pa=supermoney@upi&pn=Fixit%20Wallet&am=${amount || '0'}&cu=INR&tn=Add%20Money%20to%20Fixit`;
              const canOpen = await Linking.canOpenURL(upiUrl);
              if (canOpen) {
                Linking.openURL(upiUrl);
              } else {
                Alert.alert('UPI not available', 'No UPI app found to handle the request.');
              }
            }}
          />
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <Row
            icon={<Ionicons name="logo-usd" size={18} color={colors.textSecondary as any} />}
            title="PhonePe UPI"
            titleColor={colors.text as any}
            chevronColor={colors.textSecondary as any}
            iconBoxBg={colors.surface as any}
            onPress={async () => {
              const amount = await AsyncStorage.getItem('opus_add_money_amount');
              // PhonePe supports UPI deep link; phonepe:// is optional, upi:// fallback
              const upiUrl = `upi://pay?pa=opus@upi&pn=Fixit%20Wallet&am=${amount || '0'}&cu=INR&tn=Add%20Money%20to%20Fixit`;
              const phonePeUrl = `phonepe://upi/pay?pa=opus@upi&pn=Fixit%20Wallet&am=${amount || '0'}&cu=INR&tn=Add%20Money%20to%20Fixit`;
              const canOpenPhonePe = await Linking.canOpenURL(phonePeUrl);
              if (canOpenPhonePe) {
                Linking.openURL(phonePeUrl);
                return;
              }
              const canOpen = await Linking.canOpenURL(upiUrl);
              if (canOpen) {
                Linking.openURL(upiUrl);
              } else {
                Alert.alert('PhonePe not available', 'Install PhonePe or any UPI app to continue.');
              }
            }}
          />
        </View>

        <View style={styles.spacer} />

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cards</Text>
          <Row
            icon={<Ionicons name="card-outline" size={18} color={colors.textSecondary as any} />}
            title="Add credit or debit cards"
            titleColor={colors.text as any}
            chevronColor={colors.textSecondary as any}
            iconBoxBg={colors.surface as any}
            onPress={() => router.push('/profile/add-card' as any)}
          />
        </View>

        <View style={styles.spacer} />

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Pay by any UPI app</Text>
          <Row
            icon={<Ionicons name="logo-usd" size={18} color={colors.textSecondary as any} />}
            title="Add new UPI ID"
            titleColor={colors.text as any}
            chevronColor={colors.textSecondary as any}
            iconBoxBg={colors.surface as any}
          />
          <View style={[styles.warning, { backgroundColor: colors.surface }]}>
            <Text style={[styles.warningText, { color: colors.textSecondary }]}>This payment method is not available for adding funds to Fixit Wallet</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  card: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 12 },
  sectionTitle: { fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 6 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  rowTitle: { fontWeight: '500' },
  separator: { height: 1, marginLeft: 50 },
  spacer: { height: 12 },
  warning: { marginTop: 10, padding: 10, borderRadius: 10 },
  warningText: { },
});