import React, { useEffect, useRef, useState } from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { Animated, Easing, Platform } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { useVerification } from '../hooks/useVerification';
import { getSelectedSector } from '../utils/appState';
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ServiceSectorSelectionScreen from '../screens/ServiceSectorSelectionScreen';
import KYCVerificationScreen from '../screens/KYCVerificationScreen';
import DoctorSpecializationScreen from '../screens/DoctorSpecializationScreen';
import DoctorVerificationScreen from '../screens/DoctorVerificationScreen';
import DoctorBioScreen from '../screens/DoctorBioScreen';
import DashboardScreen from '../screens/DashboardScreen';
import DoctorDashboardScreen from '../screens/doc_dashboard';
import PharmDashboardScreen from '../screens/pharm_DashboardScreen';
import ActingDriversDashboardScreen from '../screens/ActingDriversDashboardScreen';
import ActingDriverServicesScreen from '../screens/ActingDriverServicesScreen';
import ActingDriverFareScreen from '../screens/ActingDriverFareScreen';
import ActingDriverPersonalDetailsScreen from '../screens/ActingDriverPersonalDetailsScreen';
import ActingDriverBookingDetailsScreen from '../screens/ActingDriverBookingDetailsScreen';
import PharmOrderDetails from '../screens/PharmOrderDetails';
import ProfileScreen from '../screens/ProfileScreen';
import BookingsScreen from '../screens/BookingsScreen';
import MyPatientsScreen from '../screens/MyPatientsScreen';
import DoctorReviewsScreen from '../screens/DoctorReviewsScreen';
import ProviderReviewsScreen from '../screens/ProviderReviewsScreen';
import DoctorWeeklyPerformanceScreen from '../screens/DoctorWeeklyPerformanceScreen';
import ProviderWeeklyPerformanceScreen from '../screens/ProviderWeeklyPerformanceScreen';
import EarningsScreen from '../screens/EarningsScreen';
import SupportScreen from '../screens/SupportScreen';
import GeminiChatSupportScreen from '../screens/GeminiChatSupportScreen';
import TechnicalHelpScreen from '../screens/TechnicalHelpScreen';
import JobIssuesScreen from '../screens/JobIssuesScreen';
import PaymentIssuesScreen from '../screens/PaymentIssuesScreen';
import AvailablePartnersScreen from '../screens/AvailablePartnersScreen';
import RaiseTicketScreen from '../screens/RaiseTicketScreen';
import AddNewServiceScreen from '../screens/AddNewServiceScreen';
import YourServicesScreen from '../screens/YourServicesScreen';
import YourEmployeesScreen from '../screens/YourEmployeesScreen';
import ServiceSubmittedScreen from '../screens/ServiceSubmittedScreen';
import CompanyInfoScreen from '../screens/CompanyInfoScreen';
import BankDetailsScreen from '../screens/BankDetailsScreen';
import SecurityScreen from '../screens/SecurityScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EmployeeDetailsScreen from '../screens/EmployeeDetailsScreen';
import EmployeeProfileScreen from '../screens/EmployeeProfileScreen';
import WeeklyChartScreen from '../screens/WeeklyChartScreen';
import CompanyLocationsScreen from '../screens/CompanyLocationsScreen';
import HospitalLocationScreen from '../screens/HospitalLocationScreen';
// Import type only to satisfy TS (wrapper will require at runtime)
import PartnerAssignedScreen from '../screens/PartnerAssignedScreen';
import TrackPartnerScreen from '../screens/TrackPartnerScreen';
import KYCDetailsScreen from '../screens/KYCDetailsScreen';
import ContactTeamScreen from '../screens/ContactTeamScreen';
import TicketsListScreen from '../screens/TicketsListScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import VerifyPhoneScreen from '../screens/VerifyPhoneScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import VerifyOTPScreen from '../screens/VerifyOTPScreen';
import WalletWithdrawScreen from '../screens/WalletWithdrawScreen';
import TasksCompletedTodayScreen from '../screens/TasksCompletedTodayScreen';
import AvailabilityScreen from '../screens/AvailabilityScreen';
import CustomerFeedbacksScreen from '../screens/CustomerFeedbacksScreen';
import ActiveJobDetailsScreen from '../screens/ActiveJobDetailsScreen';
import DoctorAppointmentDetailsScreen from '../screens/DoctorAppointmentDetailsScreen';
import PatientDetailsScreen from '../screens/PatientDetailsScreen';
import CompletedAppointmentsScreen from '../screens/CompletedAppointmentsScreen';

