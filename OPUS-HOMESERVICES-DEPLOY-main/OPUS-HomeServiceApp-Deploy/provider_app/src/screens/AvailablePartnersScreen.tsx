import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Image, Alert, Platform } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { moderateScale } from '../utils/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import BackButton from '../components/BackButton';
import { Ionicons } from '@expo/vector-icons';
import OpusAgentLogo from '../components/OpusAgentLogo';
import BottomTab from '../components/BottomTab';
import { useTheme } from '../context/ThemeContext';
import { getCompanyInfo, getEmployees, getSelectedSector, assignPartnerToNewBooking, getBookings, getCurrentAssignBooking, assignPartnerToBooking, getNotifications } from '../utils/appState';

const AvailablePartnersScreen = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const [brandName, setBrandName] = useState<string>('Fixit Partner');
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [employees, setEmployees] = useState<ReturnType<typeof getEmployees>>([]);

  useEffect(() => {
    if (isFocused) {
      setBrandName(getCompanyInfo().companyName || 'Fixit Partner');
      setNotificationCount(getNotifications().length);
      setEmployees(getEmployees());
    }
  }, [isFocused]);

  const selectedSectorKey = (getSelectedSector?.() as 'home' | 'healthcare' | 'appliance' | 'automobile') || 'home';

  const isRoleForSector = (role: string, sector: 'home' | 'healthcare' | 'appliance' | 'automobile') => {
    const r = (role || '').toLowerCase();
    switch (sector) {
      case 'home':
        return (
          r.startsWith('home:') ||
          r.startsWith('home cleaning') ||
          r.startsWith('cleaning staff') ||
          r.startsWith('electrician') ||
          r.startsWith('plumber') ||
          r.startsWith('carpentry:') ||
          r.startsWith('painter') ||
          r.startsWith('renovation:')
        );
      case 'healthcare':
        return (
          r.startsWith('diagnostics:') ||
          r.startsWith('health checkup:') ||
          r.startsWith('physiotherapy:') ||
          r.includes('doctor')
        );
      case 'appliance':
        return (
          r.startsWith('appliance:') ||
          r === 'ac technician'
        );
      case 'automobile':
        return (
          r.startsWith('car ') ||
          r.startsWith('bike ') ||
          r.startsWith('car tyres:') ||
          r.startsWith('bike tyres:') ||
          r.startsWith('car body:') ||
          r.startsWith('bike body:') ||
          r.startsWith('car detail:') ||
          r.startsWith('bike detail:') ||
          r.startsWith('car repair:') ||
          r.startsWith('bike repair:') ||
          r.startsWith('acting driver') ||
          r === 'driver'
        );
      default:
        return true;
    }
  };

  const availableEmployees = useMemo(() => {
    const list = getEmployees(); // pull latest in case of navigation back
    const sectorFiltered = list.filter(emp => isRoleForSector(emp.role || '', selectedSectorKey));
    return sectorFiltered;
  }, [employees, selectedSectorKey]);

  return (
    <LinearGradient colors={[colors.primary, colors.primary]} start={{x:0,y:0}} end={{x:0,y:1}} style={styles.gradientBg}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} style={{ backgroundColor: colors.background }}>
          {/* Header Section */}
          <View style={styles.topRow}>
            <OpusAgentLogo />
            <View style={styles.topRightSection}>
              <View style={styles.topRowIcons}>
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
          </View>
          
          <Text style={[styles.brandName, { color: colors.text }]}>{brandName}</Text>

          {/* Available Partners Section */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderRow}>
              <BackButton style={styles.backBtn} color="#87CEEB" size={moderateScale(22)} />
            <Text style={[styles.sectionHeaderText, { color: colors.text }]}>Available Partners</Text>
            </View>
          </View>

          {/* Partner Cards - dynamic based on selected sector and saved employees */}
          {availableEmployees.map(emp => (
            <View key={emp.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={styles.leftRow}>
                <View style={styles.bigAvatar}>
                  {emp.photo ? (
                    <Image source={{ uri: emp.photo }} style={{ width: '100%', height: '100%', borderRadius: moderateScale(29) }} />
                  ) : (
                    <Ionicons name="person" size={moderateScale(28)} color="#9AA3B2" />
                  )}
                </View>
                <View style={{flex:1}}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.text }]}>{emp.name}</Text>
                    <View style={styles.statusContainer}>
                      {emp.status === 'active' ? (
                        <>
                          <View style={styles.greenStatusDot} />
                          <Text style={styles.greenStatusText}>Available</Text>
                        </>
                      ) : (
                        <>
                          <View style={styles.redStatusDot} />
                          <Text style={styles.redStatusText}>Busy</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.role, { color: colors.textSecondary }]}>{emp.role || 'Partner'}</Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={moderateScale(14)} color="#6B7280" />
                    <Text style={styles.meta}> Nearby</Text>
                    <Ionicons name="checkmark-circle" size={moderateScale(14)} color="#14B86E" style={{marginLeft: moderateScale(12)}} />
                    <Text style={styles.meta}> Verified</Text>
                  </View>
                </View>
              </View>
              {emp.status === 'active' ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    Alert.alert(
                      'Confirm Assignment',
                      `Assign ${emp.name} (${emp.role || 'Partner'}) to this job?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Assign', style: 'default', onPress: () => {
                            const bookingId = getCurrentAssignBooking?.();
                            if (bookingId) {
                              assignPartnerToBooking(bookingId, emp);
                            } else {
                              assignPartnerToNewBooking(emp);
                            }
                            setEmployees(getEmployees());
                            navigation.navigate('PartnerAssigned');
                          } },
                      ]
                    );
                  }}
                >
                  <Text style={[styles.primaryBtnText, { color: '#ffffff' }]}>Assign Partner</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.assignedBtn}>
                  <Text style={styles.assignedBtnText}>Assigned</Text>
                </View>
              )}
            </View>
          ))}

          {availableEmployees.length === 0 && (
            <View style={[styles.card, { alignItems: 'center' }]}>
              <Text style={styles.role}>No partners available for this sector yet.</Text>
            </View>
          )}
        </ScrollView>
        <BottomTab active={'Home'} />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  container: { flex: 1, padding: moderateScale(20) },
  scrollContent: { paddingBottom: moderateScale(120), paddingTop: moderateScale(10) },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: moderateScale(16) },
  topRightSection: { flexDirection: 'column', alignItems: 'flex-end', marginRight: moderateScale(12) },
  topRowIcons: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(8) },
  bellWrap: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor:'#13235d', alignItems:'center', justifyContent:'center', marginRight: moderateScale(12), position:'relative' },
  badge: { position:'absolute', top:-6, right:-6, backgroundColor:'#3B5BFD', borderRadius: 8, paddingHorizontal:5, paddingVertical:1 },
  badgeText: { color:'#ffffff', fontSize:10, fontWeight:'700' },

  avatarDot: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: '#e6e8ff' },
  brandName: { color: '#ffffff', marginTop: moderateScale(12), marginBottom: moderateScale(20), fontSize: moderateScale(28), fontWeight: '700', letterSpacing: moderateScale(1), fontFamily: Platform.OS === 'android' ? 'sans-serif-bold' : undefined },
  sectionHeader: { marginBottom: moderateScale(16) },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: moderateScale(8) },
  sectionHeaderText: { color: '#ffffff', fontWeight: '700', fontSize: moderateScale(18), marginLeft: moderateScale(8) },
  content: { flex: 1, paddingBottom: 20 },
  card: { backgroundColor:'#ffffff', borderRadius:moderateScale(16), padding:moderateScale(16), marginBottom:moderateScale(12), shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, shadowOffset:{ width:0, height:4 }, elevation:2 },
  leftRow: { flexDirection:'row', alignItems:'center', marginBottom: moderateScale(12) },
  bigAvatar: { width: moderateScale(58), height: moderateScale(58), borderRadius: moderateScale(29), backgroundColor:'#E5E9F2', marginRight: moderateScale(12), alignItems:'center', justifyContent:'center' },
  nameRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' },
  name: { color:'#111827', fontWeight:'700', fontSize: moderateScale(16) },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  greenStatusDot: { width: moderateScale(8), height: moderateScale(8), borderRadius: moderateScale(4), backgroundColor: '#26e07f', marginRight: moderateScale(4) },
  greenStatusText: { color:'#26e07f', fontWeight:'700', fontSize: moderateScale(14) },
  redStatusDot: { width: moderateScale(8), height: moderateScale(8), borderRadius: moderateScale(4), backgroundColor: '#ff6a6a', marginRight: moderateScale(4) },
  redStatusText: { color:'#ff6a6a', fontWeight:'700', fontSize: moderateScale(14) },
  role: { color:'#374151', marginTop: moderateScale(2), fontSize: moderateScale(14) },
  metaRow: { flexDirection:'row', alignItems: 'center', marginTop: moderateScale(6) },
  meta: { color:'#6B7280', fontSize: moderateScale(14), marginLeft: moderateScale(4) },
  primaryBtn: { backgroundColor:'#3b5bfd', paddingVertical:moderateScale(12), borderRadius:moderateScale(12), alignItems:'center' },
  primaryBtnText: { color:'#ffffff', fontWeight:'700', fontSize: moderateScale(14) },
  assignedBtn: { backgroundColor:'#D7F5E7', paddingVertical:moderateScale(12), borderRadius:moderateScale(12), alignItems:'center' },
  assignedBtnText: { color:'#118B50', fontWeight:'800', fontSize: moderateScale(14) },
});

export default AvailablePartnersScreen;