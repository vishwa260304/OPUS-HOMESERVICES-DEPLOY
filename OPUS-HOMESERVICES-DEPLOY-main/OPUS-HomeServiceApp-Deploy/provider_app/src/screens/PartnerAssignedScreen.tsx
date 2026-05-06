import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Image, Linking, Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { moderateScale } from '../utils/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../components/BackButton';
import OpusAgentLogo from '../components/OpusAgentLogo';
import BottomTab from '../components/BottomTab';
import { useTheme } from '../context/ThemeContext';
import { getCompanyInfo, getBookings, getCurrentAssignBooking, cancelBooking, getNotifications } from '../utils/appState';

const formatTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = `${d.getMinutes()}`.padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const h12 = ((hours + 11) % 12) + 1;
  return `${h12}:${minutes} ${suffix}`;
};

const PartnerAssignedScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [brandName, setBrandName] = useState<string>('Fixit Partner');
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [booking, setBooking] = useState<any | null>(null);

  useEffect(() => {
    setBrandName(getCompanyInfo().companyName || 'Fixit Partner');
    setNotificationCount(getNotifications().length);
    const currentId = getCurrentAssignBooking?.();
    const list = getBookings();
    const found = currentId ? list.find(b => b.id === currentId) : list.find(b => b.status === 'Assigned' || b.status === 'InProgress') || list[0];
    setBooking(found || null);
  }, []);

  const handleCallPartner = () => {
    if (booking?.partnerPhone) {
      const phoneNumber = booking.partnerPhone.replace(/[^0-9+]/g, '');
      Linking.openURL(`tel:${phoneNumber}`).catch(err => {
        Alert.alert('Error', 'Unable to make phone call');
        console.error('Error opening phone dialer:', err);
      });
    } else {
      Alert.alert('No Phone Number', 'Partner phone number is not available');
    }
  };

  const handleWhatsAppPartner = () => {
    if (booking?.partnerPhone) {
      const phoneNumber = booking.partnerPhone.replace(/[^0-9]/g, '');
      const message = `Hi ${booking.partnerName}, I'm contacting you regarding the ${booking.serviceName} service for ${booking.customerName}.`;
      const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
      
      Linking.openURL(whatsappUrl).catch(() => {
        // Fallback to web WhatsApp if app is not installed
        const webWhatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        Linking.openURL(webWhatsappUrl).catch(err => {
          Alert.alert('Error', 'Unable to open WhatsApp');
          console.error('Error opening WhatsApp:', err);
        });
      });
    } else {
      Alert.alert('No Phone Number', 'Partner phone number is not available');
    }
  };

  const handleCancelJob = () => {
    Alert.alert(
      'Cancel Job',
      'Are you sure you want to cancel this job? This action cannot be undone.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            if (booking?.id) {
              // Mark booking as cancelled
              cancelBooking(booking.id);
              Alert.alert('Job Cancelled', 'The job has been successfully cancelled.', [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('WeeklyChart', { mode: 'weekly', titleWeekly: 'Weekly Insights' }),
                },
              ]);
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient colors={[colors.primary, colors.primary]} start={{x:0,y:0}} end={{x:0,y:1}} style={styles.gradientBg}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} style={{ backgroundColor: colors.background }}>
          {/* Header */}
          <View style={styles.topRow}>
            <OpusAgentLogo />
            <View style={styles.topRightSection}>
              <TouchableOpacity style={styles.bellWrap} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.85}>
                <Ionicons name="notifications" size={moderateScale(18)} color="#ffffff" />
                {notificationCount > 0 ? (
                  <View style={styles.badge}><Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : String(notificationCount)}</Text></View>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                <View style={styles.avatarDot} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.brandName, { color: colors.text }]}>{brandName}</Text>

          {/* Back + Title */}
          <View style={styles.headerRow}>
            <BackButton style={styles.backCircle} color="#ffffff" size={moderateScale(18)} />
            <Text style={[styles.pageTitle, { color: colors.text }]}>Partner assigned successfully</Text>
          </View>

          {/* Info card */}
          <View style={[styles.whiteCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}> 
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark" size={moderateScale(22)} color="#118B50" />
            </View>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Details of the customer{`\n`}has been shared with the partner</Text>
          </View>

          {/* Service summary */}
          <View style={[styles.whiteCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.serviceTitle, { color: colors.text }]}>{booking?.serviceName || 'Service'}</Text>
            {!!booking?.paymentMode && (<View style={styles.chip}><Text style={styles.chipText}>{booking.paymentMode}</Text></View>)}
            <Text style={[styles.serviceMeta, { color: colors.textSecondary }]}>Booking ID: #{booking?.id || '—'}</Text>
            <Text style={[styles.serviceMeta, { color: colors.textSecondary }]}>{booking?.createdAt ? new Date(booking.createdAt).toLocaleString() : ''}</Text>
          </View>

          {/* Assigned partner */}
          <View style={[styles.whiteCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.subHeader, { color: colors.text }]}>Assigned Partner</Text>
              <View style={styles.badgeSoft}><Text style={styles.badgeSoftText}>On the Way</Text></View>
            </View>
            <View style={styles.partnerRow}>
              <View style={styles.bigAvatar}>
                {/* Partner photo if available */}
                {booking?.partnerPhoto ? (
                  <Image source={{ uri: booking.partnerPhoto }} style={{ width: '100%', height: '100%', borderRadius: moderateScale(24) }} />
                ) : null}
              </View>
              <View style={{flex:1}}>
                <Text style={[styles.partnerName, { color: colors.text }]}>{booking?.partnerName || '—'}</Text>
                <Text style={[styles.partnerRole, { color: colors.textSecondary }]}>{booking?.serviceName || 'Partner'}</Text>
              </View>
              <TouchableOpacity style={styles.roundIcon} onPress={handleCallPartner}><Ionicons name="call" size={16} color="#3B5BFD" /></TouchableOpacity>
              <TouchableOpacity style={styles.roundIcon} onPress={handleWhatsAppPartner}><Ionicons name="logo-whatsapp" size={16} color="#25D366" /></TouchableOpacity>
            </View>
          </View>


          {/* Job Progress */}
          <View style={[styles.whiteCard, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.subHeader, { color: colors.text }]}>Job Progress</Text>
            <View style={styles.progressItem}>
              <View style={[styles.progressDot, {backgroundColor:'#26e07f'}]} />
              <View style={{flex:1}}>
                <Text style={styles.progressTitle}>Assigned</Text>
                <Text style={styles.progressMeta}>Partner assigned successfully</Text>
              </View>
              <Text style={styles.timeText}>{formatTime(booking?.assignedAt)}</Text>
            </View>
            <View style={styles.progressItem}>
              <View style={[styles.progressDot, {backgroundColor:'#fbbf24'}]} />
              <View style={{flex:1}}>
                <Text style={styles.progressTitle}>On the Way</Text>
                <Text style={styles.progressMeta}>Partner is on the way</Text>
              </View>
              <Text style={styles.timeText}>{booking?.enRouteAt ? formatTime(booking.enRouteAt) : ''}</Text>
            </View>
            <View style={styles.progressItemDisabled}>
              <View style={[styles.progressDot, {backgroundColor:'#e5e7eb'}]} />
              <View style={{flex:1}}>
                <Text style={styles.progressTitleDisabled}>Arrived</Text>
                <Text style={styles.progressMetaDisabled}>Partner reached location</Text>
              </View>
            </View>
            <View style={styles.progressItemDisabled}>
              <View style={[styles.progressDot, {backgroundColor:'#e5e7eb'}]} />
              <View style={{flex:1}}>
                <Text style={styles.progressTitleDisabled}>Service Started</Text>
                <Text style={styles.progressMetaDisabled}>Work in progress</Text>
              </View>
            </View>
          </View>

          {/* Cancel */}
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} activeOpacity={0.85} onPress={handleCancelJob}>
            <Ionicons name="close" size={16} color="#ff3b30" />
            <Text style={styles.cancelBtnText}>Cancel Job</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Support')}>
            <Text style={styles.supportLink}>Escalate to Support</Text>
          </TouchableOpacity>
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
  bellWrap: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor:'#13235d', alignItems:'center', justifyContent:'center', marginRight: moderateScale(10), position:'relative' },
  badge: { position:'absolute', top:-6, right:-6, backgroundColor:'#3B5BFD', borderRadius: 8, paddingHorizontal:5, paddingVertical:1 },
  badgeText: { color:'#ffffff', fontSize:10, fontWeight:'700' },
  avatarDot: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: '#e6e8ff' },
  brandName: { color: '#ffffff', marginTop: moderateScale(12), marginBottom: moderateScale(20), fontSize: moderateScale(28), fontWeight: '700', letterSpacing: moderateScale(1), fontFamily: Platform.OS === 'android' ? 'sans-serif-bold' : undefined },

  headerRow: { flexDirection: 'row', alignItems: 'center', columnGap: moderateScale(10), marginBottom: moderateScale(12) },
  backCircle: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), backgroundColor:'#3b5bfd', alignItems:'center', justifyContent:'center' },
  pageTitle: { color:'#ffffff', fontWeight:'700', fontSize: moderateScale(18) },

  whiteCard: { backgroundColor:'#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), marginBottom: moderateScale(14) },
  cardShadow: { shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, shadowOffset:{ width:0, height:4 }, elevation:2 },
  successIconWrap: { width: moderateScale(44), height: moderateScale(44), borderRadius: moderateScale(22), backgroundColor:'#D7F5E7', alignItems:'center', justifyContent:'center', marginBottom: moderateScale(10), alignSelf:'center' },
  infoTitle: { color:'#111827', textAlign:'center', fontWeight:'700' },

  serviceTitle: { color:'#111827', fontWeight:'700', fontSize: moderateScale(16) },
  chip: { position:'absolute', right: moderateScale(16), top: moderateScale(16), backgroundColor:'#E7F5ED', paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(4), borderRadius: moderateScale(12) },
  chipText: { color:'#118B50', fontWeight:'700', fontSize: moderateScale(12) },
  serviceMeta: { color:'#6B7280', marginTop: moderateScale(6) },

  rowBetween: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  subHeader: { color:'#111827', fontWeight:'700', marginBottom: moderateScale(8) },
  partnerRow: { flexDirection:'row', alignItems:'center' },
  bigAvatar: { width: moderateScale(48), height: moderateScale(48), borderRadius: moderateScale(24), backgroundColor:'#E5E9F2', marginRight: moderateScale(12) },
  partnerName: { color:'#111827', fontWeight:'700' },
  partnerRole: { color:'#6B7280', marginTop: 2 },
  roundIcon: { width: moderateScale(34), height: moderateScale(34), borderRadius: moderateScale(17), backgroundColor:'#E7ECFF', alignItems:'center', justifyContent:'center', marginLeft: moderateScale(8) },
  badgeSoft: { backgroundColor:'#F3F4FF', paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(4), borderRadius: moderateScale(12) },
  badgeSoftText: { color:'#3B5BFD', fontWeight:'700', fontSize: moderateScale(12) },

  primaryBtn: { marginTop: moderateScale(12), backgroundColor:'#3b5bfd', paddingVertical: moderateScale(12), borderRadius: moderateScale(12), flexDirection:'row', alignItems:'center', justifyContent:'center', columnGap: moderateScale(8) },
  primaryBtnText: { color:'#ffffff', fontWeight:'700' },

  progressItem: { flexDirection:'row', alignItems:'center', paddingVertical: moderateScale(8) },
  progressItemDisabled: { flexDirection:'row', alignItems:'center', paddingVertical: moderateScale(8), opacity: 0.5 },
  progressDot: { width: moderateScale(18), height: moderateScale(18), borderRadius: moderateScale(9), marginRight: moderateScale(12) },
  progressTitle: { color:'#111827', fontWeight:'700' },
  progressMeta: { color:'#6B7280' },
  progressTitleDisabled: { color:'#111827', fontWeight:'700' },
  progressMetaDisabled: { color:'#6B7280' },
  timeText: { color:'#6B7280' },

  cancelBtn: { backgroundColor:'#ffffff', flexDirection:'row', alignItems:'center', justifyContent:'center', borderRadius: moderateScale(14), columnGap: moderateScale(8), paddingVertical: moderateScale(12), marginTop: moderateScale(10) },
  cancelBtnText: { color:'#ff3b30', fontWeight:'700' },
  supportLink: { color:'#8aa5ff', fontWeight:'700', textAlign:'center', marginTop: moderateScale(12), marginBottom: moderateScale(24) },
});

export default PartnerAssignedScreen;


