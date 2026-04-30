import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface OnboardingPage {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  iconColor: string;
  gradientColors: string[];
  image: any;
  features: string[];
}

const onboardingPages: OnboardingPage[] = [
  {
    id: 2,
    title: 'Home Services',
    subtitle: 'We fix your house',
    description: 'Professional home repair and maintenance services with free survey and consultation.',
    icon: 'construct',
    iconColor: '#FF6B35',
    gradientColors: ['#E3F2FD', '#BBDEFB'],
    image: require('../assets/images/home_onboard.png'),
    features: [
      'Plumbing & Electrical',
      'Carpentry & Painting',
      'Free Survey Service',
      'Professional Technicians'
    ]
  },
  {
    id: 3,
    title: 'Appliance Services',
    subtitle: 'We repair your things',
    description: 'Complete appliance repair and maintenance services for all your home electronics.',
    icon: 'construct',
    iconColor: '#DC2626',
    gradientColors: ['#FFEBEE', '#FFCDD2'],
    image: require('../assets/images/acinstall.webp'),
    features: [
      'AC & Refrigerator Repair',
      'Kitchen Appliance Service',
      'Home Electronics',
      'Free Survey Service'
    ]
  },
  {
    id: 4,
    title: 'Automobile Services',
    subtitle: 'Expert Car Care',
    description: 'Professional automotive services including repairs, maintenance, and emergency assistance.',
    icon: 'car',
    iconColor: '#1E3A8A',
    gradientColors: ['#E3F2FD', '#BBDEFB'],
    image: require('../assets/images/autocare.png'),
    features: [
      'Car Repair & Maintenance',
      'Emergency Roadside',
      'Insurance Claims',
      'Vehicle Inspection'
    ]
  },
  {
    id: 5,
    title: 'Real Estate Services',
    subtitle: 'Your Dream Home Awaits',
    description: 'Property services for buying, selling, renting, and verified parking rentals.',
    icon: 'home',
    iconColor: '#047857',
    gradientColors: ['#ECFDF5', '#A7F3D0'],
    image: require('../assets/images/rent&lease.webp'),
    features: [
      'Buy / Sell Property',
      'Rent & Lease',
      'Car Parking Rentals',
      'KYC Assistance'
    ]
  }
];

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(contentOffsetX / width);
    setCurrentPage(pageIndex);
  };

  const goToNextPage = () => {
    if (currentPage < onboardingPages.length - 1) {
      const nextPage = currentPage + 1;
      scrollViewRef.current?.scrollTo({
        x: nextPage * width,
        animated: true,
      });
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      const prevPage = currentPage - 1;
      scrollViewRef.current?.scrollTo({
        x: prevPage * width,
        animated: true,
      });
    }
  };

  const handleGetStarted = async () => {
    try {
      // Navigate to login page directly
      router.push('/subcategories/login');
    } catch (error) {
      // Still navigate even if there's an error
      router.push('/subcategories/login');
    }
  };

  const renderPage = (page: OnboardingPage, index: number) => (
    <View key={page.id} style={styles.page}>
      {/* Full Background Image */}
      <Image source={page.image} style={styles.backgroundImage} resizeMode="cover" />
      
      {/* White Card Overlay */}
      <View style={styles.whiteCardContainer}>
        <View style={styles.whiteCard}>
          <View style={styles.cardContent}>
            <Text style={styles.title}>{page.title}</Text>
            <Text style={styles.subtitle}>{page.subtitle}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderPageIndicators = () => (
    <View style={styles.indicatorsContainer}>
      {onboardingPages.map((_, index) => (
        <View
          key={index}
          style={[
            styles.indicator,
            {
              backgroundColor: currentPage === index ? '#004c8f' : '#E5E7EB',
            },
          ]}
        />
      ))}
    </View>
  );

  const renderBottomActions = () => (
    <View style={styles.bottomActions}>
      {currentPage < onboardingPages.length - 1 ? (
        <View style={styles.nextButtonContainer}>
          <TouchableOpacity style={styles.nextButton} onPress={goToNextPage}>
            <LinearGradient
              colors={['#004c8f', '#0c1a5d']}
              style={styles.nextButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.nextButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted}>
          <LinearGradient
            colors={['#004c8f', '#0c1a5d']}
            style={styles.getStartedGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {onboardingPages.map((page, index) => renderPage(page, index))}
      </ScrollView>

      {renderPageIndicators()}
      {renderBottomActions()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    overflow: 'visible',
  },
  page: {
    width,
    height,
    position: 'relative',
    overflow: 'visible',
  },
  backgroundImage: {
    width: '100%',
    height: '75%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  whiteCardContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    marginVertical: -120,
    overflow: 'hidden',
  },
  whiteCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 30,
    paddingHorizontal: 30,
    paddingBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 10,
    marginTop: -235,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  indicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  bottomActions: {
    paddingHorizontal: 30,
    paddingBottom: 40,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  nextButtonContainer: {
    alignItems: 'flex-end',
  },
  nextButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 4,
  },
  getStartedButton: {
    borderRadius: 25,
    overflow: 'hidden',
    width: '100%',
    marginBottom: -5,
  },
  getStartedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
  },
  getStartedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
