import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OpusWalletScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [balance, setBalance] = useState<number>(0);
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  useEffect(() => {
    const load = async () => {
      const raw = await AsyncStorage.getItem('opus_wallet_balance');
      setBalance(raw ? Number(raw) : 0);
    };
    const unsub = navigation.addListener('focus', load);
    load();
    return unsub as any;
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#004c8f', '#0c1a5d']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.heroBg}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: '#fff' }]}>Fixit Wallet</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.heroCenter}>
          <View style={styles.walletLogo}><Ionicons name="wallet" size={36} color="#1E3A8A" /></View>
          <Text style={styles.heroTitle}>FIXIT WALLET</Text>
          <Text style={styles.heroBalance}>₹{balance.toLocaleString('en-IN')}.00</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={[styles.featureCard, { backgroundColor: colors.card }]}>
          <View style={[styles.featureIcon, { backgroundColor: colors.surface }]}><Ionicons name="finger-print" size={18} color={colors.text as any} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>Single tap payments</Text>
            <Text style={[styles.featureSub, { color: colors.textSecondary }]}>Enjoy seamless payments without the wait for OTPs</Text>
          </View>
        </View>

        <View style={[styles.featureCard, { backgroundColor: colors.card }]}>
          <View style={[styles.featureIcon, { backgroundColor: colors.surface }]}><Ionicons name="wifi" size={18} color={colors.text as any} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>Zero failures</Text>
            <Text style={[styles.featureSub, { color: colors.textSecondary }]}>Zero payment failures ensure you never miss an order</Text>
          </View>
        </View>

        <View style={[styles.featureCard, { backgroundColor: colors.card }]}>
          <View style={[styles.featureIcon, { backgroundColor: colors.surface }]}><Ionicons name="time" size={18} color={colors.text as any} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>Real-time refunds</Text>
            <Text style={[styles.featureSub, { color: colors.textSecondary }]}>No need to wait. Refunds are instant!</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addMoneyBtn, !user && { opacity: 0.6 }]}
          onPress={() => {
            if (!user) {
              alert('Please log in to add money to your wallet.');
              router.push('/subcategories/login' as any);
              return;
            }
            router.push('/profile/opus-add-money' as any);
          }}
        >
          <LinearGradient
            colors={['#004c8f', '#0c1a5d']}
            style={styles.addMoneyGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.addMoneyText}>Add Money</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={[styles.transactionsCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions yet.</Text>
        </View>
      </ScrollView>

      {/* Full-screen overlay: real blur on iOS; themed semi-opaque sheath on Android */}
      {Platform.OS === 'ios' ? (
        <BlurView
          tint={isDark ? 'dark' : 'light'}
          intensity={80}
          style={[StyleSheet.absoluteFillObject, styles.blurOverlay]}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            styles.blurOverlay,
            {
              backgroundColor: isDark
                ? 'rgba(18, 18, 18, 0.97)'
                : 'rgba(255, 255, 255, 0.95)',
            },
          ]}
        />
      )}

      {/* Coming soon pill — same gradient as header */}
      <View style={styles.comingSoonOverlay}>
        <LinearGradient
          colors={['#004c8f', '#0c1a5d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.comingSoonPill}
        >
          <Text style={styles.comingSoonSubline}>Add money, pay seamlessly.</Text>
          <Text style={styles.comingSoonHeadline}>Wallet coming soon!</Text>
        </LinearGradient>
      </View>

      {/* Back chevron above overlay so it stays tappable */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.overlayBackButton}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={26} color={isDark ? '#fff' : '#000'} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  heroBg: { paddingBottom: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  heroCenter: { alignItems: 'center', paddingVertical: 10 },
  walletLogo: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  heroBalance: { marginTop: 6, fontSize: 18, fontWeight: '800', color: '#B1E3FF' },
  featureCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginTop: 12 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  featureTitle: { fontWeight: '800', marginBottom: 4 },
  featureSub: { },
  addMoneyBtn: { marginTop: 16, borderRadius: 12, overflow: 'hidden' },
  addMoneyGradient: { paddingVertical: 14, alignItems: 'center' },
  addMoneyText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  transactionsCard: { marginTop: 16, borderRadius: 12, padding: 16 },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  emptyText: { },
  blurOverlay: { zIndex: 1 },
  overlayBackButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 3,
    padding: 4,
  },
  comingSoonOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderRadius: 18,
    minWidth: 260,
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 7,
  },
  comingSoonSubline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.25,
  },
  comingSoonHeadline: {
    fontSize: 23,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.45,
  },
});