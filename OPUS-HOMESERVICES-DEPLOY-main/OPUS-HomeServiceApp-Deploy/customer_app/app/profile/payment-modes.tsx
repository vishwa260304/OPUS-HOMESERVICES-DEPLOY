import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useRouter, useNavigation } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PaymentModes() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  const handleAdd = (label: string) => {
    Alert.alert('Coming soon', `${label} linking will be available shortly.`);
  };

  const [selectedBank, setSelectedBank] = useState<{ id: string; name: string } | null>(null);
  const [savedUpiId, setSavedUpiId] = useState<string | null>(null);
  const [showAddUpi, setShowAddUpi] = useState<boolean>(false);
  const [upiId, setUpiId] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const raw = await AsyncStorage.getItem('selected_netbanking_bank');
      setSelectedBank(raw ? JSON.parse(raw) : null);
      const upi = await AsyncStorage.getItem('saved_upi_id');
      setSavedUpiId(upi || null);
    };
    const unsubscribe = navigation.addListener('focus', load);
    load();
    return unsubscribe as any;
  }, [navigation]);

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: colors.text }]}>{title}</Text>
  );

  const SectionCard = ({ children }: { children: React.ReactNode }) => (
    <View style={[styles.sectionCardWrap, { backgroundColor: colors.card }]}>
      {children}
    </View>
  );

  const Row = ({
    iconName,
    title,
    subtitle,
    actionLabel = 'ADD',
    onPress,
  }: {
    iconName: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onPress: () => void;
  }) => {
    const isRemove = actionLabel === 'REMOVE';
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={[styles.rowIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name={iconName} size={20} color={colors.textSecondary as any} />
          </View>
        <View style={styles.rowTextWrap}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
      </View>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          styles.actionPill,
          {
            borderColor: isRemove ? colors.border : colors.primaryDark,
            backgroundColor: isRemove ? colors.surface : 'transparent',
          },
        ]}
      >
        <Text
          style={[
            styles.actionPillText,
            { color: isRemove ? (colors.textSecondary as string) : colors.primaryDark },
          ]}
        >
          {actionLabel}
        </Text>
      </TouchableOpacity>
    </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Payment Methods</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Cards */}
        <SectionCard>
          <SectionHeader title="Cards" />
          <View style={[styles.cardList, { backgroundColor: colors.card }]}>
            <Row
              iconName="card-outline"
              title="Add credit or debit cards"
              onPress={() => handleAdd('Credit/Debit cards')}
            />
          </View>
        </SectionCard>

        <View style={[styles.sectionSpacer, { backgroundColor: colors.background }]} />

        {/* UPI */}
        <SectionCard>
          <SectionHeader title="UPI" />
          <View style={[styles.cardList, { backgroundColor: colors.card }]}>
            {savedUpiId ? (
              <View>
                <Row
                  iconName="logo-usd"
                  title={savedUpiId}
                  actionLabel="REMOVE"
                  onPress={async () => {
                    await AsyncStorage.removeItem('saved_upi_id');
                    setSavedUpiId(null);
                  }}
                />
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              </View>
            ) : null}
            <Row
              iconName="logo-usd"
              title="PhonePe UPI"
              subtitle="Link your PhonePe UPI account"
              onPress={() => handleAdd('PhonePe UPI')}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <Row
              iconName="logo-google"
              title="Google Pay UPI"
              subtitle="Link your Google Pay UPI account"
              onPress={() => handleAdd('Google Pay UPI')}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <Row
              iconName="logo-usd"
              title="Add new UPI ID"
              onPress={() => handleAdd('New UPI ID')}
            />
            {showAddUpi ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <View style={[styles.inlineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                    <View style={[styles.rowIcon, { backgroundColor: colors.surface }]}><Text style={{ color: colors.text, fontWeight: '800' }}>UPI</Text></View>
                    <Text style={[styles.rowTitle, { fontSize: 18, color: colors.text }]}>Add new UPI ID</Text>
                  </View>
                  <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  <View style={{ padding: 16 }}>
                    <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.card }]}>
                      <TextInput
                        placeholder="Enter your UPI ID"
                        placeholderTextColor={colors.textSecondary}
                        style={[styles.input, { color: colors.text }]}
                        value={upiId}
                        onChangeText={setUpiId}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <Text style={[styles.helperText, { color: colors.textSecondary }]}>Your UPI ID will be encrypted and is 100% safe with us</Text>
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: colors.primaryDark }]}
                      onPress={async () => {
                        if (!user) {
                          Alert.alert('Login required', 'Please log in to add UPI IDs.', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Login', onPress: () => router.push('/subcategories/login' as any) },
                          ]);
                          return;
                        }
                        const value = upiId.trim();
                        if (!value || !/^[\w.\-]+@[\w\-]+$/i.test(value)) {
                          Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID like name@bank.');
                          return;
                        }
                        await AsyncStorage.setItem('saved_upi_id', value);
                        setSavedUpiId(value);
                        setShowAddUpi(false);
                        setUpiId('');
                      }}
                    >
                      <Text style={styles.primaryBtnText}>Add UPI ID</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </SectionCard>

        <View style={[styles.sectionSpacer, { backgroundColor: colors.background }]} />

        {/* Wallets */}
        <SectionCard>
          <SectionHeader title="Wallets" />
          <View style={[styles.cardList, { backgroundColor: colors.card }]}>
            <Row
              iconName="logo-amazon"
              title="Amazon Pay Balance"
              subtitle="Link your Amazon Pay balance wallet"
              onPress={() => handleAdd('Amazon Pay Balance')}
            />
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
            <Row
              iconName="wallet-outline"
              title="Fixit Wallet"
              subtitle="Check your Fixit Wallet balance"
              onPress={() => handleAdd('Fixit Wallet')}
            />
          </View>
        </SectionCard>

        <View style={[styles.sectionSpacer, { backgroundColor: colors.background }]} />

        {/* Netbanking */}
        <SectionCard>
          <SectionHeader title="Netbanking" />
          <View style={[styles.cardList, { backgroundColor: colors.card }]}>
            {selectedBank ? (
              <View>
                <Row
                  iconName="business-outline"
                  title={selectedBank.name}
                  actionLabel="REMOVE"
                  onPress={async () => {
                    await AsyncStorage.removeItem('selected_netbanking_bank');
                    setSelectedBank(null);
                  }}
                />
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              </View>
            ) : null}
            <Row
              iconName="business-outline"
              title="Netbanking"
              onPress={() => handleAdd('Netbanking')}
            />
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: 0.3 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  sectionCardWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  cardList: { overflow: 'hidden' },
  sectionSpacer: { height: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowTextWrap: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { fontSize: 13, marginTop: 2, lineHeight: 18, maxWidth: 240 },
  actionPill: {
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionPillText: { fontWeight: '700', fontSize: 12, letterSpacing: 0.4 },
  separator: { height: 1, marginLeft: 58 },
  inlineCard: { borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  inputWrapper: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  input: { paddingHorizontal: 14, paddingVertical: 12 },
  helperText: { marginTop: 10 },
  primaryBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});