const Stack = createStackNavigator<RootStackParamList>();
const ENABLE_TRACK_PARTNER = false;

// Defensive wrappers to ensure a valid component is always passed
const EmployeeDetailsWrapper: React.FC = (props) => {
  const mod = require('../screens/EmployeeDetailsScreen');
  const Comp = mod.default || mod;
  const C: any = Comp;
  return <C {...props} />;
};

const AddNewEmployeeWrapper: React.FC = (props) => {
  const mod = require('../screens/AddNewEmployeeScreen');
  const Comp = mod.default || mod;
  const C: any = Comp;
  return <C {...props} />;
};

// Navigation controller component to handle auth state changes.
// Uses navigationRef (from NavigationContainer) so it never calls useNavigation() before the navigator is mounted.
export const NavigationController: React.FC<{
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
  isNavReady: boolean;
}> = ({ navigationRef, isNavReady }) => {
  const { user } = useAuth();
  const { isVerified, loading: verificationLoading, refreshVerification, verification } = useVerification();
  const previousUserRef = useRef(user);

  // Track navigation state to maintain doctor session
  const navigationState = useNavigationState(state => state);
  
  // CRITICAL: Monitor navigation state to maintain doctor session
  useEffect(() => {
    if (!navigationState) return;
    
    const currentRoute = navigationState.routes[navigationState.index]?.name;
    const isDoctorUser = verification?.selected_sector === 'Doctor Consultation';
    
    // CRITICAL: Define doctor screens - any screen a doctor uses
    const doctorScreens = [
      'DoctorDashboard', 
      'MyPatients', 
      'DoctorReviews',
      'DoctorWeeklyPerformance',
      'CompletedAppointments',
      'DoctorSpecialization', 
      'DoctorVerification',
      'DoctorBio',
      'Profile', 
      'Earnings', 
      'Support', 
      'Notifications', 
      'Bookings'
    ];
    
    const isOnDoctorScreen = doctorScreens.includes(currentRoute || '');
    
    // CRITICAL: Set doctor session if user IS a doctor and on any doctor screen
    // Once set, NEVER clear it unless user logs out
    if (isDoctorUser && isOnDoctorScreen) {
      if (!isInDoctorSessionRef.current) {
        isInDoctorSessionRef.current = true;
        console.log(`✅ Doctor session STARTED: User is on ${currentRoute}`);
      }
    }
    
    // CRITICAL: Only clear doctor session if user is NOT a doctor
    if (!isDoctorUser && isInDoctorSessionRef.current) {
      isInDoctorSessionRef.current = false;
      console.log(`❌ Doctor session CLEARED: User is not a doctor (sector: ${verification?.selected_sector})`);
    }
  }, [navigationState, verification?.selected_sector]);

  // Track if we've already navigated to avoid duplicate navigations
  const hasNavigatedRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const hasCheckedInitialRouteRef = useRef(false);
  // Track if we're currently on a doctor screen to prevent unwanted resets
  const isOnDoctorScreenRef = useRef(false);
  // CRITICAL: Track if user is in a doctor session - once set, NEVER reset to generic Dashboard
  const isInDoctorSessionRef = useRef(false);

  // Handle initial mount and app reload
  useEffect(() => {
    if (!isNavReady || !navigationRef.current?.isReady()) return;

    const nav = navigationRef.current;
    const isInitialMount = isInitialMountRef.current;

    // On initial mount (app reload), check if user exists and route accordingly
    if (isInitialMount && user && !hasCheckedInitialRouteRef.current) {
      console.log('App initial mount/reload, user exists, checking verification...');

      // Wait for verification to load
      if (verificationLoading) {
        console.log('Verification still loading on initial mount, will check again when loaded...');
        return;
      }

      hasCheckedInitialRouteRef.current = true;
      isInitialMountRef.current = false;

      // Get current route to prevent unwanted navigation resets
      const state = nav.getState();
      const currentRoute = (state?.routes?.[state?.index ?? 0] as { name?: string })?.name;
      
      // List of doctor-specific screens and shared screens that doctors use
      // These should prevent navigation reset when user is a doctor
      const doctorScreens = [
        'DoctorDashboard', 
        'MyPatients', 
        'DoctorSpecialization', 
        'DoctorVerification',
        // Shared screens that doctors navigate to from dashboard
        'Earnings',
        'Support',
        'Profile',
        'Notifications',
        'Bookings',
      ];
      const isOnDoctorScreen = doctorScreens.includes(currentRoute || '');
      const isDoctorUser = verification?.selected_sector === 'Doctor Consultation';
      
      // CRITICAL: If user is in a doctor session, NEVER reset navigation
      if (isInDoctorSessionRef.current && isDoctorUser) {
        console.log(`Initial mount: User in doctor session, COMPLETELY BLOCKING navigation reset to maintain isolation`);
        hasNavigatedRef.current = true;
        return;
      }
      
      // If already on any doctor screen and user is a doctor, mark as in doctor session and don't reset
      if (isOnDoctorScreen && isDoctorUser) {
        isInDoctorSessionRef.current = true;
        console.log(`Already on doctor screen (${currentRoute}), marking doctor session and skipping navigation reset`);
        hasNavigatedRef.current = true;
        return;
      }
      
      // Determine target route based on verification status and sector
      let targetRoute = 'ServiceSectorSelection';
      if (isVerified) {
        const savedSector = verification?.selected_sector;
        if (savedSector === 'Medicine Delivery') {
          targetRoute = 'PharmDashboard';
        } else if (savedSector === 'Doctor Consultation') {
          targetRoute = 'DoctorDashboard';
          // Mark as entering doctor session
          isInDoctorSessionRef.current = true;
        } else if (savedSector === 'Acting Drivers') {
          // If fare is not set yet, send to fare screen first
          const hasFare = (verification as any)?.fare_per_hour != null;
          targetRoute = hasFare ? 'ActingDriversDashboard' : 'ActingDriverFare';
        } else {
          // For all other services (home, appliance, automobile), route to generic Dashboard
          // CRITICAL: Only maintain doctor session if user is ACTUALLY a doctor
          if (isInDoctorSessionRef.current && !isDoctorUser) {
            // Clear doctor session if user is not actually a doctor
            isInDoctorSessionRef.current = false;
            isOnDoctorScreenRef.current = false;
            console.log(`Initial mount: Clearing doctor session - user is not a doctor`);
          }
          targetRoute = 'Dashboard';
        }
      }
      
      console.log(`Initial mount: isVerified=${isVerified}, sector=${verification?.selected_sector}, targetRoute=${targetRoute}`);
      
      // CRITICAL: Only mark as entering doctor session if user is ACTUALLY a doctor
      if (targetRoute === 'DoctorDashboard' && isDoctorUser) {
        isInDoctorSessionRef.current = true;
      } else if (targetRoute !== 'DoctorDashboard' && isInDoctorSessionRef.current && !isDoctorUser) {
        // Clear doctor session if routing to non-doctor dashboard and user is not a doctor
        isInDoctorSessionRef.current = false;
        isOnDoctorScreenRef.current = false;
        console.log(`Initial mount: Clearing doctor session - routing to ${targetRoute} for non-doctor user`);
      }
      
      // Only navigate if we're not already on the correct route
      if (currentRoute !== targetRoute) {
        console.log(`App reloaded, current route: ${currentRoute}, target route: ${targetRoute}, navigating...`);
        hasNavigatedRef.current = true;

        setTimeout(() => {
          try {
            if (!navigationRef.current?.isReady()) return;
            const finalTargetRoute = (isInDoctorSessionRef.current && targetRoute === 'Dashboard' && verification?.selected_sector === 'Doctor Consultation')
              ? 'DoctorDashboard'
              : targetRoute;
            console.log(`Initial mount: Resetting navigation to ${finalTargetRoute} (original: ${targetRoute})`);
            navigationRef.current.reset({
              index: 0,
              routes: [{ name: finalTargetRoute as never }],
            });
          } catch (error) {
            console.error('Navigation error:', error);
          }
        }, 500);
      } else {
        hasNavigatedRef.current = true; // Already on correct route
      }
    }
  }, [user, isVerified, verificationLoading, verification?.selected_sector, isNavReady]);

  useEffect(() => {
    if (!isNavReady || !navigationRef.current?.isReady()) return;

    const nav = navigationRef.current;
    const previousUser = previousUserRef.current;

    const state = nav.getState();
    const currentRoute = (state?.routes?.[state?.index ?? 0] as { name?: string })?.name;
    
    const isDoctorUser = verification?.selected_sector === 'Doctor Consultation';
    
    // CRITICAL: If user is a doctor and in a doctor session, BLOCK ALL navigation resets
    if (isDoctorUser && isInDoctorSessionRef.current) {
      previousUserRef.current = user;
      console.log(`🔒 LOCKED: User in doctor session (route: ${currentRoute}), blocking navigation reset`);
      return;
    }
    
    // CRITICAL: Only clear doctor session if user is NOT a doctor
    if (!isDoctorUser && isInDoctorSessionRef.current) {
      isInDoctorSessionRef.current = false;
      console.log(`❌ Clearing doctor session - user is not a doctor (sector: ${verification?.selected_sector})`);
    }
    
    // User just became authenticated (was null, now has user)
    if (!previousUser && user) {
      hasNavigatedRef.current = false;
      console.log('User authenticated, checking verification status...');
      
      // Wait for verification to load if it's still loading
      if (verificationLoading) {
        console.log('Verification still loading, waiting...');
        return;
      }
      
      // Refresh verification status to ensure we have the latest data
      refreshVerification().then(async (freshData) => {
        // Wait a bit for navigation to be ready
        await new Promise(resolve => setTimeout(resolve, 300));

        if (hasNavigatedRef.current) return; // Already navigated
        if (!navigationRef.current?.isReady()) return;

        const nav = navigationRef.current;
        const state = nav.getState();
        const currentRoute = (state?.routes?.[state?.index ?? 0] as { name?: string })?.name;

        const doctorScreens = [
          'DoctorDashboard',
          'MyPatients',
          'DoctorSpecialization',
          'DoctorVerification',
          'Earnings',
          'Support',
          'Profile',
          'Notifications',
          'Bookings',
        ];
        const isOnDoctorScreen = doctorScreens.includes(currentRoute || '');

        // Use fresh data returned from refreshVerification to avoid stale closure values
        const freshIsVerified = freshData?.isVerified ?? isVerified;
        const freshVerification = freshData?.verification ?? verification;
        const isDoctorUser = freshVerification?.selected_sector === 'Doctor Consultation';

        if (isInDoctorSessionRef.current && isDoctorUser) {
          hasNavigatedRef.current = true;
          return;
        }
        if (isOnDoctorScreen && isDoctorUser) {
          isInDoctorSessionRef.current = true;
          hasNavigatedRef.current = true;
          return;
        }

        let targetRoute = 'ServiceSectorSelection';
        if (freshIsVerified) {
          const savedSector = freshVerification?.selected_sector;
          if (savedSector === 'Medicine Delivery') {
            targetRoute = 'PharmDashboard';
          } else if (savedSector === 'Doctor Consultation') {
            targetRoute = 'DoctorDashboard';
            isInDoctorSessionRef.current = true;
          } else if (savedSector === 'Acting Drivers') {
            const hasFare = (freshVerification as any)?.fare_per_hour != null;
            targetRoute = hasFare ? 'ActingDriversDashboard' : 'ActingDriverFare';
          } else {
            if (isInDoctorSessionRef.current && !isDoctorUser) {
              isInDoctorSessionRef.current = false;
              isOnDoctorScreenRef.current = false;
            }
            targetRoute = 'Dashboard';
          }
        }
        if (targetRoute === 'DoctorDashboard' && isDoctorUser) {
          isInDoctorSessionRef.current = true;
        } else if (targetRoute !== 'DoctorDashboard' && isInDoctorSessionRef.current && !isDoctorUser) {
          isInDoctorSessionRef.current = false;
          isOnDoctorScreenRef.current = false;
        }

        if (currentRoute !== targetRoute) {
          hasNavigatedRef.current = true;
          
          // Additional delay to ensure navigation is fully ready
          setTimeout(() => {
            try {
              // CRITICAL: Final check before reset - if in doctor session, NEVER reset to Dashboard
              const finalTargetRoute = (isInDoctorSessionRef.current && targetRoute === 'Dashboard' && freshVerification?.selected_sector === 'Doctor Consultation')
                ? 'DoctorDashboard'
                : targetRoute;

              if (navigationRef.current?.isReady()) {
                console.log(`User authenticated: Resetting navigation to ${finalTargetRoute} (original: ${targetRoute})`);
                navigationRef.current.reset({
                  index: 0,
                  routes: [{ name: finalTargetRoute as never }],
                });
              }
            } catch (error) {
              console.error('Navigation error:', error);
              // Don't retry to avoid infinite loops
            }
          }, 500);
        } else {
          hasNavigatedRef.current = true; // Already on correct route
        }
      });
    }
    
    // User just logged out (was user, now null)
    if (previousUser && !user) {
      hasNavigatedRef.current = false;
      isInitialMountRef.current = true; // Reset for next session
      hasCheckedInitialRouteRef.current = false; // Reset initial route check
      isInDoctorSessionRef.current = false; // Reset doctor session on logout
      isOnDoctorScreenRef.current = false; // Reset doctor screen tracking
      console.log('User logged out, navigating to Login...');
      setTimeout(() => {
        try {
          if (navigationRef.current?.isReady()) {
            navigationRef.current.reset({
              index: 0,
              routes: [{ name: 'Login' as never }],
            });
          }
        } catch (error) {
          console.error('Navigation error on logout:', error);
        }
      }, 500);
    }

    previousUserRef.current = user;
  }, [user, isVerified, verificationLoading, verification?.selected_sector, isNavReady, refreshVerification]);

  return null;
};

