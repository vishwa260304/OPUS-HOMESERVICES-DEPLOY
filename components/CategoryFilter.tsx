import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { hapticButtonPress, hapticSuccess } from '../utils/haptics';

const { width: screenWidth } = Dimensions.get('window');

interface CategoryFilterProps {
  currentPage: 'health' | 'home';
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({ currentPage }) => {
  const router = useRouter();
  const slideAnimation = React.useRef(new Animated.Value(currentPage === 'health' ? 0 : 1)).current;

  // Create sliding animation for active option
  useEffect(() => {
    Animated.timing(slideAnimation, {
      toValue: currentPage === 'health' ? 0 : 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [currentPage]);

  const handleHealthPress = () => {
    hapticButtonPress();
    hapticSuccess();
    if (currentPage !== 'health') {
      router.push('/(tabs)/orders' as any);
    }
  };

  const handleHomePress = () => {
    hapticButtonPress();
    hapticSuccess();
    if (currentPage !== 'home') {
      router.push('/(tabs)/index' as any);
    }
  };

  const slideTranslateX = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 50], // Slide from left to right position
  });

  return (
    <View style={styles.container}>
      <View style={styles.ovalContainer}>
        {/* Oval Sliding Indicator */}
        <Animated.View
          style={[
            styles.ovalIndicator,
            {
              transform: [{ translateX: slideTranslateX }],
            },
          ]}
        />
        
        {/* Health Option */}
        <TouchableOpacity
          style={styles.optionContainer}
          onPress={handleHealthPress}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.emojiText,
            currentPage === 'health' ? styles.activeEmoji : styles.inactiveEmoji
          ]}>🏥</Text>
        </TouchableOpacity>

        {/* Services Option */}
        <TouchableOpacity
          style={styles.optionContainer}
          onPress={handleHomePress}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.emojiText,
            currentPage === 'home' ? styles.activeEmoji : styles.inactiveEmoji
          ]}>🔧</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 1,
    marginVertical: -5,
    width: '100%',
    alignItems: 'center',
  },
  ovalContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom:-1.5,
    borderRadius: 25,
    padding: 2,
    width: 103,
    height: 46,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  ovalIndicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 46,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  optionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    height: 38,
    zIndex: 1,
  },
  emojiText: {
    fontSize: 22,
  },
  activeEmoji: {
    fontSize: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  inactiveEmoji: {
    fontSize: 22,
    opacity: 0.7,
  },
});

export default CategoryFilter;