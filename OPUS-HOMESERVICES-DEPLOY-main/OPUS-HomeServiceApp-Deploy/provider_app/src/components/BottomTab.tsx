import React, { useEffect, useMemo, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { moderateScale } from '../utils/responsive';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useVerification } from '../hooks/useVerification';

interface BottomTabProps { active: string; floating?: boolean }

interface TabItemProps {
  name: string;
  index: number;
  isActive: boolean;
  onPress: () => void;
  activeIndex: SharedValue<number>;
}

const TabItem: React.FC<TabItemProps> = memo(({ name, index, isActive, onPress, activeIndex }) => {
  // Keep hook for potential subtle effects, but no transform to avoid popping
  const animatedStyle = useAnimatedStyle(() => {
    activeIndex.value; // dependency to re-render when active changes
    return {} as any;
  });

  const { colors } = useTheme();
  const currentSector = (require('../utils/appState').getSelectedSector?.() as 'home' | 'healthcare' | 'appliance' | 'automobile') || 'home';
  
  // Explicitly force blue for Earnings (Wallet) and Support tabs, regardless of sector
  // Only Home and Bookings can use green for healthcare sector
  const isWalletOrSupport = name === 'Earnings' || name === 'Support';
  const useGreenColor = !isWalletOrSupport && currentSector === 'healthcare' && (name === 'Home' || name === 'Bookings');
  const activeColor = useGreenColor ? '#0AA484' : colors.primary;
  const inactiveColor = colors.textSecondary;
  const backgroundColor = useGreenColor ? '#C6F3E9' : '#EEF2FF';
  const textColor = useGreenColor ? '#0AA484' : colors.primary;

  return (
    <TouchableOpacity key={name} style={styles.tabItem} activeOpacity={0.85} onPress={onPress}>
      <Animated.View style={[styles.iconWrapper, isActive && { backgroundColor }, animatedStyle]}>
        {name === 'Home' ? (
          <Ionicons name={isActive ? 'home' : 'home-outline'} size={20} color={isActive ? activeColor : inactiveColor} />
        ) : name === 'Bookings' ? (
          <MaterialCommunityIcons name="calendar-blank" size={20} color={isActive ? activeColor : inactiveColor} />
        ) : name === 'Earnings' ? (
          <Ionicons name={isActive ? 'wallet' : 'wallet-outline'} size={20} color={isActive ? activeColor : inactiveColor} />
        ) : (
          <Ionicons name="headset-outline" size={20} color={isActive ? activeColor : inactiveColor} />
        )}
      </Animated.View>
      <Text style={[styles.tabLabel, { color: isActive ? textColor : colors.textSecondary }]}>
        {name === 'Earnings' ? 'Wallet' : name}
      </Text>
    </TouchableOpacity>
  );
});

