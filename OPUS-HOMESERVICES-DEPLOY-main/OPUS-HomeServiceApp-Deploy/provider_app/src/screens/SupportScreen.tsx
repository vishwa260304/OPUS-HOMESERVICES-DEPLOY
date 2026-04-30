import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Platform, StatusBar, BackHandler } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getCompanyInfo, getNotifications, getTickets } from '../utils/appState';
import BottomTab from '../components/BottomTab';
import { LinearGradient } from 'expo-linear-gradient';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVerification } from '../hooks/useVerification';
import { useRoute } from '@react-navigation/native';

const SupportScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { verification } = useVerification();
  const [brandName, setBrandName] = useState('Fixit Partner');
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [tickets, setTickets] = useState<any[]>([]);

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Get selected sector first
  const selectedSector = (require('../utils/appState').getSelectedSector?.() as 'home' | 'healthcare' | 'appliance' | 'automobile') || 'home';
  
  // Check if user is doctor consultation or acting driver
  const isDoctorConsultation = verification?.selected_sector === 'Doctor Consultation' || 
                               selectedSector === 'healthcare' ||
                               route.name === 'DoctorDashboard' ||
                               route.name === 'Appointments' ||
                               route.name === 'MyPatients';
  const isActingDriver = verification?.selected_sector === 'Acting Drivers';

  // Acting driver: back (hardware or header) goes to ActingDriversDashboard
  useEffect(() => {
    if (!isActingDriver) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      (navigation as any).navigate('ActingDriversDashboard');
      return true;
    });
    return () => sub.remove();
  }, [isActingDriver, navigation]);
  
  // Header gradient colors - always blue, even for doctor users
  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];

  useEffect(() => {
    if (isFocused) {
      setBrandName('Fixit Partner');
      setNotificationCount(getNotifications().length);
      setTickets(getTickets());
    }
  }, [isFocused]);
  // Always use blue colors, even for doctor users
  const sectorPrimary = colors.primary;
  const sectorIconBg = colors.surface;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />
      
      {/* Custom header without bottom border radius */}
      <LinearGradient
        colors={sectorGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.customHeader}
      >
        <View style={styles.headerTopRow}>
          <View style={[styles.headerLeftContent, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.brandName}>{brandName}</Text>
          </View>
          <View style={[styles.headerRightContent, { paddingTop: insets.top + 8 }]}>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <TouchableOpacity style={styles.bellWrap} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.85}>
                <Ionicons name="notifications" size={moderateScale(18)} color="#ffffff" />
                {notificationCount > 0 ? (
                  <View style={styles.badge}><Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : String(notificationCount)}</Text></View>
                ) : null}
              </TouchableOpacity>
              <View style={{ width: moderateScale(10) }} />
              <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                <Ionicons name="person-circle" size={moderateScale(32)} color="#cfe0ff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent} style={{ backgroundColor: colors.background }}>

        {/* Support Section */}
        <Text style={[styles.supportHeading, { color: colors.text }]}>How can we help you today?</Text>
        <View style={styles.grid}>
          <TouchableOpacity style={[styles.tile, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} onPress={() => navigation.navigate('PaymentIssues')}>
            <View style={[styles.tileIcon, { backgroundColor: sectorIconBg }]}>
              <Ionicons name="wallet-outline" size={moderateScale(24)} color={sectorPrimary} />
            </View>
            <Text style={[styles.tileTitle, { color: colors.text }]}>Payment Issues</Text>
            <Text style={[styles.tileSub, { color: colors.textSecondary }]}>Delayed payouts, earnings</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.tile, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} onPress={() => navigation.navigate('JobIssues')}>
            <View style={[styles.tileIcon, { backgroundColor: sectorIconBg }]}>
              <Ionicons name="briefcase-outline" size={moderateScale(24)} color={sectorPrimary} />
            </View>
            <Text style={[styles.tileTitle, { color: colors.text }]}>Job Issues</Text>
            <Text style={[styles.tileSub, { color: colors.textSecondary }]}>Customer, address problems</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.tile, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} onPress={() => navigation.navigate('TechnicalHelp')}>
            <View style={[styles.tileIcon, { backgroundColor: sectorIconBg }]}>
              <Ionicons name="settings-outline" size={moderateScale(24)} color={sectorPrimary} />
            </View>
            <Text style={[styles.tileTitle, { color: colors.text }]}>Technical Help</Text>
            <Text style={[styles.tileSub, { color: colors.textSecondary }]}>App bugs, login issues</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.tile, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} onPress={() => navigation.navigate('KYCVerification')}>
            <View style={[styles.tileIcon, { backgroundColor: sectorIconBg }]}>
              <Ionicons name="card-outline" size={moderateScale(24)} color={sectorPrimary} />
            </View>
            <Text style={[styles.tileTitle, { color: colors.text }]}>KYC & Verification</Text>
            <Text style={[styles.tileSub, { color: colors.textSecondary }]}>Document upload issues</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Tickets Section */}
        <View style={styles.ticketsHeader}>
          <Text style={[styles.sectionHeader, { color: colors.text }]}>Recent Tickets</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TicketsList')}>
            <Text style={[styles.viewAllText, { color: sectorPrimary }]}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {tickets.length === 0 ? (
          <View style={[styles.ticketCard, {alignItems:'center', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={{flex:1}}>
              <Text style={[styles.ticketTitle, { color: colors.textSecondary }]}>No tickets yet</Text>
              <Text style={[styles.ticketMeta, { color: colors.textSecondary }]}>Raise a ticket to see it here</Text>
            </View>
          </View>
        ) : (
          tickets.slice(0, 3).map((t) => (
            <View key={t.id} style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={styles.ticketContent}>
                <Text style={[styles.ticketId, { color: colors.textSecondary }]}>{t.id}</Text>
                <Text style={[styles.ticketTitle, { color: colors.text }]}>{t.title}</Text>
                <Text style={[styles.ticketMeta, { color: colors.textSecondary }]}>Last updated: {new Date(t.updatedAt).toLocaleString()}</Text>
              </View>
              <View style={[styles.badgeBlue, { backgroundColor: colors.surface }]}>
                <Text style={[styles.badgeBlueText, { color: colors.primary }]}>{t.status}</Text>
              </View>
            </View>
          ))
        )}

        {/* Raise Ticket CTA */}
        <TouchableOpacity style={[styles.raiseTicketBtn, { backgroundColor: sectorPrimary }]} onPress={() => navigation.navigate('RaiseTicket')} activeOpacity={0.85}>
          <Text style={[styles.raiseTicketText, { color: '#ffffff' }]}>Raise a Ticket</Text>
        </TouchableOpacity>

        {/* Bottom Support Actions */}
        <TouchableOpacity style={[styles.chatSupportBtn, { backgroundColor: sectorPrimary }]} activeOpacity={0.85}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <Ionicons name="chatbubble-ellipses" size={moderateScale(18)} color="#ffffff" />
            <Text style={[styles.chatSupportText, { color: '#ffffff' }]}>  Chat with Support</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.callSupportBtn, { borderColor: colors.border }]} activeOpacity={0.85}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <Ionicons name="call" size={moderateScale(18)} color="#ff3b30" />
            <Text style={[styles.callSupportText, { color: colors.text }]}>  Call Support Helpline</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
      <BottomTab active={'Support'} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0A0F4A'
  },
  customHeader: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 35,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    marginBottom: -15,
  },
  headerTopRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  headerLeftContent: { paddingTop: 0 },
  headerRightContent: { alignItems:'flex-end', paddingTop: 0 },
  scrollContent: { 
    paddingBottom: moderateScale(120),
    paddingTop: moderateScale(10),
    padding: 20
  },
  brandName: { color: '#ffffff', fontSize: moderateScale(24), fontWeight: '800' },
  topRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: moderateScale(16) 
  },
  topRightSection: { 
    flexDirection: 'column', 
    alignItems: 'flex-end', 
    marginRight: moderateScale(12) 
  },
  topRowIcons: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: moderateScale(8) 
  },
  bellWrap: { 
    width: moderateScale(32), 
    height: moderateScale(32), 
    borderRadius: moderateScale(16), 
    backgroundColor:'#13235d', 
    alignItems:'center', 
    justifyContent:'center', 
    marginRight: moderateScale(12), 
    position:'relative' 
  },
  badge: { 
    position:'absolute', 
    top:-6, 
    right:-6, 
    backgroundColor:'#ff3b30', 
    borderRadius: 8, 
    paddingHorizontal:5, 
    paddingVertical:1 
  },
  badgeText: { 
    color:'#ffffff', 
    fontSize:10, 
    fontWeight:'700' 
  },
  avatarDot: { 
    width: moderateScale(32), 
    height: moderateScale(32), 
    borderRadius: moderateScale(16), 
    backgroundColor: '#e6e8ff' 
  },
  supportHeading: { 
    color:'#ffffff', 
    fontWeight:'700', 
    marginTop: moderateScale(8), 
    marginBottom: moderateScale(16), 
    fontSize: moderateScale(16) 
  },
  grid: { 
    flexDirection:'row', 
    flexWrap:'wrap', 
    justifyContent:'space-between',
    marginBottom: moderateScale(24)
  },
  tile: { 
    backgroundColor:'#ffffff', 
    width:'48%', 
    borderRadius: moderateScale(16), 
    padding: moderateScale(16), 
    marginBottom: moderateScale(12),
    alignItems: 'center',
    textAlign: 'center'
  },
  cardShadow: { shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, shadowOffset:{ width:0, height:4 }, elevation:2 },
  tileIcon: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: '#e6e8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: moderateScale(12)
  },
  tileTitle: { 
    color:'#111827', 
    fontWeight:'700',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: moderateScale(4)
  },
  tileSub: { 
    color:'#6B7280', 
    fontSize: moderateScale(12),
    textAlign: 'center'
  },
  ticketsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: moderateScale(8),
    marginBottom: moderateScale(16)
  },
  sectionHeader: { 
    color:'#ffffff', 
    fontWeight:'700',
    fontSize: moderateScale(16)
  },
  viewAllText: {
    color: '#3B5BFD',
    fontWeight: '600',
    fontSize: moderateScale(14)
  },
  ticketCard: { 
    backgroundColor:'#ffffff', 
    borderRadius: moderateScale(16), 
    padding: moderateScale(16), 
    marginTop: moderateScale(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  ticketContent: {
    flex: 1
  },
  ticketId: { 
    color:'#8fa6ff', 
    fontSize: moderateScale(12),
    fontWeight: '600'
  },
  ticketTitle: { 
    color:'#111827', 
    fontWeight:'700', 
    marginTop: moderateScale(6),
    fontSize: 16
  },
  ticketMeta: { 
    color:'#6B7280', 
    marginTop: moderateScale(4),
    fontSize: moderateScale(12)
  },
  badgeYellow: { 
    backgroundColor:'#FEF3C7', 
    paddingHorizontal: moderateScale(12), 
    paddingVertical: moderateScale(6), 
    borderRadius: moderateScale(16)
  },
  badgeYellowText: { 
    color:'#92400E', 
    fontWeight:'600',
    fontSize: moderateScale(12)
  },
  badgeGreen: { 
    backgroundColor:'#D1FAE5', 
    paddingHorizontal: moderateScale(12), 
    paddingVertical: moderateScale(6), 
    borderRadius: moderateScale(16)
  },
  badgeGreenText: { 
    color:'#065F46', 
    fontWeight:'600',
    fontSize: moderateScale(12)
  },
  badgeBlue: { 
    backgroundColor:'#DBEAFE', 
    paddingHorizontal: moderateScale(12), 
    paddingVertical: moderateScale(6), 
    borderRadius: moderateScale(16)
  },
  badgeBlueText: { 
    color:'#1E40AF', 
    fontWeight:'600',
    fontSize: moderateScale(12)
  },
  raiseTicketBtn: {
    marginTop: moderateScale(20),
    backgroundColor: '#3B5BFD',
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(16),
    alignItems: 'center'
  },
  raiseTicketText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: moderateScale(16)
  },
  chatSupportBtn: {
    marginTop: moderateScale(12),
    backgroundColor: '#3B5BFD',
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    alignItems: 'center'
  },
  chatSupportText: {
    color: '#ffffff',
    fontWeight: '700'
  },
  callSupportBtn: {
    marginTop: moderateScale(10),
    backgroundColor: 'transparent',
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)'
  },
  callSupportText: {
    color: '#ff3b30',
    fontWeight: '700'
  }
});

export default SupportScreen;
