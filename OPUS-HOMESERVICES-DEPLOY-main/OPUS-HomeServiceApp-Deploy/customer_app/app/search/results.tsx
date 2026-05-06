import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HomeServicesApi, HomeServiceRow, getSupabaseImageUrl as getHomeImage } from '../../lib/homeServices';
import { ApplianceServicesApi, ApplianceServiceRow, getSupabaseImageUrl as getApplianceImage } from '../../lib/applianceServices';
import { AutomobileServicesApi, AutomobileServiceRow, getSupabaseImageUrl as getAutoImage } from '../../lib/automobileServices';

type UnifiedResult = {
  id: string;
  title: string;
  sectionTitle: string;
  category: string;
  price?: string | null;
  time?: string | null;
  rating?: string | null;
  reviews?: number | null;
  imageUrl?: string | null;
  source: 'home' | 'appliance' | 'automobile';
};

const { width } = Dimensions.get('window');

export default function SearchResultsScreen() {
  const params = useLocalSearchParams<{ query?: string }>();
  const initialQuery = (params?.query || '').toString();
  const router = useRouter();

  const [query, setQuery] = useState<string>(initialQuery);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<UnifiedResult[]>([]);
  const [allData, setAllData] = useState<{ home: HomeServiceRow[]; appliance: ApplianceServiceRow[]; automobile: AutomobileServiceRow[] }>({ home: [], appliance: [], automobile: [] });

  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      setLoading(true);
      try {
        const [home, appliance, automobile] = await Promise.all([
          HomeServicesApi.list(),
          ApplianceServicesApi.list(),
          AutomobileServicesApi.list(),
        ]);
        if (!mounted) return;
        setAllData({ home, appliance, automobile });
      } catch (e) {
        // swallow
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadAll();
    return () => { mounted = false; };
  }, []);

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);

  useEffect(() => {
    const q = normalizedQuery;
    if (q.length === 0) {
      setResults([]);
      return;
    }
    const matches: UnifiedResult[] = [];

    for (const row of allData.home) {
      const hay = `${row.title} ${row.section_title} ${row.category}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: `home-${row.id}`,
          title: row.title,
          sectionTitle: row.section_title,
          category: row.category,
          price: row.price,
          time: row.time,
          rating: row.rating,
          reviews: row.reviews ?? null,
          imageUrl: getHomeImage(row.image_path),
          source: 'home',
        });
      }
    }

    for (const row of allData.appliance) {
      const hay = `${row.title} ${row.section_title} ${row.category}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: `appliance-${row.id}`,
          title: row.title,
          sectionTitle: row.section_title,
          category: row.category,
          price: row.price,
          time: row.time,
          rating: row.rating,
          reviews: row.reviews ?? null,
          imageUrl: getApplianceImage(row.image_path),
          source: 'appliance',
        });
      }
    }

    for (const row of allData.automobile) {
      const hay = `${row.title} ${row.section_title} ${row.category}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: `automobile-${row.id}`,
          title: row.title,
          sectionTitle: row.section_title,
          category: row.category,
          price: row.price,
          time: row.time,
          rating: row.rating,
          reviews: row.reviews ?? null,
          imageUrl: getAutoImage(row.image_path),
          source: 'automobile',
        });
      }
    }

    setResults(matches);
  }, [normalizedQuery, allData]);

  const renderItem = ({ item }: { item: UnifiedResult }) => (
    <TouchableOpacity activeOpacity={0.85} style={styles.card}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, { backgroundColor: '#E5E7EB' }]} />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{item.sectionTitle} • {item.category}</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.cardPrice}>{item.price || '—'}</Text>
          <Text style={styles.cardTime}>{item.time || ''}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={['#050341ff', '#1E3A8A', '#1818ecff']} style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Search</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#ccc" style={{ marginHorizontal: 10 }} />
        <TextInput
          placeholder="Search services..."
          placeholderTextColor="#ccc"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <View style={{ paddingTop: 30 }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10 }}
          renderItem={renderItem}
          ListEmptyComponent={() => (
            <Text style={{ color: '#fff', textAlign: 'center', marginTop: 30 }}>No results</Text>
          )}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginLeft: 6 },
  searchBar: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 30, paddingVertical: 8, alignItems: 'center', marginTop: 10, marginHorizontal: 15, paddingHorizontal: 6 },
  searchInput: { flex: 1, color: '#333', fontSize: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  cardImage: { width: '100%', height: 140 },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  cardMeta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cardPrice: { fontSize: 13, fontWeight: '700', color: '#111827' },
  cardTime: { fontSize: 12, color: '#6B7280' },
});