const BottomTab: React.FC<BottomTabProps> = ({ active, floating = true }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { verification } = useVerification();
  const routes = useMemo(() => ['Home', 'Bookings', 'Earnings', 'Support'], []);
  const activeIndexProp = Math.max(0, routes.indexOf(active || 'Home'));
  const activeIndex = useSharedValue(activeIndexProp);
  const LIFT_AMOUNT = 0; // disabled lift to avoid icon popping

  // Determine if user is a doctor consultation user
  const isDoctorUser = useMemo(() => {
    // List of all doctor-related screens
    const doctorScreens = ['DoctorDashboard', 'Bookings', 'MyPatients', 'Earnings', 'Support', 'Profile', 'Notifications'];
    
    // Check current route first (most reliable)
    if (doctorScreens.includes(route.name || '')) {
      // If on any doctor screen, check verification to confirm
      const isDoctor = verification?.selected_sector === 'Doctor Consultation';
      if (isDoctor) {
        console.log(`BottomTab: User is on doctor screen (${route.name}), isDoctorUser = true`);
        return true;
      }
    }
    
    // Check verification data
    const isDoctor = verification?.selected_sector === 'Doctor Consultation';
    if (isDoctor) {
      console.log('BottomTab: Verification shows Doctor Consultation, isDoctorUser = true');
    } else {
      console.log('BottomTab: Verification sector:', verification?.selected_sector, 'isDoctorUser = false');
    }
    return isDoctor;
  }, [route.name, verification?.selected_sector]);

  const onPress = useCallback((name: string, routeName: string, index: number) => {
    if (active === name) return; // avoid redundant navigations causing flicker
    activeIndex.value = index;
    
    // CRITICAL: ONLY check verification data to determine if user is doctor
    // DO NOT check route name - shared screens (Earnings, Support) are used by all services
    const isDoctorUser = verification?.selected_sector === 'Doctor Consultation';
    
    // For doctor consultation users, redirect routes appropriately
    let targetRoute = routeName;
    
    if (name === 'Home') {
      // Always check verification when Home is pressed - ONLY use verification data
      if (isDoctorUser) {
        targetRoute = 'DoctorDashboard';
        console.log('BottomTab: Home pressed, routing to DoctorDashboard for doctor user');
      } else {
        // For non-doctor users, route to appropriate dashboard based on their service
        const savedSector = verification?.selected_sector;
        if (savedSector === 'Acting Drivers') {
          targetRoute = 'ActingDriversDashboard';
          console.log('BottomTab: Home pressed, routing to ActingDriversDashboard for acting driver');
        } else if (savedSector === 'Medicine Delivery') {
          targetRoute = 'PharmDashboard';
        } else {
          targetRoute = 'Dashboard';
        }
        console.log(`BottomTab: Home pressed, routing to ${targetRoute} for ${savedSector || 'default'} service user`);
      }
    } else if (name === 'Bookings' && isDoctorUser) {
      // For doctors, Bookings should route to BookingsScreen
      targetRoute = 'Bookings';
      console.log('BottomTab: Bookings pressed, routing to Bookings for doctor user');
    }
    
    console.log('BottomTab: Navigating to', targetRoute);
    // @ts-ignore
    navigation.navigate(targetRoute as never);
  }, [active, navigation, activeIndex, route.name, verification?.selected_sector]);

  // keep shared index in sync with prop (no indicator animation)
  useEffect(() => {
    activeIndex.value = activeIndexProp;
  }, [activeIndexProp, activeIndex]);

  return (
    <View style={floating ? styles.floatingWrap : styles.inlineWrap} pointerEvents={floating ? 'box-none' as any : 'auto'}>
      <View style={floating ? styles.shadowWrap : styles.inlineShadowWrap}>
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: Platform.select({ ios: moderateScale(16) + insets.bottom, android: moderateScale(14) + insets.bottom }) }] }>
          {routes.map((name, index) => {
            const isActive = active === name;
            // Default route for Home button
            let routeName = name === 'Home' ? 'Dashboard' : name;
            // For doctor consultation users, adjust routes appropriately
            // CRITICAL: ONLY check verification data - DO NOT check route name
            const isDoctorUser = verification?.selected_sector === 'Doctor Consultation';
            
            if (name === 'Home' && isDoctorUser) {
              routeName = 'DoctorDashboard';
            } else if (name === 'Home' && verification?.selected_sector === 'Acting Drivers') {
              routeName = 'ActingDriversDashboard';
            } else if (name === 'Home' && verification?.selected_sector === 'Medicine Delivery') {
              routeName = 'PharmDashboard';
            } else if (name === 'Bookings' && isDoctorUser) {
              routeName = 'Bookings';
            }
            return (
              <TabItem
                key={name}
                name={name}
                index={index}
                isActive={isActive}
                onPress={() => onPress(name, routeName, index)}
                activeIndex={activeIndex}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', pointerEvents:'box-none', zIndex: 1000, elevation: 8 },
  inlineWrap: { marginTop: moderateScale(16), marginBottom: moderateScale(24), paddingHorizontal: moderateScale(0) },
  shadowWrap: { marginHorizontal: 0, marginBottom: 0, borderRadius: 0, shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0, backgroundColor: 'transparent' },
  inlineShadowWrap: { marginHorizontal: 0, borderRadius: 0, shadowColor: 'transparent', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0, backgroundColor: 'transparent' },
  container: { backgroundColor: '#FFFFFF', paddingTop: moderateScale(8), paddingHorizontal: moderateScale(24), flexDirection: 'row', justifyContent: 'space-between', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderRadius: 0, borderTopWidth: 1, borderColor: '#E5E7EB' },
  tabItem: { alignItems: 'center', justifyContent: 'flex-start', width: '25%', paddingTop: moderateScale(2) },
  iconWrapper: { backgroundColor: 'transparent', padding: moderateScale(8), borderRadius: moderateScale(40) },
  iconWrapperActive: { backgroundColor: '#EEF2FF' },
  tabLabel: { color: '#6B7280', fontSize: moderateScale(12), marginTop: moderateScale(4) },
  tabLabelActive: { color: '#2563EB', fontWeight: '700', opacity: 1 },
  tabLabelInactive: { color: '#6B7280', opacity: 0.8 },
});

export default BottomTab;
