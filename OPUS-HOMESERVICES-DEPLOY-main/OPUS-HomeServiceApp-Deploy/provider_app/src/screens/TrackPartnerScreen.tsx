import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Platform, Alert } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { moderateScale } from '../utils/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../components/BackButton';
import OpusAgentLogo from '../components/OpusAgentLogo';
import BottomTab from '../components/BottomTab';
import { useTheme } from '../context/ThemeContext';
import { getCompanyInfo, getNotifications } from '../utils/appState';

const TrackPartnerScreen = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const [brandName, setBrandName] = useState('Fixit Partner');
  const [notificationCount, setNotificationCount] = useState<number>(0);

  useEffect(() => {
    if (isFocused) {
      setBrandName(getCompanyInfo().companyName || 'Fixit Partner');
      setNotificationCount(getNotifications().length);
    }
  }, [isFocused]);

  return (
    <LinearGradient colors={[colors.primary, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientBg}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} style={{ backgroundColor: colors.background }}>
          <View style={styles.topRow}>
            <OpusAgentLogo />
            <View style={styles.topRightSection}>
              <TouchableOpacity style={styles.bellWrap} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.85}>
                <Ionicons name="notifications" size={moderateScale(18)} color="#ffffff" />
                {notificationCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : String(notificationCount)}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                <View style={styles.avatarDot} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.brandName, { color: colors.text }]}>{brandName}</Text>

          <View style={styles.headerRow}>
            <BackButton style={styles.backCircle} color="#ffffff" size={moderateScale(18)} />
            <Text style={[styles.pageTitle, { color: colors.text }]}>Track partner</Text>
          </View>

          <View style={[styles.whiteCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={[styles.unavailableIcon, { backgroundColor: `${colors.primary}12` }]}>
              <Ionicons name="map-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.unavailableTitle, { color: colors.text }]}>Live tracking is not enabled yet</Text>
            <Text style={[styles.unavailableText, { color: colors.textSecondary }]}>
              This screen is intentionally gated until the production map and realtime location feed are implemented.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => Alert.alert('Coming Soon', 'Track partner will be enabled after the live map integration is complete.')}
            >
              <Ionicons name="notifications-outline" size={16} color="#ffffff" />
              <Text style={styles.primaryBtnText}>Notify Me When Ready</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <BottomTab active={'Home'} />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  container: { flex: 1, padding: moderateScale(20) },
  scrollContent: { paddingBottom: moderateScale(140) },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: moderateScale(16) },
  topRightSection: { flexDirection: 'row', alignItems: 'center' },
  bellWrap: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: '#13235d', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(10), position: 'relative' },
  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#3B5BFD', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  avatarDot: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: '#e6e8ff' },
  brandName: { color: '#ffffff', marginTop: moderateScale(12), marginBottom: moderateScale(20), fontSize: moderateScale(28), fontWeight: '700', letterSpacing: moderateScale(1), fontFamily: Platform.OS === 'android' ? 'sans-serif-bold' : undefined },
  headerRow: { flexDirection: 'row', alignItems: 'center', columnGap: moderateScale(10), marginBottom: moderateScale(12) },
  backCircle: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), backgroundColor: '#3b5bfd', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: '#ffffff', fontWeight: '700', fontSize: moderateScale(18) },
  whiteCard: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), marginBottom: moderateScale(14) },
  cardShadow: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  unavailableIcon: { width: moderateScale(56), height: moderateScale(56), borderRadius: moderateScale(28), alignItems: 'center', justifyContent: 'center', marginBottom: moderateScale(16), alignSelf: 'center' },
  unavailableTitle: { fontSize: moderateScale(18), fontWeight: '700', textAlign: 'center', marginBottom: moderateScale(10) },
  unavailableText: { fontSize: moderateScale(14), lineHeight: moderateScale(22), textAlign: 'center', marginBottom: moderateScale(18) },
  primaryBtn: { backgroundColor: '#3b5bfd', borderRadius: moderateScale(12), paddingVertical: moderateScale(14), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', columnGap: moderateScale(8), marginBottom: moderateScale(14) },
  primaryBtnText: { color: '#ffffff', fontWeight: '700' },
});

export default TrackPartnerScreen;
