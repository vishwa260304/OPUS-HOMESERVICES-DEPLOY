import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Circle, Line, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

type LineChartProps = {
  data: number[];
  labels?: string[];
  width?: number; // if not provided, fills parent width
  height?: number; // content height (not including padding)
  strokeColor?: string;
  strokeGradientFrom?: string;
  strokeGradientTo?: string;
  strokeWidth?: number;
  showDots?: boolean;
  dotColor?: string;
  gridColor?: string;
  maxY?: number; // optional fixed max for y axis scaling
  showArea?: boolean;
  areaGradientFrom?: string;
  areaGradientTo?: string;
  yTickCount?: number;
  interactive?: boolean;
  tension?: number; // 0 keeps peaks sharp (straight), 0.2 smoother
  valueFormatter?: (v: number) => string;
};

const LineChart: React.FC<LineChartProps> = ({
  data,
  labels,
  width,
  height = 160,
  strokeColor = '#3B5BFD',
  strokeGradientFrom,
  strokeGradientTo,
  strokeWidth = 2,
  showDots = true,
  dotColor = '#3B5BFD',
  gridColor = '#E5E7EB',
  maxY,
  showArea = true,
  areaGradientFrom = 'rgba(59,91,253,0.35)',
  areaGradientTo = 'rgba(59,91,253,0.02)',
  yTickCount = 3,
  interactive = true,
  tension = 0.12,
  valueFormatter,
}) => {
  const [layoutWidth, setLayoutWidth] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setLayoutWidth(e.nativeEvent.layout.width);
  }, []);
  const { points, containerHeight, containerWidth, yMax } = useMemo(() => {
    const safeData = data && data.length > 0 ? data : [0];
    const computedMax = typeof maxY === 'number' ? maxY : Math.max(...safeData);
    const yMax = computedMax === 0 ? 1 : computedMax;
    const h = height;
    const w = width ?? undefined; // fill parent if undefined
    const stepX = safeData.length > 1 ? 1 / (safeData.length - 1) : 0;
    const pts = safeData.map((v, i) => ({
      xPct: stepX * i,
      yPct: Math.max(0, Math.min(1, 1 - (v / yMax))), // Ensure yPct stays within 0-1 range
      value: v,
    }));
    return { points: pts, containerHeight: h, containerWidth: w, yMax };
  }, [data, width, height, maxY]);

  const polyPoints = useMemo(() => {
    if (points.length === 0) return '';
    return points.map(p => `${p.xPct * 100},${p.yPct * 100}`).join(' ');
  }, [points]);

  // Build a smooth Catmull-Rom to cubic Bezier path in 0..100 coordinates
  const smoothPath = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      const p = points[0];
      return `M ${p.xPct * 100} ${p.yPct * 100}`;
    }
    const pnts = points.map(p => ({ x: p.xPct * 100, y: p.yPct * 100 }));
    const path: string[] = [`M ${pnts[0].x} ${pnts[0].y}`];
    for (let i = 0; i < pnts.length - 1; i++) {
      const p0 = pnts[i - 1] || pnts[i];
      const p1 = pnts[i];
      const p2 = pnts[i + 1];
      const p3 = pnts[i + 2] || p2;
      const smoothing = Math.max(0, Math.min(0.35, tension));
      const cp1x = p1.x + (p2.x - p0.x) * smoothing;
      const cp1y = p1.y + (p2.y - p0.y) * smoothing;
      const cp2x = p2.x - (p3.x - p1.x) * smoothing;
      const cp2y = p2.y - (p3.y - p1.y) * smoothing;
      path.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
    }
    return path.join(' ');
  }, [points]);

  const areaPath = useMemo(() => {
    if (!smoothPath || points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const start = `M ${first.xPct * 100} ${first.yPct * 100}`;
    const baseStart = `L ${last.xPct * 100} 100 L ${first.xPct * 100} 100 Z`;
    // Replace initial 'M x y' in smoothPath with start to ensure correct concat
    return `${smoothPath} ${baseStart}`.replace(/^M [\d\.]+ [\d\.]+/, start);
  }, [smoothPath, points]);

  const handleTouchX = useCallback((xPx: number) => {
    if (!interactive || layoutWidth <= 0 || points.length === 0) return;
    const xPct = (xPx / layoutWidth) * 100;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].xPct * 100 - xPct);
      if (d < best) { best = d; nearest = i; }
    }
    setActiveIndex(nearest);
  }, [interactive, layoutWidth, points]);

  return (
    <View style={[styles.wrap, { height: containerHeight, width: containerWidth }]} onLayout={onLayout}
      onStartShouldSetResponder={() => interactive}
      onMoveShouldSetResponder={() => interactive}
      onResponderGrant={(e)=>handleTouchX(e.nativeEvent.locationX)}
      onResponderMove={(e)=>handleTouchX(e.nativeEvent.locationX)}
      onResponderRelease={()=>{ /* keep last active */ }}
    > 
      <Svg width="100%" height="100%" viewBox="0 -2 100 104" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={areaGradientFrom} />
            <Stop offset="1" stopColor={areaGradientTo} />
          </LinearGradient>
          {strokeGradientFrom && strokeGradientTo && (
            <LinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={strokeGradientFrom} />
              <Stop offset="1" stopColor={strokeGradientTo} />
            </LinearGradient>
          )}
        </Defs>
        {/* Grid */}
        {Array.from({ length: yTickCount + 1 }).map((_, i) => {
          const y = (i / yTickCount) * 100;
          return <Line key={`g-${i}`} x1="0" y1={`${y}`} x2="100" y2={`${y}`} stroke={gridColor} strokeWidth={0.5} />;
        })}
        {/* Area */}
        {showArea && areaPath ? (
          <Path d={areaPath} fill="url(#areaGrad)" />
        ) : null}
        {/* Smooth line */}
        {smoothPath ? (
          <Path 
            d={smoothPath} 
            fill="none" 
            stroke={strokeGradientFrom && strokeGradientTo ? "url(#lineGrad)" : strokeColor} 
            strokeWidth={strokeWidth} 
          />
        ) : (
          <Polyline 
            points={polyPoints} 
            fill="none" 
            stroke={strokeGradientFrom && strokeGradientTo ? "url(#lineGrad)" : strokeColor} 
            strokeWidth={strokeWidth} 
          />
        )}
        {/* Dots */}
        {showDots && points.map((p, idx) => (
          <Circle key={`d-${idx}`} cx={p.xPct * 100} cy={p.yPct * 100} r={2.4} stroke={dotColor} strokeWidth={1.2} fill="#ffffff" />
        ))}
        {/* Active indicator */}
        {activeIndex !== null ? (
          <>
            <Line 
              x1={`${points[activeIndex].xPct * 100}`} 
              y1="0" 
              x2={`${points[activeIndex].xPct * 100}`} 
              y2="100" 
              stroke={strokeGradientFrom && strokeGradientTo ? strokeGradientFrom : strokeColor} 
              strokeOpacity={0.25} 
              strokeWidth={0.6} 
            />
            <Circle 
              cx={points[activeIndex].xPct * 100} 
              cy={points[activeIndex].yPct * 100} 
              r={3.8} 
              stroke={strokeGradientFrom && strokeGradientTo ? strokeGradientFrom : strokeColor} 
              strokeWidth={1.6} 
              fill="#ffffff" 
            />
          </>
        ) : null}
      </Svg>

      {/* Labels */}
      {labels && labels.length > 0 && (
        <View style={styles.labelsRow}>
          {labels.map((l, i) => (
            <Text key={`lab-${i}`} style={styles.labelText}>{l}</Text>
          ))}
        </View>
      )}

      {/* Y-axis labels */}
      <View pointerEvents="none" style={styles.yLabelsWrap}>
        {Array.from({ length: yTickCount + 1 }).map((_, i) => {
          const val = Math.round(((yTickCount - i) / yTickCount) * yMax);
          // Calculate position to match grid lines: grid lines are at (i / yTickCount) * 100
          const yPositionPercent = (i / yTickCount) * 100;
          return (
            <View 
              key={`y-${i}`} 
              style={[
                styles.yLabelContainer,
                { 
                  top: `${yPositionPercent}%`,
                  transform: [{ translateY: -6 }] // Center the text on the grid line
                }
              ]}
            >
              <Text style={styles.yLabel}>{val}</Text>
            </View>
          );
        })}
      </View>

      {/* Tooltip */}
      {activeIndex !== null ? (
        <View pointerEvents="none" style={[styles.tooltip, { left: layoutWidth * points[activeIndex].xPct - 24, top: containerHeight * points[activeIndex].yPct - 34 }]}> 
          <Text style={styles.tooltipText}>{valueFormatter ? valueFormatter(points[activeIndex].value) : String(points[activeIndex].value)}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'relative', width: '100%' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  segment: { position: 'absolute', borderRadius: 2, width: '100%' },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, borderWidth: 2 },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 },
  labelText: { color: '#6b7280', fontSize: 12 },
  yLabelsWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 28, paddingLeft: 4 },
  yLabelContainer: { position: 'absolute', left: 0 },
  yLabel: { color: '#6b7280', fontSize: 10 },
  tooltip: { position: 'absolute', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#0b1a56', borderRadius: 6, borderWidth: 1, borderColor: '#24357a' },
  tooltipText: { color: '#e6f0ff', fontSize: 11, fontWeight: '700' },
});

export default LineChart;