const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();
  const { isVerified, loading: verificationLoading, verification } = useVerification();

  if (loading || (user && verificationLoading)) {
    return null; // Will be handled by the loading screen in App.tsx
  }

  // Determine initial route based on user and verification status
  const getInitialRoute = () => {
    if (!user) return "Login";
    // If verification is still loading, default to ServiceSectorSelection
    // NavigationController will handle routing once verification loads
    if (verificationLoading) return "ServiceSectorSelection";
    if (!isVerified) return "ServiceSectorSelection";
    // Check saved sector to route to appropriate dashboard
    const savedSector = verification?.selected_sector;
    if (savedSector === 'Medicine Delivery') {
      return "PharmDashboard";
    } else if (savedSector === 'Doctor Consultation') {
      return "DoctorDashboard";
    } else if (savedSector === 'Acting Drivers') {
      const hasFare = (verification as any)?.fare_per_hour != null;
      return hasFare ? "ActingDriversDashboard" : "ActingDriverFare";
    }
    // All other verified users route to Dashboard
    return "Dashboard";
  };

  return (
    <Stack.Navigator
      key={user ? `authenticated-${user.id}` : 'unauthenticated'} // Force re-render when auth state changes
      screenOptions={{
        headerShown: false,
        detachPreviousScreen: true,
        animationEnabled: true,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        transitionSpec: {
          open: { animation: 'timing', config: { duration: 220, easing: Easing.out(Easing.cubic) } },
          close: { animation: 'timing', config: { duration: 200, easing: Easing.in(Easing.cubic) } },
        },
        // Subtle fade-through instead of strong slide
        cardStyleInterpolator: ({ current, next, layouts }) => {
          const opacity = current.progress;
          const nextOpacity = next ? next.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : 0;
          return {
            cardStyle: {
              opacity: next ? Animated.add(opacity, nextOpacity).interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) : opacity,
              transform: [
                {
                  translateX: opacity.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
                },
              ],
            },
          } as any;
        },
      }}
      initialRouteName={getInitialRoute()}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
      <Stack.Screen name="VerifyPhone" component={VerifyPhoneScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
      <Stack.Screen name="ServiceSectorSelection" component={ServiceSectorSelectionScreen} />
      <Stack.Screen name="KYCVerification" component={KYCVerificationScreen} />
      <Stack.Screen name="DoctorSpecialization" component={DoctorSpecializationScreen} />
      <Stack.Screen name="DoctorVerification" component={DoctorVerificationScreen} />
      <Stack.Screen name="DoctorBio" component={DoctorBioScreen} />
      <Stack.Screen name="KYCDetails" component={KYCDetailsScreen} />
      <Stack.Screen name="ContactTeam" component={ContactTeamScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="DoctorDashboard" component={DoctorDashboardScreen} />
      <Stack.Screen name="PharmDashboard" component={PharmDashboardScreen} />
      <Stack.Screen name="ActingDriversDashboard" component={ActingDriversDashboardScreen} />
      <Stack.Screen name="ActingDriverServices" component={ActingDriverServicesScreen} />
      <Stack.Screen name="ActingDriverFare" component={ActingDriverFareScreen} />
      <Stack.Screen name="ActingDriverPersonalDetails" component={ActingDriverPersonalDetailsScreen} />
      <Stack.Screen name="ActingDriverBookingDetails" component={ActingDriverBookingDetailsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Bookings" component={BookingsScreen} />
      <Stack.Screen name="MyPatients" component={MyPatientsScreen} />
      <Stack.Screen name="DoctorReviews" component={DoctorReviewsScreen} />
      <Stack.Screen name="ProviderReviews" component={ProviderReviewsScreen} />
      <Stack.Screen name="DoctorWeeklyPerformance" component={DoctorWeeklyPerformanceScreen} />
      <Stack.Screen name="ProviderWeeklyPerformance" component={ProviderWeeklyPerformanceScreen} />
      <Stack.Screen name="CompletedAppointments" component={CompletedAppointmentsScreen} />
      <Stack.Screen name="Earnings" component={EarningsScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="GeminiChatSupport" component={GeminiChatSupportScreen} />
      <Stack.Screen name="TechnicalHelp" component={TechnicalHelpScreen} />
      <Stack.Screen name="JobIssues" component={JobIssuesScreen} />
      <Stack.Screen name="PaymentIssues" component={PaymentIssuesScreen} />
      <Stack.Screen name="AvailablePartners" component={AvailablePartnersScreen} />
      <Stack.Screen name="PartnerAssigned" component={PartnerAssignedScreen} />
      {ENABLE_TRACK_PARTNER ? <Stack.Screen name="TrackPartner" component={TrackPartnerScreen} /> : null}
      <Stack.Screen name="RaiseTicket" component={RaiseTicketScreen} />
      <Stack.Screen name="TicketsList" component={TicketsListScreen} />
      <Stack.Screen name="AddNewService" component={AddNewServiceScreen} />
      {/* Removed product screens */}
      <Stack.Screen name="YourServices" component={YourServicesScreen} />
      <Stack.Screen name="YourEmployees" component={YourEmployeesScreen} />
      <Stack.Screen name="ServiceSubmitted" component={ServiceSubmittedScreen} />
      <Stack.Screen name="CompanyInfo" component={CompanyInfoScreen} />
      <Stack.Screen name="BankDetails" component={BankDetailsScreen} />
      <Stack.Screen name="Security" component={SecurityScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="EmployeeDetails" component={EmployeeDetailsWrapper} />
      <Stack.Screen name="EmployeeProfile" component={EmployeeProfileScreen} />
      <Stack.Screen name="WeeklyChart" component={WeeklyChartScreen} />
      <Stack.Screen name="AddNewEmployee" component={AddNewEmployeeWrapper} />
      <Stack.Screen name="CompanyLocations" component={CompanyLocationsScreen} />
      <Stack.Screen name="HospitalLocation" component={HospitalLocationScreen} />
      <Stack.Screen name="WalletWithdraw" component={WalletWithdrawScreen} />
      <Stack.Screen name="TasksCompletedToday" component={TasksCompletedTodayScreen} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} />
      <Stack.Screen name="CustomerFeedbacks" component={CustomerFeedbacksScreen} />
      <Stack.Screen name="ActiveJobDetails" component={ActiveJobDetailsScreen} />
      <Stack.Screen name="DoctorAppointmentDetails" component={DoctorAppointmentDetailsScreen} />
      <Stack.Screen name="PatientDetails" component={PatientDetailsScreen} />
      <Stack.Screen name="PharmOrderDetails" component={PharmOrderDetails} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
