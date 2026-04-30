import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const [whatsapp, setWhatsapp] = useState<boolean>(true);
  const [sms, setSms] = useState<boolean>(true);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  useEffect(() => {
    const load = async () => {
      const w = await AsyncStorage.getItem('notif_whatsapp');
      const s = await AsyncStorage.getItem('notif_sms');
      if (w !== null) setWhatsapp(w === 'true');
      if (s !== null) setSms(s === 'true');
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('notif_whatsapp', String(whatsapp));
  }, [whatsapp]);

  useEffect(() => {
    AsyncStorage.setItem('notif_sms', String(sms));
  }, [sms]);

  const Row = ({
    icon,
    title,
    subtitle,
    value,
    onValueChange,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
  }) => (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>{icon}</View>
        <View>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
      </View>
      <Switch value={value} onValueChange={onValueChange} thumbColor={value ? '#fff' : (isDark ? '#111' : '#f3f4f6')} trackColor={{ true: '#004c8f', false: colors.border as any }} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notification preferences</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Row
            icon={<Ionicons name="logo-whatsapp" size={20} color="#22c55e" />}
            title="Promotional WhatsApp messages"
            subtitle="Receive WhatsApp updates about coupons, promotions and offers"
            value={whatsapp}
            onValueChange={setWhatsapp}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Row
            icon={<Ionicons name="chatbox-ellipses-outline" size={20} color={colors.textSecondary as any} />}
            title="Promotional SMS"
            subtitle="Receive SMS updates about coupons, promotions and offers"
            value={sms}
            onValueChange={setSms}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  card: { padding: 14, marginHorizontal: 16, marginTop: 12, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowTitle: { fontWeight: '800' },
  rowSubtitle: { marginTop: 2, width: 240 },
});