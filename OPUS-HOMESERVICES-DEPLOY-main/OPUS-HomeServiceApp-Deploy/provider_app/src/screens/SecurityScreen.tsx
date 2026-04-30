import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';

const SecurityScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();

  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={sectorGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButtonHeader}
            >
              <Ionicons name="arrow-back" size={moderateScale(24)} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Privacy & Security</Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Privacy & Security Information Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark-outline" size={moderateScale(32)} color={colors.primary} />
          </View>
          
          <Text style={[styles.title, { color: colors.text }]}>
            Your Privacy & Security Matters
          </Text>
          
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We are committed to protecting your personal information and ensuring the security of your account. 
            Your data is encrypted and stored securely using industry-standard security measures.
          </Text>
          
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            We implement multiple layers of security including secure authentication, encrypted data transmission, 
            and regular security audits to safeguard your information from unauthorized access.
          </Text>
          
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            Your personal information, including contact details, payment information, and service history, 
            is handled with the utmost care and is never shared with third parties without your explicit consent.
          </Text>
          
          <Text style={[styles.paragraph, { color: colors.textSecondary }]}>
            If you have any concerns about your privacy or security, please contact our support team immediately. 
            We continuously work to improve our security practices and protect your data.
          </Text>
        </View>

        {/* Security Features List */}
        <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Security Features</Text>
          
          <View style={styles.featureItem}>
            <Ionicons name="lock-closed-outline" size={moderateScale(20)} color={colors.primary} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              End-to-end encryption for all data transmission
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="key-outline" size={moderateScale(20)} color={colors.primary} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Secure authentication and password protection
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="eye-off-outline" size={moderateScale(20)} color={colors.primary} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Privacy controls to manage your data sharing preferences
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark-outline" size={moderateScale(20)} color={colors.primary} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Regular security updates and monitoring
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: moderateScale(0),
    paddingBottom: moderateScale(16),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(10),
  },
  backButtonHeader: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(40),
  },
  infoCard: {
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    marginBottom: moderateScale(16),
    borderWidth: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: moderateScale(16),
  },
  title: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    marginBottom: moderateScale(16),
    textAlign: 'center',
  },
  paragraph: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(22),
    marginBottom: moderateScale(16),
    textAlign: 'left',
  },
  featuresCard: {
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    marginBottom: moderateScale(16),
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: moderateScale(16),
  },
  featureText: {
    flex: 1,
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    marginLeft: moderateScale(12),
  },
});

export default SecurityScreen;
