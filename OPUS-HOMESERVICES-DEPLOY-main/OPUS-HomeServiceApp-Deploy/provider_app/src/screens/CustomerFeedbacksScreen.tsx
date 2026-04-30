import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, Modal, StatusBar, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { moderateScale } from '../utils/responsive';
import { getFeedbacks, generateDummyFeedbacks, type Feedback } from '../utils/appState';

type SortKey = 'newest' | 'oldest' | 'high' | 'low';

const CustomerFeedbacksScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sortOpen, setSortOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useMemo(() => {
    const list = getFeedbacks();
    const sorted = [...list].sort((a, b) => {
      if (sortKey === 'newest') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortKey === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortKey === 'high') return b.rating - a.rating;
      return a.rating - b.rating;
    });
    return sorted;
  }, [sortKey, refreshKey]);
  const [refreshing, setRefreshing] = useState(false);

  const addDummy = () => { generateDummyFeedbacks(5); setRefreshKey(x => x + 1); };

  const renderItem = ({ item }: any) => (
    <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}> 
      <View style={styles.rowBetween}>
        <Text style={[styles.name, { color: colors.text }]}>{item.customerName}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={moderateScale(14)} color="#F5B700" />
          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
        </View>
      </View>
      <Text style={[styles.comment, { color: colors.textSecondary }]}>{item.comment}</Text>
      <Text style={[styles.date, { color: colors.textSecondary }]}>{new Date(item.date).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ height: (insets.top || 0) + moderateScale(4) }} />
      <LinearGradient colors={['#004c8f', '#0c1a5d']} start={{ x:0, y:0 }} end={{ x:0, y:1 }} style={styles.headerGradient}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.headerRow, { justifyContent:'space-between' }]}>
          <View style={{ flexDirection:'row', alignItems:'center' }}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85} style={[styles.backBtn, { backgroundColor:'rgba(255,255,255,0.18)', borderRadius: 12 }]}>
              <Ionicons name="chevron-back" size={moderateScale(20)} color="#ffffff" />
            </TouchableOpacity>
            <Text style={[styles.title, { color: '#ffffff' }]}>Customer Feedbacks</Text>
          </View>
          <TouchableOpacity onPress={() => setSortOpen(true)} activeOpacity={0.85}>
            <Ionicons name="filter" size={moderateScale(20)} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: moderateScale(16), paddingBottom: moderateScale(100) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{ setRefreshing(true); setTimeout(()=>{ setRefreshKey(k=>k+1); setRefreshing(false); }, 400); }} />}
        ListEmptyComponent={<Text style={{ textAlign:'center', marginTop: moderateScale(20), color: colors.textSecondary }}>No feedback yet</Text>}
      />

      

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sort by</Text>
            {([
              { k: 'newest', label: 'Date: Newest' },
              { k: 'oldest', label: 'Date: Oldest' },
              { k: 'high', label: 'Rating: High to Low' },
              { k: 'low', label: 'Rating: Low to High' },
            ] as any[]).map((o) => (
              <TouchableOpacity key={o.k} style={styles.sortItem} onPress={() => { setSortKey(o.k); setSortOpen(false); }}>
                <Text style={[styles.sortText, { color: colors.text }]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.outlineBtn]} onPress={() => setSortOpen(false)}>
              <Text style={styles.outlineBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex:1 },
  headerRow: { flexDirection:'row', alignItems:'center' },
  headerGradient: { borderRadius: moderateScale(14), paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(10), marginBottom: moderateScale(8) },
  backBtn: { padding: 8, marginRight: 6 },
  title: { fontWeight:'800', fontSize: moderateScale(18) },
  item: { borderRadius: moderateScale(14), padding: moderateScale(14), marginBottom: moderateScale(12) },
  rowBetween: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  name: { fontWeight:'800' },
  ratingRow: { flexDirection:'row', alignItems:'center' },
  ratingText: { marginLeft: 6, fontWeight:'800' },
  comment: { marginTop: 6 },
  date: { marginTop: 6, fontSize: moderateScale(12) },
  footerBar: { position:'absolute', left: 0, right: 0, bottom: 0, padding: moderateScale(12), backgroundColor:'transparent' },
  primaryBtn: { backgroundColor: '#3B5BFD', paddingVertical: moderateScale(12), borderRadius: moderateScale(12), alignItems:'center' },
  primaryBtnText: { color:'#ffffff', fontWeight:'800' },
  modalBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', alignItems:'center', justifyContent:'center', padding: moderateScale(20) },
  modalCard: { width:'100%', borderRadius: moderateScale(16), padding: moderateScale(16) },
  modalTitle: { fontWeight:'900', fontSize: moderateScale(16), marginBottom: moderateScale(10) },
  sortItem: { paddingVertical: moderateScale(10) },
  sortText: { fontWeight:'800' },
  outlineBtn: { marginTop: moderateScale(8), borderColor: '#3B5BFD', borderWidth: 1, paddingVertical: moderateScale(10), borderRadius: moderateScale(12), alignItems:'center' },
  outlineBtnText: { color:'#3B5BFD', fontWeight:'800' },
});

export default CustomerFeedbacksScreen;


