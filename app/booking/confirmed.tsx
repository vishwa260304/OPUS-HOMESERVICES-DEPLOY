import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

const { width, height } = Dimensions.get('window');

// Confetti Particle Component
const ConfettiParticle = ({ 
  delay, 
  angle, 
  distance, 
  color, 
  size, 
  shape 
}: { 
  delay: number; 
  angle: number; 
  distance: number; 
  color: string; 
  size: number;
  shape: 'circle' | 'square' | 'triangle';
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: x,
        duration: 1000,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: y,
        duration: 1000,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.8,
          duration: 800,
          delay: delay + 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(scale, {
        toValue: 1,
        tension: 50,
        friction: 6,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 360,
        duration: 1000,
        delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const rotateInterpolation = rotate.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const getShapeStyle = () => {
    if (shape === 'square') {
      return {
        width: size,
        height: size,
        borderRadius: 2,
      };
    } else if (shape === 'triangle') {
      return {
        width: 0,
        height: 0,
        borderLeftWidth: size / 2,
        borderRightWidth: size / 2,
        borderBottomWidth: size,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
        backgroundColor: 'transparent',
      };
    } else {
      return {
        width: size,
        height: size,
        borderRadius: size / 2,
      };
    }
  };

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        {
          ...getShapeStyle(),
          backgroundColor: shape === 'triangle' ? 'transparent' : color,
          transform: [
            { translateX },
            { translateY },
            { scale },
            { rotate: rotateInterpolation },
          ],
          opacity,
        },
      ]}
    />
  );
};

