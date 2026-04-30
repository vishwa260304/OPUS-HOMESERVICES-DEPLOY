import React, { useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AddUpiIdScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [upiId, setUpiId] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  const saveUpi = async () => {
    const value = upiId.trim();
    if (!value || !/^[\w.\-]+@[\w\-]+$/i.test(value)) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID like name@bank.');
      return;
    }
    await AsyncStorage.setItem('saved_upi_id', value);
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add new UPI ID</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={{ backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>UPI</Text>
          </View>
          <Text style={styles.title}>Add new UPI ID</Text>
        </View>
        <View style={styles.separator} />
        <View style={{ padding: 16 }}>
          <View style={styles.inputWrapper}>
            <TextInput
              placeholder="Enter your UPI ID"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              value={upiId}
              onChangeText={setUpiId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.helperText}>Your UPI ID will be encrypted and is 100% safe with us</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={saveUpi}>
            <Text style={styles.primaryBtnText}>Add UPI ID</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  logoBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  logoText: { color: '#111827', fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  separator: { height: 1, backgroundColor: '#E5E7EB' },
  inputWrapper: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, backgroundColor: '#fff' },
  input: { paddingHorizontal: 14, paddingVertical: 12, color: '#111827' },
  helperText: { marginTop: 10, color: '#6B7280' },
  primaryBtn: { marginTop: 16, backgroundColor: '#3366ff', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});