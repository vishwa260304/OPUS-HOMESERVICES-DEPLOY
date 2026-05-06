import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Switch, Modal, TextInput, StatusBar, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getAvailability, setAvailability, DayKey, AvailabilityState, getSelectedSector } from '../utils/appState';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { moderateScale } from '../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AvailabilityScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<AvailabilityState>(() => getAvailability());
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerFor, setPickerFor] = useState<{ day?: DayKey; field?: 'start' | 'end' | 'breakStart' | 'breakEnd' } | null>(null);
  const [inputHour, setInputHour] = useState<string>('09');
  const [inputMinute, setInputMinute] = useState<string>('00');
  // 24-hour entry
  const [distance, setDistance] = useState<number>(getAvailability().maxDistanceKm || 10);
  const [refreshing, setRefreshing] = useState(false);
  const isHealthcare = (getSelectedSector?.() === 'healthcare');
  const sectorPrimary = isHealthcare ? '#0AAE8A' : '#3B5BFD';
  const softBg = isHealthcare ? 'rgba(10,174,138,0.10)' : 'rgba(59,91,253,0.10)';

  const TIMES_30: string[] = useMemo(() => {
    const arr: string[] = [];
    for (let h = 0; h < 24; h += 1) {
      for (let m = 0; m < 60; m += 30) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        arr.push(`${hh}:${mm}`);
      }
    }
    return arr;
  }, []);

  const clamp24 = (hStr: string, mStr: string): string => {
    let h = parseInt(hStr || '0', 10);
    let m = parseInt(mStr || '0', 10);
    if (isNaN(h)) h = 0; if (isNaN(m)) m = 0;
    h = Math.max(0, Math.min(23, h));
    m = Math.max(0, Math.min(59, m));
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('app.availability.v1');
        if (raw) {
          const parsed: AvailabilityState = JSON.parse(raw);
          setState(parsed);
          setDistance(parsed.maxDistanceKm || 10);
          return;
        }
      } catch {}
      setState(getAvailability());
      setDistance(getAvailability().maxDistanceKm || 10);
    })();
  }, []);

  const openPicker = (day: DayKey | undefined, field: 'start' | 'end' | 'breakStart' | 'breakEnd') => {
    setPickerFor({ day, field });
    // seed inputs from current value
    const current = field === 'breakStart' ? (state.breaks[0]?.start || '13:00')
      : field === 'breakEnd' ? (state.breaks[0]?.end || '14:00')
      : day ? state.days[day][field] : '09:00';
    const [hh, mm] = current.split(':');
    setInputHour(hh);
    setInputMinute(mm);
    setPickerVisible(true);
  };

  const applyPickedTime = (value: string) => {
    if (!pickerFor) return;
    if (pickerFor.field === 'breakStart' || pickerFor.field === 'breakEnd') {
      const next = { ...state };
      if (!next.breaks[0]) next.breaks = [{ start: value, end: value }];
      if (pickerFor.field === 'breakStart') next.breaks[0].start = value;
      if (pickerFor.field === 'breakEnd') next.breaks[0].end = value;
      setState(next);
    } else if (pickerFor.day && pickerFor.field) {
      const next = { ...state, days: { ...state.days, [pickerFor.day]: { ...state.days[pickerFor.day], [pickerFor.field]: value } } } as AvailabilityState;
      setState(next);
    }
    setPickerVisible(false);
    setPickerFor(null);
  };

  const applyManual = () => {
    const v = clamp24(inputHour, inputMinute);
    applyPickedTime(v);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ height: (insets.top || 0) + moderateScale(4) }} />
      <LinearGradient colors={(getSelectedSector?.() === 'healthcare') ? ['#0BB48F', '#0A8F6A'] : ['#004c8f', '#0c1a5d']} start={{ x:0, y:0 }} end={{ x:0, y:1 }} style={styles.headerGradient}>
        <StatusBar barStyle="light-content" />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.85} style={[styles.backBtn, { backgroundColor:'rgba(255,255,255,0.18)', borderRadius: 12 }]}>
            <Ionicons name="chevron-back" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Text style={[styles.title, { color: '#ffffff' }]}>My Availability</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: moderateScale(32) }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          setTimeout(() => setRefreshing(false), 400);
        }} />}
      >
        <Text style={[styles.sub, { color: colors.textSecondary }]}>Set your working days and hours</Text>

        {/* Quick presets */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}> 
          <Text style={[styles.cardTitle, { color: colors.text }]}>Quick presets</Text>
          <View style={styles.rowWrap}>
            <TouchableOpacity style={[styles.chip, { backgroundColor: softBg }]} activeOpacity={0.9} onPress={() => setState({ ...state, days: { Mon: { enabled: true, start: '09:00', end: '18:00' }, Tue: { enabled: true, start: '09:00', end: '18:00' }, Wed: { enabled: true, start: '09:00', end: '18:00' }, Thu: { enabled: true, start: '09:00', end: '18:00' }, Fri: { enabled: true, start: '09:00', end: '18:00' }, Sat: state.days.Sat, Sun: state.days.Sun } } as any)}>
              <Text style={[styles.chipText, { color: sectorPrimary }]}>Mon–Fri • 9am–6pm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, { backgroundColor: softBg }]} activeOpacity={0.9} onPress={() => setState({ ...state, days: { Mon: { enabled: true, start: '10:00', end: '20:00' }, Tue: { enabled: true, start: '10:00', end: '20:00' }, Wed: { enabled: true, start: '10:00', end: '20:00' }, Thu: { enabled: true, start: '10:00', end: '20:00' }, Fri: { enabled: true, start: '10:00', end: '20:00' }, Sat: { enabled: true, start: '10:00', end: '20:00' }, Sun: { enabled: true, start: '10:00', end: '20:00' } } } as any)}>
              <Text style={[styles.chipText, { color: sectorPrimary }]}>All days • 10am–8pm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, { backgroundColor: softBg }]} activeOpacity={0.9} onPress={() => setState({ ...state, days: { ...state.days, Sat: { enabled: true, start: '10:00', end: '18:00' }, Sun: { enabled: true, start: '10:00', end: '18:00' } } })}>
              <Text style={[styles.chipText, { color: sectorPrimary }]}>Weekends • 10am–6pm</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Per-day schedule */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}> 
          <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly schedule</Text>
          {(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as DayKey[]).map((d) => (
            <View key={d} style={styles.dayRow}>
              <Text style={[styles.dayLabel, { color: colors.text }]}>{d}</Text>
              <View style={styles.timeRange}> 
            <TouchableOpacity style={[styles.timeBtn, { backgroundColor: softBg }]} activeOpacity={0.9} onPress={() => openPicker(d, 'start')}>
              <Text style={[styles.timeBtnText, { color: sectorPrimary }]}>{state.days[d].start}</Text>
                </TouchableOpacity>
                <Text style={[styles.toText, { color: colors.textSecondary }]}>to</Text>
            <TouchableOpacity style={[styles.timeBtn, { backgroundColor: softBg }]} activeOpacity={0.9} onPress={() => openPicker(d, 'end')}>
              <Text style={[styles.timeBtnText, { color: sectorPrimary }]}>{state.days[d].end}</Text>
                </TouchableOpacity>
              </View>
              <Switch value={state.days[d].enabled} onValueChange={(v) => setState({ ...state, days: { ...state.days, [d]: { ...state.days[d], enabled: v } } })} />
            </View>
          ))}
          <View style={[styles.row, { justifyContent:'flex-end', marginTop: moderateScale(10) }]}>
            <TouchableOpacity style={styles.linkBtn} activeOpacity={0.9} onPress={() => {
              const first = state.days.Mon;
              const days: any = { ...state.days };
              (['Tue','Wed','Thu','Fri','Sat','Sun'] as DayKey[]).forEach(k => { days[k] = { ...first }; });
              setState({ ...state, days });
            }}>
              <Text style={[styles.linkBtnText, { color: sectorPrimary }]}>Copy Mon to all</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Breaks */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}> 
          <Text style={[styles.cardTitle, { color: colors.text }]}>Breaks</Text>
          <View style={styles.row}> 
            <TouchableOpacity style={[styles.timeBtn, { backgroundColor: softBg }]} activeOpacity={0.9} onPress={() => openPicker(undefined as any, 'breakStart')}>
              <Text style={[styles.timeBtnText, { color: sectorPrimary }]}>{state.breaks[0]?.start || '13:00'}</Text>
            </TouchableOpacity>
            <Text style={[styles.toText, { color: colors.textSecondary }]}>to</Text>
            <TouchableOpacity style={[styles.timeBtn, { backgroundColor: softBg }]} activeOpacity={0.9} onPress={() => openPicker(undefined as any, 'breakEnd')}>
              <Text style={[styles.timeBtnText, { color: sectorPrimary }]}>{state.breaks[0]?.end || '14:00'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.outlineSmall, { borderColor: sectorPrimary }]} activeOpacity={0.9}>
              <Text style={[styles.outlineSmallText, { color: sectorPrimary }]}>Add break</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Exceptions & vacation */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}> 
          <Text style={[styles.cardTitle, { color: colors.text }]}>Exceptions & Vacation</Text>
          <View style={styles.rowWrap}>
            <TouchableOpacity style={[styles.chip]} activeOpacity={0.9}>
              <Text style={styles.chipText}>Add off day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip]} activeOpacity={0.9}>
              <Text style={styles.chipText}>Add half day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip]} activeOpacity={0.9}>
              <Text style={styles.chipText}>Set vacation</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Auto-accept and radius */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}> 
          <Text style={[styles.cardTitle, { color: colors.text }]}>Auto-accept & Radius</Text>
          <View style={[styles.rowBetween]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Auto-accept jobs during working hours</Text>
            <Switch value={state.autoAccept} onValueChange={(v) => setState({ ...state, autoAccept: v })} />
          </View>
          <View style={[styles.rowBetween, { marginTop: moderateScale(12) }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Max travel distance</Text>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <TouchableOpacity style={[styles.roundBtn]} activeOpacity={0.9} onPress={() => { const v = Math.max(1, distance - 1); setDistance(v); setState({ ...state, maxDistanceKm: v }); }}>
                <Text style={styles.roundBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.timeBtnText, { marginHorizontal: moderateScale(8) }]}>{distance} km</Text>
              <TouchableOpacity style={[styles.roundBtn]} activeOpacity={0.9} onPress={() => { const v = Math.min(50, distance + 1); setDistance(v); setState({ ...state, maxDistanceKm: v }); }}>
                <Text style={styles.roundBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={[styles.row, { justifyContent:'flex-end', marginTop: moderateScale(10) }]}>
          <TouchableOpacity style={[styles.outlineBtn, { borderColor: sectorPrimary }]} activeOpacity={0.9} onPress={() => { setState(getAvailability()); setDistance(getAvailability().maxDistanceKm || 10); }}>
            <Text style={[styles.outlineBtnText, { color: sectorPrimary }]}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: sectorPrimary }]} activeOpacity={0.9} onPress={async () => { setAvailability(state); try { await AsyncStorage.setItem('app.availability.v1', JSON.stringify(state)); } catch {} }}>
            <Text style={styles.primaryBtnText}>Save changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Time picker modal - supports manual 24h entry and full list */}
      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerBackdrop}>
          <View style={[styles.pickerCard, { backgroundColor: colors.card }]}> 
            <Text style={[styles.cardTitle, { color: colors.text, marginBottom: moderateScale(10) }]}>Select time</Text>
            <View style={{ flexDirection:'row', alignItems:'center', columnGap: moderateScale(10) }}>
              <TextInput
                value={inputHour}
                onChangeText={(v)=> setInputHour(v.replace(/[^0-9]/g,'').slice(0,2))}
                keyboardType="number-pad"
                style={[styles.timeInput]}
                placeholder="HH"
                maxLength={2}
              />
              <Text style={{ fontWeight:'800' }}>:</Text>
              <TextInput
                value={inputMinute}
                onChangeText={(v)=> setInputMinute(v.replace(/[^0-9]/g,'').slice(0,2))}
                keyboardType="number-pad"
                style={[styles.timeInput]}
                placeholder="MM"
                maxLength={2}
              />
              <TouchableOpacity style={[styles.primaryBtn, { paddingVertical: moderateScale(10) }]} activeOpacity={0.9} onPress={applyManual}>
                <Text style={styles.primaryBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 240, marginTop: moderateScale(12) }}>
              {TIMES_30.map((t) => (
                <TouchableOpacity key={t} style={styles.pickerItem} activeOpacity={0.85} onPress={() => applyPickedTime(t)}>
                  <Text style={[styles.pickerItemText]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.outlineBtn, { marginTop: moderateScale(12) }]} activeOpacity={0.9} onPress={() => setPickerVisible(false)}>
              <Text style={styles.outlineBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: moderateScale(20) },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerGradient: { borderRadius: moderateScale(14), paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(10), marginBottom: moderateScale(8) },
  backBtn: { padding: 8, marginRight: 6 },
  title: { fontWeight: '800', fontSize: moderateScale(18), marginLeft: moderateScale(8) },
  sub: { marginTop: moderateScale(8) },
  card: { marginTop: moderateScale(16), borderRadius: moderateScale(16), padding: moderateScale(16) },
  cardTitle: { fontWeight: '800', fontSize: moderateScale(14), marginBottom: moderateScale(10) },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: moderateScale(10) },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(8) },
  chip: { paddingVertical: moderateScale(10), paddingHorizontal: moderateScale(12), borderRadius: moderateScale(12), backgroundColor: 'rgba(59,91,253,0.12)' },
  chipText: { color: '#3B5BFD', fontWeight: '800' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontWeight: '700' },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent:'space-between', paddingVertical: moderateScale(10) },
  dayLabel: { fontWeight: '800', width: moderateScale(40) },
  timeRange: { flexDirection: 'row', alignItems: 'center', columnGap: moderateScale(8), flex: 1, marginLeft: moderateScale(10) },
  timeBtn: { backgroundColor: 'rgba(59,91,253,0.10)', paddingVertical: moderateScale(8), paddingHorizontal: moderateScale(12), borderRadius: moderateScale(10) },
  timeBtnText: { color: '#3B5BFD', fontWeight: '800' },
  toText: { marginHorizontal: moderateScale(4) },
  outlineSmall: { borderColor: '#3B5BFD', borderWidth: 1, paddingVertical: moderateScale(8), paddingHorizontal: moderateScale(12), borderRadius: moderateScale(10), marginLeft: 'auto' },
  outlineSmallText: { color: '#3B5BFD', fontWeight: '800' },
  primaryBtn: { backgroundColor: '#3B5BFD', paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(16), borderRadius: moderateScale(12) },
  primaryBtnText: { color: '#ffffff', fontWeight: '800' },
  outlineBtn: { borderColor: '#3B5BFD', borderWidth: 1, paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(16), borderRadius: moderateScale(12) },
  outlineBtnText: { color: '#3B5BFD', fontWeight: '800' },
  linkBtn: { paddingVertical: moderateScale(8), paddingHorizontal: moderateScale(4) },
  linkBtnText: { color: '#3B5BFD', fontWeight: '800' },
  roundBtn: { width: moderateScale(32), height: moderateScale(32), borderRadius: moderateScale(16), backgroundColor: 'rgba(59,91,253,0.10)', alignItems:'center', justifyContent:'center' },
  roundBtnText: { color: '#3B5BFD', fontWeight: '900', fontSize: moderateScale(14) },
  pickerBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', alignItems:'center', justifyContent:'center', padding: moderateScale(20) },
  pickerCard: { width: '100%', borderRadius: moderateScale(16), padding: moderateScale(16) },
  pickerItem: { paddingVertical: moderateScale(12) },
  pickerItemText: { fontWeight: '800' },
  timeInput: { width: moderateScale(48), paddingVertical: moderateScale(8), paddingHorizontal: moderateScale(10), borderRadius: moderateScale(10), borderWidth: 1, borderColor: 'rgba(59,91,253,0.25)', textAlign: 'center', fontWeight:'800' },
  // AM/PM styles removed for 24h mode
});

export default AvailabilityScreen;


