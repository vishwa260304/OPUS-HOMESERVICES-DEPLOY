import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, LayoutChangeEvent, ScrollView, Share } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import BackButton from '../components/BackButton';
import { moderateScale } from '../utils/responsive';
import LineChart from '../components/LineChart';
import { Ionicons } from '@expo/vector-icons';
import { PinchGestureHandler, State as GestureState } from 'react-native-gesture-handler';

const WeeklyChartScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params as any) || {};
  const modeDefault = params.mode || 'weekly';
  const [mode, setMode] = useState<'weekly' | 'monthly'>(modeDefault);
  const weeklyData = params.weeklyData || [450, 620, 580, 520, 900, 650, 700];
  const weeklyLabels = params.weeklyLabels || ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const monthlyData = params.monthlyData || [1600, 2200, 2600, 1800];
  const monthlyLabels = params.monthlyLabels || ['Week 1','Week 2','Week 3','Week 4'];
  const maxYWeekly = params.maxYWeekly || 1000;
  const maxYMonthly = params.maxYMonthly || 3000;
  const titleWeekly = params.titleWeekly || 'Weekly Earnings';
  const titleMonthly = params.titleMonthly || 'Monthly Breakdown';
  const data = mode === 'weekly' ? weeklyData : monthlyData;
  const labels = mode === 'weekly' ? weeklyLabels : monthlyLabels;
  const maxY = mode === 'weekly' ? maxYWeekly : maxYMonthly;
  const title = mode === 'weekly' ? titleWeekly : titleMonthly;

  const [baseWidth, setBaseWidth] = useState(0);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [cursorIdx, setCursorIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const pinchScaleRef = useRef(1);
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(7);

  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    if (!baseWidth) setBaseWidth(width);
  }, [baseWidth]);

  const innerWidth = useMemo(() => (baseWidth ? baseWidth * zoom : 0), [baseWidth, zoom]);
  const onChartLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setChartSize({ width, height });
  }, []);

  const stepX = useMemo(() => (data.length > 1 ? chartSize.width / (data.length - 1) : 0), [chartSize.width, data.length]);

  const handleTouch = useCallback((evt: any) => {
    if (!chartSize.width) return;
    const x = evt.nativeEvent.locationX;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(x / stepX)));
    setCursorIdx(idx);
  }, [chartSize.width, data.length, stepX]);

  const selected = cursorIdx != null ? { idx: cursorIdx, label: labels[cursorIdx], value: data[cursorIdx] } : null;
  const cursorPos = useMemo(() => {
    if (cursorIdx == null) return null;
    const x = stepX * cursorIdx;
    const y = chartSize.height * (1 - Math.min(1, (data[cursorIdx] || 0) / maxY));
    return { x, y };
  }, [cursorIdx, stepX, chartSize.height, data, maxY]);

  const onZoomIn = () => setZoom((z)=> Math.min(4, +(z + 0.25).toFixed(2)));
  const onZoomOut = () => setZoom((z)=> Math.max(1, +(z - 0.25).toFixed(2)));
  const onShare = async () => {
    const total = data.reduce((a: number, b: number)=>a+(b||0),0);
    const avg = data.length ? Math.round(total / data.length) : 0;
    const lines = [
      'Label,Amount',
      ...labels.map((l: string, i: number)=> `${l},${data[i]}`),
      `Total,${total}`,
      `Average,${avg}`,
    ];
    try { await Share.share({ message: lines.join('\n') }); } catch {}
  };

  const appliedData = useMemo(() => {
    if (mode === 'weekly') {
      const take = Math.min(rangeDays, weeklyData.length);
      return weeklyData.slice(weeklyData.length - take);
    }
    return monthlyData;
  }, [mode, rangeDays, weeklyData, monthlyData]);

  const appliedLabels = useMemo(() => {
    if (mode === 'weekly') {
      const take = Math.min(rangeDays, weeklyLabels.length);
      return weeklyLabels.slice(weeklyLabels.length - take);
    }
    return monthlyLabels;
  }, [mode, rangeDays, weeklyLabels, monthlyLabels]);

  const totalSoFar = useMemo(() => (cursorIdx != null ? appliedData.slice(0, cursorIdx + 1).reduce((a: number, b: number)=>a+(b||0),0) : null), [cursorIdx, appliedData]);
  const avgSoFar = useMemo(() => (cursorIdx != null && cursorIdx >= 0 ? Math.round((totalSoFar || 0) / (cursorIdx + 1)) : null), [cursorIdx, totalSoFar]);

  const onPinchEvent = ({ nativeEvent }: any) => {
    pinchScaleRef.current = nativeEvent.scale;
  };
  const onPinchStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === GestureState.END || nativeEvent.state === GestureState.CANCELLED) {
      setZoom((z) => {
        const next = Math.max(1, Math.min(4, +(z * pinchScaleRef.current).toFixed(2)));
        return next;
      });
      pinchScaleRef.current = 1;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <BackButton style={styles.backBtn} color="#ffffff" size={moderateScale(22)} />
        <Text style={styles.title}>{title}</Text>
        <View style={styles.segmentWrap}>
          <TouchableOpacity onPress={()=>setMode('weekly')} style={[styles.segmentBtn, mode==='weekly' && styles.segmentBtnActive]}>
            <Text style={[styles.segmentText, mode==='weekly' && styles.segmentTextActive]}>Weekly</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>setMode('monthly')} style={[styles.segmentBtn, mode==='monthly' && styles.segmentBtnActive]}>
            <Text style={[styles.segmentText, mode==='monthly' && styles.segmentTextActive]}>Monthly</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onZoomOut} style={styles.roundBtn}><Text style={styles.roundBtnText}>-</Text></TouchableOpacity>
          <TouchableOpacity onPress={onZoomIn} style={styles.roundBtn}><Text style={styles.roundBtnText}>+</Text></TouchableOpacity>
          <TouchableOpacity onPress={onShare} style={styles.shareBtn}>
            <Ionicons name="share-outline" size={moderateScale(18)} color="#ffffff" />
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chartWrap} onLayout={onContentLayout}>
        <ScrollView horizontal bounces showsHorizontalScrollIndicator={false}>
          <View style={{ width: innerWidth }}>
            <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchStateChange}>
              <View>
                <LineChart
                  data={appliedData}
                  labels={appliedLabels}
                  height={moderateScale(260)}
                  maxY={maxY}
                  strokeColor={'#00E0FF'}
                  dotColor={'#00E0FF'}
                  gridColor={'#1f2a6b'}
                  yTickCount={5}
                  width={innerWidth || undefined}
                />
                <View
                  style={styles.touchOverlay}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={handleTouch}
                  onResponderMove={handleTouch}
                  onLayout={onChartLayout}
                >
                  {cursorPos && (
                    <>
                      <View style={[styles.cursorLine, { left: cursorPos.x }]} />
                      <View style={[styles.cursorDot, { left: cursorPos.x - 5, top: cursorPos.y - 5 }]} />
                      {selected && (
                        <View style={[styles.tooltip, { left: Math.min(Math.max(8, cursorPos.x - 70), Math.max(8, chartSize.width - 140)), top: Math.max(8, cursorPos.y - 60) }]}>
                          <Text style={styles.tooltipTitle}>{selected.label}</Text>
                          <Text style={styles.tooltipValue}>₹{selected.value}</Text>
                          {totalSoFar != null && avgSoFar != null && (
                            <Text style={styles.tooltipMeta}>Total: ₹{totalSoFar}   Avg: ₹{avgSoFar}</Text>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </View>
              </View>
            </PinchGestureHandler>
          </View>
        </ScrollView>
      </View>

      {mode === 'weekly' && (
        <View style={styles.rangeRow}>
          <Text style={styles.rangeLabel}>Range:</Text>
          {[7,14,30].map((d)=> (
            <TouchableOpacity key={d} onPress={()=>setRangeDays(d as 7|14|30)} style={[styles.rangeBtn, rangeDays===d && styles.rangeBtnActive]}>
              <Text style={[styles.rangeBtnText, rangeDays===d && styles.rangeBtnTextActive]}>{d} days</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0A0F4A', padding: moderateScale(16) },
  headerRow: { flexDirection:'row', alignItems:'center', marginBottom: moderateScale(12) },
  backBtn: { marginRight: moderateScale(8) },
  title: { color:'#ffffff', fontWeight:'800', fontSize: moderateScale(20) },
  segmentWrap: { marginLeft: moderateScale(12), flexDirection:'row', backgroundColor:'#1a2a6b', borderRadius:12, overflow:'hidden' },
  segmentBtn: { paddingVertical:6, paddingHorizontal:12 },
  segmentBtnActive: { backgroundColor:'#e6e8ff' },
  segmentText: { color:'#cfe0ff', fontWeight:'700' },
  segmentTextActive: { color:'#0b1960' },
  headerActions: { marginLeft:'auto', flexDirection:'row', alignItems:'center', columnGap: 10 },
  roundBtn: { width:28, height:28, borderRadius:14, backgroundColor:'#1a2a6b', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'#2a3e85' },
  roundBtnText: { color:'#ffffff', fontWeight:'900' },
  shareBtn: { flexDirection:'row', alignItems:'center', backgroundColor:'#3b5bfd', borderRadius:12, paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:'#4a66ff' },
  shareText: { color:'#ffffff', fontWeight:'700', marginLeft:6 },
  chartWrap: { backgroundColor:'#0c1c5a', borderRadius: moderateScale(16), padding: moderateScale(16), borderWidth:1, borderColor:'#1e2d70', position:'relative' },
  touchOverlay: { position:'absolute', left: moderateScale(16), right: moderateScale(16), top: moderateScale(16), bottom: moderateScale(16) },
  cursorLine: { position:'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(0,224,255,0.7)' },
  cursorDot: { position:'absolute', width:10, height:10, borderRadius:5, backgroundColor:'#00E0FF' },
  tooltip: { position:'absolute', width: 140, backgroundColor:'#0a1a4a', borderWidth:1, borderColor:'#1e2d70', borderRadius:10, padding:8 },
  tooltipTitle: { color:'#cfe0ff', fontSize:12 },
  tooltipValue: { color:'#ffffff', fontWeight:'800', marginTop:2 },
  tooltipMeta: { color:'#88a0ff', marginTop:2, fontSize:12 },
  rangeRow: { marginTop: moderateScale(12), flexDirection:'row', alignItems:'center' },
  rangeLabel: { color:'#cfe0ff', marginRight: 8 },
  rangeBtn: { paddingVertical:6, paddingHorizontal:10, borderRadius:10, borderWidth:1, borderColor:'#2a3e85', marginRight: 8 },
  rangeBtnActive: { backgroundColor:'#e6e8ff', borderColor:'#e6e8ff' },
  rangeBtnText: { color:'#cfe0ff', fontWeight:'700' },
  rangeBtnTextActive: { color:'#0b1960' },
});

export default WeeklyChartScreen;


