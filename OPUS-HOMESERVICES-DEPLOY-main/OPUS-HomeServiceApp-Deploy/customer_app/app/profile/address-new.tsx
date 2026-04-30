import React, { useLayoutEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, ToastAndroid, Alert, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../context/AuthContext";
import { UserAddressesApi } from "../../lib/userAddresses";

export default function AddressNewScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { user } = useAuth();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [locality, setLocality] = useState("");
  const [flat, setFlat] = useState("");
  const [landmark, setLandmark] = useState("");
  const [type, setType] = useState<"Home" | "Office" | "Other">("Home");
  const [isDefault, setIsDefault] = useState(false);

  const formValid = name.trim() && phone.trim().length >= 10 && pincode.trim().length >= 5 && city.trim() && state.trim() && flat.trim();

  const save = async () => {
    if (!formValid) return;
    try {
      const line1 = `${flat}, ${locality}`.trim();
      if (user?.id) {
        await UserAddressesApi.create({
          user_id: user.id,
          label: type,
          recipient_name: name,
          phone,
          line1,
          city,
          state,
          pincode,
          is_default: isDefault,
        } as any);
      } else {
        // Offline/local persistence
        const raw = await AsyncStorage.getItem('user_addresses');
        const list = raw ? JSON.parse(raw) : [];
        list.unshift({
          id: Date.now().toString(),
          line: line1,
          tag: type,
          name,
          phone,
          city,
          state,
          pincode,
          isDefault,
        });
        await AsyncStorage.setItem('user_addresses', JSON.stringify(list));
      }
      if (Platform.OS === 'android') ToastAndroid.show('Address saved', ToastAndroid.SHORT);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    }
  };

  return (
    <LinearGradient colors={["#050341", "#1E3A8A", "#1818ec"]} style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Address</Text>
        <TouchableOpacity onPress={() => { setName(""); setPhone(""); setPincode(""); setCity(""); setState(""); setLocality(""); setFlat(""); setLandmark(""); setType("Home"); setIsDefault(false); }}>
          <Text style={styles.reset}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>Contact Info</Text>
        <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Phone Number (+91)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.section}>Address Info</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Pincode" value={pincode} onChangeText={setPincode} keyboardType="number-pad" />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="City" value={city} onChangeText={setCity} />
        </View>
        <TextInput style={styles.input} placeholder="State" value={state} onChangeText={setState} />
        <TextInput style={styles.input} placeholder="Locality / Area / Street" value={locality} onChangeText={setLocality} />
        <TextInput style={styles.input} placeholder="Flat no / Building Name" value={flat} onChangeText={setFlat} />
        <TextInput style={styles.input} placeholder="Landmark (optional)" value={landmark} onChangeText={setLandmark} />

        <Text style={styles.section}>Type of Address</Text>
        <View style={styles.typeRow}>
          {(["Home", "Office", "Other"] as const).map(t => (
            <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
              <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.defaultRow}>
          <Switch value={isDefault} onValueChange={setIsDefault} />
          <Text style={styles.defaultLabel}>Make as default address</Text>
        </View>

        <TouchableOpacity style={[styles.saveBtn, !formValid && { opacity: 0.6 }]} disabled={!formValid} onPress={save}>
          <Text style={styles.saveText}>Save Address</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  reset: { color: '#2563eb', fontWeight: '700' },
  content: { backgroundColor: '#fff', padding: 16, paddingBottom: 40 },
  section: { marginTop: 16, marginBottom: 8, color: '#111', fontWeight: '800' },
  input: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 12, fontSize: 14 },
  typeRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#111' },
  chipText: { color: '#111', fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  defaultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  defaultLabel: { color: '#111', fontWeight: '600' },
  saveBtn: { marginTop: 24, height: 52, borderRadius: 12, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#004c8f"', fontWeight: '800' },
});