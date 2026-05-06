import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useIsFocused } from '@react-navigation/native';
import { getTickets } from '../utils/appState';
import { moderateScale } from '../utils/responsive';

const TicketsListScreen = () => {
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    if (isFocused) setTickets(getTickets());
  }, [isFocused]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={tickets}
        keyExtractor={t => String(t.id)}
        renderItem={({ item }) => (
          <View style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={{flex:1}}>
              <Text style={[styles.ticketId, { color: colors.textSecondary }]}>{item.id}</Text>
              <Text style={[styles.ticketTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.ticketMeta, { color: colors.textSecondary }]}>{item.category}</Text>
            </View>
            <View style={styles.badgeBlue}><Text style={styles.badgeBlueText}>{item.status}</Text></View>
          </View>
        )}
        contentContainerStyle={{ padding: moderateScale(20), paddingBottom: moderateScale(120) }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1960' },
  ticketCard: { backgroundColor:'#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16), marginBottom: moderateScale(12), flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  ticketId: { color:'#8fa6ff', fontSize: moderateScale(12), fontWeight:'600' },
  ticketTitle: { color:'#111827', fontWeight:'700', marginTop: moderateScale(6), fontSize: moderateScale(14) },
  ticketMeta: { color:'#6B7280', marginTop: moderateScale(4), fontSize: moderateScale(12) },
  badgeBlue: { backgroundColor:'#e6edff', paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(6), borderRadius: moderateScale(12) },
  badgeBlueText: { color:'#3B5BFD', fontWeight:'700' },
});

export default TicketsListScreen;
