import React, { useLayoutEffect, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Animated, Platform, BackHandler } from 'react-native';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { hapticButtonPress, hapticSuccess } from '../../utils/haptics';

export default function ListingSuccessScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    // Ensure back navigation routes to services page
    const onBackPress = () => {
      router.replace('/(tabs)');
      return true; // prevent default back behavior
    };
    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    // Intercept only explicit back/pop actions to avoid loops
    let unsub: any = null;
    unsub = navigation.addListener('beforeRemove', (e: any) => {
      const actionType = e?.data?.action?.type;
      if (actionType === 'GO_BACK' || actionType === 'POP') {
        e.preventDefault();
        // Detach listener before redirect to prevent recursive triggers
        if (unsub) unsub();
        router.replace('/(tabs)');
      }
    });

    return () => {
      backSub.remove();
      if (unsub) unsub();
    };
  }, [navigation, router]);

  useEffect(() => {
    // Trigger haptic success on mount
    hapticSuccess();

    // Animation sequence
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const { propertyTitle, propertyType, section } = params as any;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />

      {/* Background Gradient Circles */}
      <View style={styles.backgroundCircles}>
        <LinearGradient
          colors={[colors.secondary + '30', colors.secondary + '10']}
          style={[styles.circle, styles.circle1]}
        />
        <LinearGradient
          colors={[colors.secondary + '20', colors.secondary + '05']}
          style={[styles.circle, styles.circle2]}
        />
      </View>

      <View style={styles.headerSpacer} />
      
      <View style={styles.content}>
        {/* Animated Success Icon */}
        <Animated.View 
          style={[
            styles.iconContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={['#4ADE80', '#22C55E']}
            style={styles.iconGradient}
          >
            <View style={[styles.iconInner, { backgroundColor: colors.background }]}>
              <Ionicons name="checkmark-circle" size={80} color="#22C55E" />
            </View>
          </LinearGradient>
          
          {/* Animated ring */}
          <Animated.View 
            style={[
              styles.pulseRing,
              { 
                borderColor: colors.secondary + '40',
                transform: [{ scale: scaleAnim }],
              }
            ]} 
          />
        </Animated.View>

        {/* Animated Text Content */}
        <Animated.View
          style={[
            styles.textContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            Property Listed Successfully! 🎉
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {propertyTitle || 'Your property'} has been added to our listings.
          </Text>

          {/* Info Cards */}
          <View style={styles.infoCards}>
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.infoIconBg, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="home" size={24} color={colors.secondary} />
              </View>
              <View style={styles.infoCardText}>
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>Property Listed</Text>
                <Text style={[styles.infoCardSubtitle, { color: colors.textSecondary }]}>
                  Now visible to buyers
                </Text>
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.infoIconBg, { backgroundColor: '#3B82F6' + '20' }]}>
                <Ionicons name="eye" size={24} color="#3B82F6" />
              </View>
              <View style={styles.infoCardText}>
                <Text style={[styles.infoCardTitle, { color: colors.text }]}>Live Now</Text>
                <Text style={[styles.infoCardSubtitle, { color: colors.textSecondary }]}>
                  Your listing is active
                </Text>
              </View>
            </View>
          </View>

          {/* Property Details Card */}
          <View style={[styles.propertyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.propertyHeader}>
              <Ionicons name="home-outline" size={24} color={colors.secondary} />
              <Text style={[styles.propertyTitle, { color: colors.text }]}>
                {propertyTitle || 'Your Property'}
              </Text>
            </View>
            <View style={styles.propertyDetails}>
              <View style={styles.propertyDetailItem}>
                <Ionicons name="pricetag-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.propertyDetailText, { color: colors.textSecondary }]}>
                  {propertyType || 'Property Type'}
                </Text>
              </View>
              <View style={styles.propertyDetailItem}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.propertyDetailText, { color: colors.textSecondary }]}>
                  Listed just now
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Fixed Bottom Buttons */}
      <View style={[styles.bottomContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.primaryBtn}
          onPress={() => {
            hapticButtonPress();
            router.replace({ pathname: '/profile/my-listings', params: { fromSuccess: 'true' } });
          }}
        >
          <LinearGradient
            colors={[colors.secondary, colors.secondary + 'dd']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.primaryBtnText}>View My Listing</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={() => {
            hapticButtonPress();
            router.replace('/(tabs)');
          }}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1,
    overflow: 'hidden',
  },
  backgroundCircles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  circle: {
    position: 'absolute',
    borderRadius: 1000,
    marginTop: 10
  },
  circle1: {
    width: 300,
    height: 300,
    top: -100,
    right: -100,
  },
  circle2: {
    width: 400,
    height: 400,
    bottom: -150,
    left: -150,
  },
  headerSpacer: { 
    height: 150,
    
  },
  content: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingHorizontal: 24,
    paddingBottom: 180,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  iconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    top: -10,
    left: -10,
  },
  textContent: {
    width: '100%',
    alignItems: 'center',
  },
  title: { 
    fontSize: 28, 
    fontWeight: '800', 
    textAlign: 'center', 
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  subtitle: { 
    fontSize: 15, 
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 32,
    lineHeight: 22,
  },
  infoCards: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 24,
  },
  infoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  infoIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardText: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoCardSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  propertyCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  propertyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  propertyDetails: {
    gap: 12,
  },
  propertyDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  propertyDetailText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    gap: 12,
  },
  primaryBtn: { 
    height: 56, 
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
