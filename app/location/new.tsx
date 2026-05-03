import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser, UserAddress } from '../../context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NewAddressScreen() {
  const router = useRouter();
  const { setAddress, setLocation } = useUser();
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  const onSave = async () => {
    const labelParts = [street, area, city].filter(Boolean);
    const label = labelParts.join(', ');
    const addr: UserAddress = {
      label: label || 'Custom Address',
      streetLine: street || undefined,
      area: area || undefined,
      city: city || undefined,
      postalCode: pincode || undefined,
      fullText: [street, area, city, pincode].filter(Boolean).join(', '),
    };
    await setAddress(addr);
    await setLocation(addr.label);
    try { await AsyncStorage.setItem('user_address_confirmed', 'true'); } catch {}
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Address</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.form}>
        <TextInput placeholder="Street / Building" style={styles.input} onChangeText={setStreet} />
        <TextInput placeholder="Area / Locality" style={styles.input} onChangeText={setArea} />
        <TextInput placeholder="City" style={styles.input} onChangeText={setCity} />
        <TextInput placeholder="Pincode" style={styles.input} onChangeText={setPincode} keyboardType="number-pad" />
        <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveText}>Save Address</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#111827' },
  form: { padding: 16 },
  input: { height: 48, borderRadius: 12, backgroundColor: '#F3F4F6', paddingHorizontal: 12, marginBottom: 12, color: '#111827' },
  saveBtn: { marginTop: 8, backgroundColor: '#111827', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900' },
});