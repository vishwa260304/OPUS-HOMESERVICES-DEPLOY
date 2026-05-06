import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { getBookings, getSelectedSector } from '../utils/appState';

const TasksCompletedTodayScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const todayIso = new Date().toISOString();
  const isSameDay = (aIso: string, bIso: string) => {
    const a = new Date(aIso); const b = new Date(bIso);
    return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  };

  const list = useMemo(() => {
    return getBookings().filter(b => b.status === 'Completed' && isSameDay(b.createdAt, todayIso));
  }, [tick]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const sectorPrimary = '#3B5BFD';
  const sectorGradient: [string, string] = (getSelectedSector?.() === 'healthcare') ? ['#0BB48F', '#0A8F6A'] : ['#004c8f', '#0c1a5d'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: (insets.top || 0) + moderateScale(4) }]}> 
      <LinearGradient colors={sectorGradient} start={{ x:0, y:0 }} end={{ x:0, y:1 }} style={styles.headerGradient}>
        <StatusBar barStyle="light-content" />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor:'rgba(255,255,255,0.18)', borderRadius: 12 }]}><Ionicons name="chevron-back" size={20} color="#ffffff" /></TouchableOpacity>
          <Text style={[styles.title, { color: '#ffffff' }]}>Tasks Completed Today</Text>
        </View>
      </LinearGradient>

      {list.length === 0 ? (
        <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card, borderWidth: 1 }]}> 
          <Ionicons name="checkmark-done-circle-outline" size={28} color={sectorPrimary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No completed tasks yet</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Once you complete jobs, they appear here instantly.</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex:1 }}
          data={list}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: moderateScale(16), paddingBottom: moderateScale(40) }}
          renderItem={({ item }) => (
            <View style={[styles.taskItem, styles.cardShadow, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}> 
              <View style={{ flex: 1 }}>
                <Text style={[styles.taskTitle, { color: colors.text }]}>{item.serviceName}</Text>
                <Text style={[styles.taskMeta, { color: colors.textSecondary }]}>{item.customerName} · {item.location}</Text>
              </View>
              <Text style={[styles.amount, { color: sectorPrimary }]}>₹{item.amount}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection:'row', alignItems:'center' },
  backBtn: { padding: 8, marginRight: 6 },
  title: { fontSize: moderateScale(18), fontWeight:'800' },
  headerGradient: { borderRadius: 14, paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(10), marginBottom: moderateScale(8) },
  empty: { margin: moderateScale(16), borderRadius: moderateScale(16), padding: moderateScale(16), alignItems:'flex-start' },
  emptyTitle: { fontWeight:'800', marginTop: 8, fontSize: moderateScale(15) },
  emptySub: { marginTop: 6 },
  taskItem: { padding: moderateScale(14), borderRadius: moderateScale(14), flexDirection:'row', alignItems:'center', marginBottom: moderateScale(10) },
  taskTitle: { fontWeight:'800' },
  taskMeta: { marginTop: 4 },
  amount: { fontWeight:'900' },
  cardShadow: { shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, shadowOffset:{ width:0, height:4 }, elevation:2 },
});

export default TasksCompletedTodayScreen;