// Curved Line Component
const CurvedLine = ({ 
  delay, 
  startX, 
  startY, 
  endX, 
  endY, 
  color, 
  controlPoint 
}: { 
  delay: number; 
  startX: number; 
  startY: number; 
  endX: number; 
  endY: number; 
  color: string;
  controlPoint: { x: number; y: number };
}) => {
  const pathLength = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pathLength, {
        toValue: 1,
        duration: 800,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 0.6,
        duration: 600,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Simplified curved line using a View with rotation
  const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
  const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

  return (
    <Animated.View
      style={[
        styles.curvedLine,
        {
          left: startX,
          top: startY,
          width: length,
          height: 2,
          backgroundColor: color,
          transform: [
            { rotate: `${angle}deg` },
            { scaleX: pathLength },
          ],
          opacity,
        },
      ]}
    />
  );
};

export default function BookingConfirmedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const hasInitialized = useRef(false);

  // Main checkmark circle
  const circleScale = useRef(new Animated.Value(0)).current;
  const circleOpacity = useRef(new Animated.Value(0)).current;
  
  // Rings
  const ring1Scale = useRef(new Animated.Value(0)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(0)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;
  
  // Checkmark
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const checkmarkOpacity = useRef(new Animated.Value(0)).current;
  
  // Text animations
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(20)).current;

  // Button
  const buttonScale = useRef(new Animated.Value(0.9)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  const [countdown, setCountdown] = useState(5);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiParticles, setConfettiParticles] = useState<Array<{
    id: number;
    angle: number;
    distance: number;
    color: string;
    size: number;
    delay: number;
    shape: 'circle' | 'square' | 'triangle';
  }>>([]);
  const [curvedLines, setCurvedLines] = useState<Array<{
    id: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    color: string;
    delay: number;
    controlPoint: { x: number; y: number };
  }>>([]);

  // Generate confetti particles
  const generateConfetti = () => {
    const particleColors = ['#F44336', '#FF9800', '#2196F3', '#FFC107', '#03A9F4', '#4CAF50', '#3F51B5', '#9C27B0'];
    const shapes: Array<'circle' | 'square' | 'triangle'> = ['circle', 'square', 'triangle'];
    const centerX = width / 2;
    const centerY = height * 0.35;
    
    const particles = [];
    for (let i = 0; i < 25; i++) {
      const angle = (Math.PI * 2 * i) / 25 + Math.random() * 0.5;
      const distance = 80 + Math.random() * 60;
      const color = particleColors[Math.floor(Math.random() * particleColors.length)];
      const size = 6 + Math.random() * 6;
      const delay = Math.random() * 300;
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      particles.push({ id: i, angle, distance, color, size, delay, shape });
    }
    setConfettiParticles(particles);

    // Generate curved lines
    const lineColors = ['#F44336', '#4CAF50', '#03A9F4', '#FFC107'];
    const lines = [];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const startDist = 60;
      const endDist = 120 + Math.random() * 40;
      const startX = centerX + Math.cos(angle) * startDist;
      const startY = centerY + Math.sin(angle) * startDist;
      const endX = centerX + Math.cos(angle) * endDist;
      const endY = centerY + Math.sin(angle) * endDist;
      const color = lineColors[Math.floor(Math.random() * lineColors.length)];
      const delay = Math.random() * 200;
      lines.push({
        id: i,
        startX,
        startY,
        endX,
        endY,
        color,
        delay,
        controlPoint: {
          x: (startX + endX) / 2 + (Math.random() - 0.5) * 30,
          y: (startY + endY) / 2 + (Math.random() - 0.5) * 30,
        },
      });
    }
    setCurvedLines(lines);
  };

  useEffect(() => {
    // Prevent duplicate initialization
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Phase 1: Rings appear first
    Animated.parallel([
      Animated.spring(ring1Scale, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(ring1Opacity, {
        toValue: 0.3,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.spring(ring2Scale, {
          toValue: 1,
          tension: 40,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(ring2Opacity, {
          toValue: 0.2,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 100);

    // Phase 2: Main circle with checkmark
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(circleScale, {
          toValue: 1,
          tension: 80,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(circleOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.spring(checkmarkScale, {
            toValue: 1,
            tension: 100,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.timing(checkmarkOpacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      }, 200);
    }, 300);

    // Phase 3: Confetti and lines
    setTimeout(() => {
      generateConfetti();
      setShowConfetti(true);
    }, 600);

    // Phase 4: Text animations
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 800);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 1000);

    // Phase 5: Button animation
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(buttonScale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 1200);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setTimeout(() => {
            router.replace('/(tabs)/orders');
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [router]);

  const centerX = width / 2;
  const centerY = height * 0.35;
  const circleRadius = 70;

  return (
    <View style={[styles.container, { backgroundColor: '#E8F5E9' }]}>
      {/* Confetti Particles */}
      {showConfetti && confettiParticles.map((particle) => (
        <ConfettiParticle
          key={particle.id}
          delay={particle.delay}
          angle={particle.angle}
          distance={particle.distance}
          color={particle.color}
          size={particle.size}
          shape={particle.shape}
        />
      ))}

      {/* Curved Lines */}
      {showConfetti && curvedLines.map((line) => (
        <CurvedLine
          key={line.id}
          delay={line.delay}
          startX={line.startX}
          startY={line.startY}
          endX={line.endX}
          endY={line.endY}
          color={line.color}
          controlPoint={line.controlPoint}
        />
      ))}

      {/* Success Animation Container */}
      <View style={[styles.animationContainer, { top: centerY - circleRadius, left: centerX - circleRadius }]}>
        {/* Outer Ring 2 */}
        <Animated.View
          style={[
            styles.ring,
            styles.ring2,
            {
              borderColor: '#A5D6A7',
              transform: [{ scale: ring2Scale }],
              opacity: ring2Opacity,
            },
          ]}
        />

        {/* Outer Ring 1 */}
        <Animated.View
          style={[
            styles.ring,
            styles.ring1,
            {
              borderColor: '#81C784',
              transform: [{ scale: ring1Scale }],
              opacity: ring1Opacity,
            },
          ]}
        />

        {/* Main Green Circle */}
        <Animated.View
          style={[
            styles.mainCircle,
            {
              backgroundColor: '#4CAF50',
              transform: [{ scale: circleScale }],
              opacity: circleOpacity,
            },
          ]}
        >
          {/* Checkmark */}
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                transform: [{ scale: checkmarkScale }],
                opacity: checkmarkOpacity,
              },
            ]}
          >
            <Ionicons name="checkmark" size={50} color="white" />
          </Animated.View>
        </Animated.View>
      </View>

      {/* Title */}
      <Animated.View
        style={[
          styles.titleWrapper,
          {
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          },
        ]}
      >
        <Text style={[styles.title, { color: '#2E7D32' }]}>
          Booking Confirmed!
        </Text>
      </Animated.View>

      {/* Subtitle */}
      <Animated.View
        style={[
          styles.subtitleWrapper,
          {
            opacity: subtitleOpacity,
            transform: [{ translateY: subtitleTranslateY }],
          },
        ]}
      >
        <Text style={[styles.subtitle, { color: '#388E3C' }]}>
          Your service has been successfully booked
        </Text>
        <Text style={[styles.countdown, { color: '#66BB6A' }]}>
          Redirecting to orders in {countdown} seconds...
        </Text>
      </Animated.View>

      {/* Action button */}
      <Animated.View
        style={[
          styles.buttonWrapper,
          {
            opacity: buttonOpacity,
            transform: [{ scale: buttonScale }],
          },
        ]}
      >
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.primary }]} 
          onPress={() => router.replace('/(tabs)/orders')} 
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={[styles.buttonText, { color: colors.surface }]}>
              View Orders Now
            </Text>
            <Ionicons name="arrow-forward" size={18} color={colors.surface} style={styles.buttonIcon} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: 20,
    position: 'relative',
  },
  animationContainer: {
    position: 'absolute',
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 1000,
  },
  ring1: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  ring2: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  mainCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  checkmarkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiParticle: {
    position: 'absolute',
    top: height * 0.35,
    left: width / 2,
  },
  curvedLine: {
    position: 'absolute',
  },
  titleWrapper: {
    alignItems: 'center',
    marginTop: height * 0.5,
    marginBottom: 12,
  },
  title: { 
    fontSize: 28, 
    fontWeight: '700', 
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitleWrapper: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  subtitle: { 
    fontSize: 16, 
    marginBottom: 8, 
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
  },
  countdown: { 
    fontSize: 14, 
    textAlign: 'center',
    opacity: 0.8,
    fontWeight: '400',
  },
  buttonWrapper: {
    width: '100%',
    maxWidth: 300,
  },
  button: { 
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { 
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 8,
  },
});