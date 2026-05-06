import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../../context/UserContext';

export default function ConfirmLocationScreen() {
  const router = useRouter();
  const { address, location } = useUser();

  useEffect(() => {
    const doNext = async () => {
      try { await AsyncStorage.setItem('user_address_confirmed', 'true'); } catch {}
    };
    doNext();
    const t = setTimeout(() => router.replace('/(tabs)'), 3000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.checkWrap}>
        <Ionicons name="checkmark-circle" size={56} color="#22C55E" />
      </View>
      <Text style={styles.subtitle}>Delivering service at</Text>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.address} numberOfLines={3}>
        {address?.fullText || location}
      </Text>

      {/* Auto-redirects after 3s */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingHorizontal: 24 },
  checkWrap: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  subtitle: { color: '#16A34A', fontWeight: '700', marginTop: 8 },
  title: { fontSize: 28, fontWeight: '900', color: '#111827', marginVertical: 4 },
  address: { textAlign: 'center', color: '#6B7280', fontSize: 16, lineHeight: 24 },
  
});