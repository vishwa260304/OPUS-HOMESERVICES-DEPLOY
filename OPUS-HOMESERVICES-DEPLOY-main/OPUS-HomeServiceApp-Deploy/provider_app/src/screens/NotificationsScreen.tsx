import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { moderateScale } from '../utils/responsive';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
}

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'orders',
      title: 'New Orders',
      description: 'Get notified when you receive new orders',
      icon: 'bag-outline',
      enabled: true,
    },
    {
      id: 'appointments',
      title: 'Appointments',
      description: 'Notifications for appointment bookings and updates',
      icon: 'calendar-outline',
      enabled: true,
    },
    
    {
      id: 'reviews',
      title: 'Reviews & Ratings',
      description: 'Get notified when customers leave reviews',
      icon: 'star-outline',
      enabled: true,
    },
    {
      id: 'payments',
      title: 'Payments',
      description: 'Notifications for payment updates and withdrawals',
      icon: 'wallet-outline',
      enabled: true,
    },
    {
      id: 'updates',
      title: 'App Updates',
      description: 'Important updates and announcements',
      icon: 'information-circle-outline',
      enabled: true,
    },
    {
      id: 'promotions',
      title: 'Promotions & Offers',
      description: 'Special offers and promotional notifications',
      icon: 'gift-outline',
      enabled: false,
    },
  ]);

  const toggleSetting = (id: string) => {
    setSettings(prev =>
      prev.map(setting =>
        setting.id === id ? { ...setting, enabled: !setting.enabled } : setting
      )
    );
  };

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
            <Text style={styles.headerTitle}>Notification Settings</Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={[styles.descriptionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="notifications-outline" size={moderateScale(24)} color={colors.primary} />
          <Text style={[styles.descriptionText, { color: colors.text }]}>
            Manage your notification preferences. Turn on or off specific notification types to customize your experience.
          </Text>
        </View>

        {/* Notification Settings List */}
        <View style={styles.settingsContainer}>
          {settings.map((setting, index) => (
            <View
              key={setting.id}
              style={[
                styles.settingCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                index < settings.length - 1 && styles.settingCardWithMargin,
              ]}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name={setting.icon as any} size={moderateScale(20)} color={colors.primary} />
                </View>
                <View style={styles.settingTextContainer}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    {setting.title}
                  </Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                    {setting.description}
                  </Text>
                </View>
              </View>
              <Switch
                value={setting.enabled}
                onValueChange={() => toggleSetting(setting.id)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#ffffff"
                ios_backgroundColor={colors.border}
              />
            </View>
          ))}
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
  descriptionCard: {
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    marginBottom: moderateScale(20),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  descriptionText: {
    flex: 1,
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    marginLeft: moderateScale(12),
    color: '#6b7280',
  },
  settingsContainer: {
    marginTop: moderateScale(8),
  },
  settingCard: {
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingCardWithMargin: {
    marginBottom: moderateScale(12),
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: moderateScale(16),
  },
  settingIcon: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(12),
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginBottom: moderateScale(4),
  },
  settingDescription: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(18),
  },
});

export default NotificationsScreen;
