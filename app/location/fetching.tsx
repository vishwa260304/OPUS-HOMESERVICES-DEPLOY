import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, Dimensions, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, withSequence, Easing, runOnJS } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

const { width, height } = Dimensions.get('window');
const LOCATION_DENIED_KEY = 'location_permission_denied';

export default function LocationFetchingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [statusText, setStatusText] = useState('Detecting your location');

  // Calculate particle positions once — Math.random() in render causes positions
  // to change on every re-render, making particles jump around the screen
  const particlePositions = useRef(
    [...Array(6)].map(() => ({
      left: Math.random() * width,
      top: Math.random() * height,
    }))
  ).current;

  // Pulse animation values
  const outerScale = useSharedValue(1);
  const middleScale = useSharedValue(1);
  const innerScale = useSharedValue(1);
  const iconBounce = useSharedValue(1);
  const iconBob = useSharedValue(0);
  const ringRotate = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0.8);
  const [dots, setDots] = useState('');

  // Transition animation values
  const iconTranslateX = useSharedValue(0);
  const iconTranslateY = useSharedValue(0);
  const iconScale = useSharedValue(1);
  const iconOpacity = useSharedValue(1);
  const iconDepthOpacity = useSharedValue(1);
  const iconRotation = useSharedValue(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const progressWidth = useSharedValue(0);
  const particleOpacity = useSharedValue(0);

  useEffect(() => {
    // Start pulse animations (staggered) - smoother timing
    outerScale.value = withDelay(0, withRepeat(withTiming(1.25, { duration: 2000, easing: Easing.inOut(Easing.cubic) }), -1, true));
    middleScale.value = withDelay(300, withRepeat(withTiming(1.2, { duration: 2000, easing: Easing.inOut(Easing.cubic) }), -1, true));
    innerScale.value = withDelay(600, withRepeat(withTiming(1.15, { duration: 2000, easing: Easing.inOut(Easing.cubic) }), -1, true));

    // Pin bounce and bobbing - smoother and more subtle
    iconBounce.value = withRepeat(withTiming(1.05, { duration: 1200, easing: Easing.inOut(Easing.cubic) }), -1, true);
    iconBob.value = withRepeat(withTiming(-4, { duration: 1500, easing: Easing.inOut(Easing.cubic) }), -1, true);

    // Rotating ring - slower and smoother
    ringRotate.value = withRepeat(withTiming(360, { duration: 4000, easing: Easing.linear }), -1, false);

    // Subtitle pulse - more subtle
    subtitleOpacity.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) }), -1, true);

    // Trailing dots - smoother timing
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    // Start progress animation - smoother curve
    progressWidth.value = withTiming(100, { duration: 4000, easing: Easing.out(Easing.cubic) });

    // Start particle animation
    particleOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      true
    );

    return () => clearInterval(interval);
  }, []);

  const outerStyle = useAnimatedStyle(() => ({ transform: [{ scale: outerScale.value }] }));
  const middleStyle = useAnimatedStyle(() => ({ transform: [{ scale: middleScale.value }] }));
  const innerStyle = useAnimatedStyle(() => ({ transform: [{ scale: innerScale.value }] }));
  const progressStyle = useAnimatedStyle(() => ({ width: `${progressWidth.value}%` }));
  const particleStyle = useAnimatedStyle(() => ({ opacity: particleOpacity.value }));
  // Animation function with magnetic pull effect
  const animateIconToDashboard = (onComplete: () => void) => {
    // Calculate target position (location icon in header)
    const targetX = 16 + 16 + 8; // left margin + icon size + text margin
    const targetY = 55 + 30; // status bar + half header height

    // Stop other animations smoothly
    outerScale.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    middleScale.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    innerScale.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    ringRotate.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    iconBob.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    iconBounce.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });

    // Step 1: Smooth magnetic pull effect
    iconScale.value = withSequence(
      withTiming(1.3, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withTiming(1.1, { duration: 200, easing: Easing.inOut(Easing.cubic) })
    );

    // Step 2: Curved path movement with elastic bounce
    setTimeout(() => {
      // Smooth curved movement
      iconTranslateX.value = withTiming(targetX, {
        duration: 1200,
        easing: Easing.out(Easing.cubic)
      });
      iconTranslateY.value = withTiming(targetY, {
        duration: 1400,
        easing: Easing.out(Easing.cubic)
      });

      // Smooth scale down
      iconScale.value = withTiming(0.35, {
        duration: 1200,
        easing: Easing.out(Easing.cubic)
      });

      // Smooth rotation
      iconRotation.value = withTiming(360, {
        duration: 1200,
        easing: Easing.out(Easing.cubic)
      });

      // Smooth opacity transition
      iconDepthOpacity.value = withSequence(
        withTiming(0.7, { duration: 400, easing: Easing.out(Easing.cubic) }),
        withTiming(0.9, { duration: 500, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.8, { duration: 600, easing: Easing.out(Easing.cubic) })
      );

      // Step 3: Smooth final settle
      setTimeout(() => {
        iconScale.value = withSequence(
          withTiming(0.4, { duration: 200, easing: Easing.out(Easing.cubic) }),
          withTiming(0.32, { duration: 250, easing: Easing.out(Easing.cubic) }),
          withTiming(0.35, { duration: 200, easing: Easing.out(Easing.cubic) })
        );

        // Step 4: Smooth fade out
        setTimeout(() => {
          iconScale.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
          iconOpacity.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }, () => {
            runOnJS(onComplete)();
          });
        }, 600);
      }, 1000);
    }, 400);
  };

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: isTransitioning ? iconScale.value : iconBounce.value * iconScale.value },
      { translateY: isTransitioning ? iconTranslateY.value : iconBob.value + iconTranslateY.value },
      { translateX: iconTranslateX.value },
      { rotate: isTransitioning ? `${iconRotation.value}deg` : '0deg' }
    ],
    opacity: isTransitioning ? iconOpacity.value * iconDepthOpacity.value : iconOpacity.value
  }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${ringRotate.value}deg` }] }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;

      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        await AsyncStorage.removeItem(LOCATION_DENIED_KEY);
      }
    });

    let cancelled = false;
    const fetchLocation = async () => {
      try {
        const prevDenied = await AsyncStorage.getItem(LOCATION_DENIED_KEY);
        if (prevDenied) {
          const permission = await Location.getForegroundPermissionsAsync();
          if (permission.status !== 'granted') {
            router.replace('/location/select');
            return;
          }
          await AsyncStorage.removeItem(LOCATION_DENIED_KEY);
        }

        setStatusText('Requesting permission');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setStatusText('Permission denied');
          await AsyncStorage.setItem(LOCATION_DENIED_KEY, 'true');
          // Navigate to main app after short delay
          setTimeout(() => {
            if (!cancelled) router.replace('/location/select');
          }, 300);
          return;
        }

        await AsyncStorage.removeItem(LOCATION_DENIED_KEY);

        setStatusText('Fetching GPS fix');
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest,
        });

        // Optionally: store coords in params/session if needed later
        setStatusText('Location found');

        // Start transition animation
        setIsTransitioning(true);
        animateIconToDashboard(() => {
          if (!cancelled) {
            router.replace('/(tabs)');
          }
        });
      } catch {
        setStatusText('Unable to fetch location');
        setTimeout(() => {
          if (!cancelled) router.replace('/(tabs)');
        }, 300);
      }
    };

    // Safety timeout to prevent hanging
    const safety = setTimeout(() => {
      if (!cancelled) {
        router.replace('/(tabs)');
      }
    }, 5000);

    fetchLocation();
    return () => {
      cancelled = true;
      subscription.remove();
      clearTimeout(safety);
    };
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Enhanced Background Gradient */}
      <LinearGradient
        colors={['#004c8f', '#0c1a5d', '#1a237e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      {/* Floating particles background */}
      <View style={styles.particlesContainer}>
        {particlePositions.map((pos, index) => (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              particleStyle,
              {
                left: pos.left,
                top: pos.top,
              }
            ]}
          />
        ))}
      </View>

      <View style={styles.centerWrap}>
        {!isTransitioning && (
          <>
            <Animated.View style={[styles.pulseCircleOuter, outerStyle]} />
            <Animated.View style={[styles.pulseCircleMiddle, middleStyle]} />
            <Animated.View style={[styles.pulseCircleInner, innerStyle]} />
            {/* Enhanced rotating ring */}
            <Animated.View style={[styles.rotatingRing, ringStyle]} />
            <Animated.View style={[styles.rotatingRing2, ringStyle]} />
          </>
        )}

        <Animated.View style={[styles.pinWrap, iconStyle]}>
          <LinearGradient
            colors={['#FFFFFF', '#E3F2FD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pinBg}
          >
            <LinearGradient
              colors={['#004c8f', '#0c1a5d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pinInner}
            >
              <Ionicons name="location" size={32} color="#FFFFFF" />
            </LinearGradient>
          </LinearGradient>
        </Animated.View>
      </View>

      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: '#FFFFFF' }]}>Finding your location</Text>
        <Animated.Text style={[styles.subtitle, { color: 'rgba(255,255,255,0.8)' }, subtitleStyle]}>
          {statusText}
          {dots}
        </Animated.Text>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Animated.View style={[styles.progressFill, { backgroundColor: '#FFFFFF' }, progressStyle]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const CIRCLE_SIZE = 220;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },
  centerWrap: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotatingRing: {
    position: 'absolute',
    width: CIRCLE_SIZE * 0.9,
    height: CIRCLE_SIZE * 0.9,
    borderRadius: (CIRCLE_SIZE * 0.9) / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderTopColor: 'rgba(255,255,255,0.6)',
    borderLeftColor: 'rgba(255,255,255,0.4)',
    borderRightColor: 'rgba(255,255,255,0.1)',
  },
  pulseCircleOuter: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  pulseCircleMiddle: {
    position: 'absolute',
    width: CIRCLE_SIZE * 0.75,
    height: CIRCLE_SIZE * 0.75,
    borderRadius: (CIRCLE_SIZE * 0.75) / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  pulseCircleInner: {
    position: 'absolute',
    width: CIRCLE_SIZE * 0.5,
    height: CIRCLE_SIZE * 0.5,
    borderRadius: (CIRCLE_SIZE * 0.5) / 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
  },
  textWrap: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },

  // Enhanced styles
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  rotatingRing2: {
    position: 'absolute',
    width: CIRCLE_SIZE * 1.1,
    height: CIRCLE_SIZE * 1.1,
    borderRadius: (CIRCLE_SIZE * 1.1) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderTopColor: 'rgba(255,255,255,0.3)',
    borderLeftColor: 'rgba(255,255,255,0.2)',
    borderRightColor: 'rgba(255,255,255,0.05)',
  },
  pinInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '80%',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '30%',
    borderRadius: 2,
  },
});