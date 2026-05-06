import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
// removed header icons
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BottomTab from '../components/BottomTab';
import { getCompanyInfo, getNotifications } from '../utils/appState';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import BackButton from '../components/BackButton';

const PaymentIssuesScreen = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const [open, setOpen] = useState('one');
  const [brandName, setBrandName] = useState('Fixit Partner');
  const [notificationCount, setNotificationCount] = useState<number>(0);

  useEffect(() => {
    if (isFocused) {
      // Force partner branding per requirement
      setBrandName('Fixit Partner');
      setNotificationCount(getNotifications().length);
    }
  }, [isFocused]);

  const selectedSector = (require('../utils/appState').getSelectedSector?.() as 'home' | 'healthcare' | 'appliance' | 'automobile') || 'home';
  const sectorPrimary = selectedSector === 'healthcare' ? '#0AA484' : colors.primary;
  const sectorSoft = selectedSector === 'healthcare' ? '#C6F3E9' : '#EEF2FF';
  const gradientBlue: [string, string] = ['#004c8f', '#0c1a5d'];

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: colors.background, paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + moderateScale(10) }
    ]}>
      {/* Header Section removed per request */}
      

      {/* Page Title */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85} style={styles.backDotShadow}>
          <LinearGradient colors={gradientBlue} style={styles.backDot}>
            <Ionicons name="chevron-back" size={16} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={[styles.pageTitleCenter, { color: colors.text }]}>Payment issues</Text>
        <View style={{ width: moderateScale(34) }} />
      </View>

      {/* Content */}
      <View style={[styles.accordion, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
        <TouchableOpacity style={styles.accHeader} onPress={() => setOpen(open === 'one' ? '' : 'one')}>
          <Text style={[styles.accTitle, { color: colors.text }]}>My payout is delayed</Text>
          <Text style={[styles.chev, { color: colors.textSecondary }]}>▾</Text>
        </TouchableOpacity>
        {open === 'one' && <View style={styles.accBody}><Text style={[styles.accBodyText, { color: colors.textSecondary }]}>We’ll help verify your payout status and expedite if needed.</Text></View>}
      </View>
      <View style={[styles.accordion, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
        <TouchableOpacity style={styles.accHeader} onPress={() => setOpen(open === 'two' ? '' : 'two')}>
          <Text style={[styles.accTitle, { color: colors.text }]}>Wallet balance not updated</Text>
          <Text style={[styles.chev, { color: colors.textSecondary }]}>▾</Text>
        </TouchableOpacity>
        {open === 'two' && <View style={styles.accBody}><Text style={[styles.accBodyText, { color: colors.textSecondary }]}>Share the job ID and we’ll reconcile your wallet.</Text></View>}
      </View>
      <View style={[styles.accordion, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
        <TouchableOpacity style={styles.accHeader} onPress={() => setOpen(open === 'three' ? '' : 'three')}>
          <Text style={[styles.accTitle, { color: colors.text }]}>Bank transfer failed</Text>
          <Text style={[styles.chev, { color: colors.textSecondary }]}>▾</Text>
        </TouchableOpacity>
        {open === 'three' && <View style={styles.accBody}><Text style={[styles.accBodyText, { color: colors.textSecondary }]}>We’ll check with the payment gateway and retry.</Text></View>}
      </View>
      <View style={[styles.accordion, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
        <TouchableOpacity style={styles.accHeader} onPress={() => setOpen(open === 'four' ? '' : 'four')}>
          <Text style={[styles.accTitle, { color: colors.text }]}>Others</Text>
          <Text style={[styles.chev, { color: colors.textSecondary }]}>▾</Text>
        </TouchableOpacity>
        {open === 'four' && <View style={styles.accBody}><Text style={[styles.accBodyText, { color: colors.textSecondary }]}>Describe your payment issue in the ticket.</Text></View>}
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('RaiseTicket')} activeOpacity={0.9}>
        <LinearGradient colors={gradientBlue} style={styles.raiseGradientBtn}>
          <Text style={[styles.raiseText, { color: '#ffffff' }]}>Raise a Ticket</Text>
        </LinearGradient>
      </TouchableOpacity>
      <BottomTab active={'Support'} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1960', padding: moderateScale(20), paddingBottom: moderateScale(120) },
  // New header styles
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 0, marginBottom: 0 },
  topRightSection: { flexDirection: 'column', alignItems: 'flex-end', marginRight: moderateScale(12) },
  topRowIcons: { flexDirection: 'row', alignItems: 'center' },
  bellWrap: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor:'#13235d', alignItems:'center', justifyContent:'center', marginRight: moderateScale(12), position:'relative' },
  profileWrap: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor:'#13235d', alignItems:'center', justifyContent:'center' },
  badge: { position:'absolute', top:-6, right:-6, backgroundColor:'#ff3b30', borderRadius: 8, paddingHorizontal:5, paddingVertical:1 },
  badgeText: { color:'#ffffff', fontSize:10, fontWeight:'700' },
  avatarDot: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: '#e6e8ff', alignItems:'center', justifyContent:'center' },
  brandName: { color: '#ffffff', marginTop: moderateScale(12), marginBottom: moderateScale(20), fontSize: moderateScale(28), fontWeight: '700', letterSpacing: moderateScale(1), fontFamily: Platform.OS === 'android' ? 'sans-serif-bold' : undefined },
  headerTitle: { flex: 1, fontWeight: '800', fontSize: moderateScale(28), letterSpacing: moderateScale(0.5) },

  headerRow: { flexDirection:'row', alignItems:'center', marginTop: moderateScale(6), marginBottom: moderateScale(18) },
  backDot: { width: moderateScale(34), height: moderateScale(34), borderRadius: moderateScale(17), backgroundColor:'#3b5bfd', alignItems:'center', justifyContent:'center' },
  backDotShadow: { borderRadius: moderateScale(17), overflow:'hidden' },
  pageTitle: { color:'#ffffff', fontWeight:'700', fontSize:18, marginLeft: 10 },
  pageTitleCenter: { color:'#111827', fontWeight:'800', fontSize: moderateScale(20), textAlign:'center', flex: 1 },
  accordion: { backgroundColor:'#0f2374', borderRadius: moderateScale(12), marginBottom: 12 },
  accHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal: moderateScale(14), paddingVertical: moderateScale(16) },
  accTitle: { color:'#ffffff', fontWeight:'600' },
  chev: { color:'#cfe0ff' },
  accBody: { paddingHorizontal: moderateScale(14), paddingBottom: moderateScale(14) },
  accBodyText: { color:'#cfe0ff' },
  raiseButton: { backgroundColor: '#3b5bfd', padding: moderateScale(16), borderRadius: moderateScale(12), width: '100%', alignItems: 'center', marginTop: 10 },
  raiseGradientBtn: { padding: moderateScale(16), borderRadius: moderateScale(12), width: '100%', alignItems: 'center', marginTop: 10 },
  raiseText: { color: '#FFF', fontWeight: 'bold' },
});

export default PaymentIssuesScreen;