import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser, UserAddress } from '../../context/UserContext';

type SavedAddress = UserAddress & { id: string; tag?: string };

const SAVED_KEY = 'user_saved_addresses';

export default function SelectLocationScreen() {
  const router = useRouter();
  const { address, setAddress, setLocation } = useUser();
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState<SavedAddress[]>([]);

  const loadSaved = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_KEY);
      const list: SavedAddress[] = raw ? JSON.parse(raw) : [];
      setSaved(list);
    } catch {}
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const handleSelect = async (item: SavedAddress) => {
    await setAddress(item);
    await setLocation(item.label);
    try { await AsyncStorage.setItem('user_address_confirmed', 'true'); } catch {}
    router.replace('/(tabs)');
  };

  const handleShare = async (item: SavedAddress) => {
    try {
      const text = item.fullText || [item.streetLine, item.area, item.city, item.postalCode].filter(Boolean).join(', ');
      await Share.share({ message: text || item.label });
    } catch {}
  };

  const renderSaved = ({ item }: { item: SavedAddress }) => {
    const isSelected = !!address && item.label === address.label;
    return (
      <View style={styles.savedItem}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons name="business-outline" size={18} color="#111827" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.savedTitle}>{item.tag || 'Work'}</Text>
              <Text style={styles.savedDot}> • </Text>
              <Text style={styles.savedDistance}>1 m</Text>
              {isSelected && <Text style={styles.badge}>Selected</Text>}
            </View>
            <Text numberOfLines={1} style={styles.savedAddress}>
              {item.fullText || [item.streetLine, item.area, item.city, item.postalCode].filter(Boolean).join(', ')}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => handleShare(item)} style={{ padding: 6 }}>
            <Ionicons name="share-outline" size={18} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleSelect(item)} style={{ padding: 6 }}>
            <Ionicons name="ellipsis-vertical" size={18} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Location</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginHorizontal: 10 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Address"
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/location/fetching')}>
        <View style={styles.actionIconWrap}>
          <Ionicons name="navigate" size={16} color="#DC1454" />
        </View>
        <Text style={styles.actionText}>Use my Current Location</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/location/new')}>
        <View style={[styles.actionIconWrap, { backgroundColor: '#ffe4ea' }] }>
          <Ionicons name="add" size={18} color="#DC1454" />
        </View>
        <Text style={styles.actionText}>Add New Address</Text>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      {/* Saved */}
      <Text style={styles.savedHeading}>Saved Addresses</Text>
      <FlatList
        data={saved}
        keyExtractor={(it) => it.id}
        renderItem={renderSaved}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No saved addresses</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#111827' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    height: 48,
    marginHorizontal: 16,
    paddingRight: 12,
  },
  searchInput: { flex: 1, height: '100%', color: '#111827', fontWeight: '600' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  actionIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ffe7ee', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  actionText: { color: '#DC1454', fontWeight: '800', fontSize: 16 },

  savedHeading: { marginTop: 18, marginBottom: 8, marginHorizontal: 16, fontSize: 16, fontWeight: '800', color: '#111827' },
  savedItem: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  savedTitle: { fontWeight: '900', color: '#111827' },
  savedDot: { color: '#9CA3AF', marginHorizontal: 4 },
  savedDistance: { color: '#9CA3AF', fontWeight: '700' },
  badge: { marginLeft: 8, backgroundColor: '#DCFCE7', color: '#166534', fontWeight: '800', fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  savedAddress: { color: '#6B7280', fontWeight: '600', marginTop: 4 },
  emptyText: { color: '#9CA3AF', textAlign: 'center', marginTop: 20 },
});