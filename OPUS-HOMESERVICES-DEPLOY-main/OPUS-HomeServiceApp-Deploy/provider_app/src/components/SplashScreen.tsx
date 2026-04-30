import React, { useEffect } from 'react';
import { StyleSheet, Text, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, withSequence, Easing } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const SplashScreen: React.FC = () => {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(10);

  useEffect(() => {
    logoOpacity.value = withDelay(300, withTiming(1, { duration: 600 }));
    logoScale.value = withSequence(
      withDelay(300, withTiming(1.08, { duration: 400, easing: Easing.out(Easing.exp) })),
      withTiming(1, { duration: 200, easing: Easing.out(Easing.exp) })
    );

    taglineOpacity.value = withDelay(1000, withTiming(1, { duration: 500 }));
    taglineTranslateY.value = withDelay(1000, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
    ],
  }));

  const animatedTaglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [
      { translateY: taglineTranslateY.value },
    ],
  }));

  return (
    <LinearGradient
      colors={['#004C8F', '#0C1A5D']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <Animated.Text style={[styles.title, animatedLogoStyle]}>FIXIT PARTNER</Animated.Text>
      <Animated.Text style={[styles.subtitle, animatedTaglineStyle]}>Fixit Like A Pro</Animated.Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width,
    height,
  },
  title: {
    fontSize: 60,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 4,
    textTransform: 'uppercase',
    shadowColor: 'rgba(0, 0, 0, 0.35)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  subtitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#D5E4FF',
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'capitalize',
  },
});

export default SplashScreen;