import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useLayoutEffect, useEffect, useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { hapticButtonPress } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { UserAddressesApi } from '../lib/userAddresses';

interface Address {
  id: string;
  type: 'Home' | 'Work' | 'Other';
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

const AddressSelectionScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();

  const [showAddAddress, setShowAddAddress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [newAddress, setNewAddress] = useState({
    type: 'Home' as 'Home' | 'Work' | 'Other',
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  const fetchAddresses = useCallback(async () => {
    if (!user?.id) return;
    try {
      const rows = await UserAddressesApi.listByUser(user.id);
      const mapped: Address[] = rows.map(r => ({
        id: r.id ? String(r.id) : generateId(),
        type: (r.label as 'Home' | 'Work' | 'Other') || 'Home',
        name: r.recipient_name || '',
        phone: r.phone || '',
        address: r.line1 || '',
        city: r.city || '',
        state: r.state || '',
        pincode: r.pincode || '',
      }));

      setAddresses(mapped);
    } catch {
      // Failed to load addresses
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  useFocusEffect(
    useCallback(() => {
      fetchAddresses();
    }, [fetchAddresses])
  );

  // Select an address
  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
    hapticButtonPress();
  };
  const generateId = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;


  // Add new address
  const handleAddAddress = async () => {
    if (!newAddress.name || !newAddress.phone || !newAddress.address ||
        !newAddress.city || !newAddress.state || !newAddress.pincode) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const localAddress: Address = {
  id: generateId(),
  ...newAddress,
};


    try {
      if (user?.id) {
        const saved = await UserAddressesApi.create({
          user_id: user.id,
          label: newAddress.type,
          recipient_name: newAddress.name,
          phone: newAddress.phone,
          line1: newAddress.address,
          city: newAddress.city,
          state: newAddress.state,
          pincode: newAddress.pincode,
        });

        const mappedSaved: Address = {
          id: saved.id || Date.now().toString(),
          type: (saved.label as any) || 'Home',
          name: saved.recipient_name || '',
          phone: saved.phone || '',
          address: saved.line1 || '',
          city: saved.city || '',
          state: saved.state || '',
          pincode: saved.pincode || '',
        };

        setAddresses([mappedSaved, ...addresses]);
        setSelectedAddressId(mappedSaved.id);
      } else {
        setAddresses([localAddress, ...addresses]);
        setSelectedAddressId(localAddress.id);
      }

      setShowAddAddress(false);
      setNewAddress({ type: 'Home', name: '', phone: '', address: '', city: '', state: '', pincode: '' });
      hapticButtonPress();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save address');
    }
  };

  // Proceed to payment
  const handleProceedToSlot = () => {
    if (!selectedAddressId) {
      Alert.alert('Add address', 'Please add and select an address before proceeding to payment.');
      return;
    }
    hapticButtonPress();
    router.push('/payment'); // make sure this path exists
  };

  // Address type color
  const getAddressTypeColor = (type: string) => {
    switch (type) {
      case 'Home': return '#4CAF50';
      case 'Work': return '#2196F3';
      case 'Other': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  return (
    <LinearGradient colors={['#050341ff', '#1E3A8A', '#1818ecff']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Address</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        style={styles.scrollContainer}
        data={addresses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={(
          <>
            {/* Add New Address Button */}
            <TouchableOpacity 
              style={styles.addAddressButton} 
              onPress={() => setShowAddAddress(true)}
            >
              <Ionicons name="add-circle-outline" size={24} color="#8B5CF6" />
              <Text style={styles.addAddressText}>Add New Address</Text>
            </TouchableOpacity>

            {/* Add New Address Form */}
            {showAddAddress && (
              <View style={styles.addAddressForm}>
                <Text style={styles.formTitle}>Add New Address</Text>
                <View style={styles.typeSelection}>
                  {['Home', 'Work', 'Other'].map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeButton, newAddress.type === type && styles.typeButtonActive]}
                      onPress={() => setNewAddress({ ...newAddress, type: type as any })}
                    >
                      <Text style={[styles.typeButtonText, newAddress.type === type && styles.typeButtonTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#999" value={newAddress.name} onChangeText={text => setNewAddress({ ...newAddress, name: text })} />
                <TextInput style={styles.input} placeholder="Phone Number" placeholderTextColor="#999" value={newAddress.phone} onChangeText={text => setNewAddress({ ...newAddress, phone: text })} keyboardType="phone-pad" />
                <TextInput style={styles.input} placeholder="Address Line" placeholderTextColor="#999" value={newAddress.address} onChangeText={text => setNewAddress({ ...newAddress, address: text })} multiline />
                <View style={styles.row}>
                  <TextInput style={[styles.input, styles.halfInput]} placeholder="City" placeholderTextColor="#999" value={newAddress.city} onChangeText={text => setNewAddress({ ...newAddress, city: text })} />
                  <TextInput style={[styles.input, styles.halfInput]} placeholder="State" placeholderTextColor="#999" value={newAddress.state} onChangeText={text => setNewAddress({ ...newAddress, state: text })} />
                </View>
                <TextInput style={styles.input} placeholder="Pincode" placeholderTextColor="#999" value={newAddress.pincode} onChangeText={text => setNewAddress({ ...newAddress, pincode: text })} keyboardType="numeric" />
                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAddAddress(false)}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={handleAddAddress}>
                    <Text style={styles.saveButtonText}>Save Address</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>Saved Addresses</Text>
            {addresses.length === 0 && (
              <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 20, alignItems: 'center' }}>
                <Ionicons name="location-outline" size={32} color="#8B5CF6" />
                <Text style={{ marginTop: 8, color: '#333', fontWeight: '600' }}>No addresses yet</Text>
                <Text style={{ marginTop: 4, color: '#666', textAlign: 'center' }}>Please add an address before proceeding to payment.</Text>
              </View>
            )}
          </>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.addressCard, selectedAddressId === item.id && styles.selectedAddressCard]}
            onPress={() => handleAddressSelect(item.id)}
          >
            <View style={styles.addressHeader}>
              <View style={[styles.addressType, { backgroundColor: getAddressTypeColor(item.type) }]}>
                <Text style={styles.addressTypeText}>{item.type}</Text>
              </View>
            </View>
            <Text style={styles.addressName}>{item.name}</Text>
            <Text style={styles.addressPhone}>{item.phone}</Text>
            <Text style={styles.addressDetails}>{item.address}, {item.city}, {item.state} - {item.pincode}</Text>
            {selectedAddressId === item.id && (
              <View style={styles.selectedIndicator}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.selectedText}>Selected</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {/* Bottom Action Button */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity 
          style={[styles.proceedButton, (!selectedAddressId) && { opacity: 0.6 }]}
          onPress={handleProceedToSlot}
          disabled={!selectedAddressId}
        >
          <Text style={styles.proceedButtonText}>Proceed to Payment</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 20 },
  backButton: { padding: 8 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  placeholder: { width: 40 },
  scrollContainer: { flex: 1, paddingHorizontal: 20 },
  addAddressButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 20 },
  addAddressText: { marginLeft: 12, fontSize: 16, fontWeight: '600', color: '#8B5CF6' },
  addAddressForm: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 20 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  typeSelection: { flexDirection: 'row', marginBottom: 20 },
  typeButton: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginHorizontal: 4, alignItems: 'center' },
  typeButtonActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  typeButtonText: { color: '#666', fontWeight: '500' },
  typeButtonTextActive: { color: 'white' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 16, fontSize: 16, color: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { width: '48%' },
  formActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelButton: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginRight: 10, alignItems: 'center' },
  cancelButtonText: { color: '#666', fontSize: 16, fontWeight: '500' },
  saveButton: { flex: 1, paddingVertical: 12, backgroundColor: '#8B5CF6', borderRadius: 8, alignItems: 'center' },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '500' },
  sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  addressCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: 'transparent' },
  selectedAddressCard: { borderColor: '#8B5CF6', backgroundColor: '#f8f9ff' },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addressType: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  addressTypeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  addressName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  addressPhone: { fontSize: 14, color: '#666', marginBottom: 8 },
  addressDetails: { fontSize: 14, color: '#666', lineHeight: 20 },
  selectedIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  selectedText: { marginLeft: 8, color: '#4CAF50', fontWeight: '600' },
  bottomButtonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  proceedButton: { backgroundColor: '#007AFF', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  proceedButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});

export default AddressSelectionScreen;
