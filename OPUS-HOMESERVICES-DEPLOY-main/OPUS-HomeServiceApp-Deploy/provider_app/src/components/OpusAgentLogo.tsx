import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { moderateScale } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';

const OpusAgentLogo: React.FC = () => {
  return (
    <View style={styles.logoContainer}>
      <View style={styles.logoRow}>
        <View style={styles.opusContainer}>
          <Text style={styles.opusText}>F</Text>
          <View style={styles.spannerIcon}>
            <Ionicons name="build" size={moderateScale(18)} color="#ffffff" />
          </View>
        </View>
        <Text style={styles.opusText}>ixit</Text>
        <Text style={styles.agentText}> Agent</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    flex: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  opusContainer: {
    position: 'relative',
  },
  opusText: {
    fontSize: moderateScale(28),
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: moderateScale(1),
    fontFamily: 'Inter_800ExtraBold',
  },
  spannerIcon: {
    position: 'absolute',
    top: moderateScale(4),
    left: moderateScale(4),
  },
  agentText: {
    fontSize: moderateScale(28),
    fontWeight: '400',
    color: '#ffffff',
    letterSpacing: moderateScale(1),
    fontFamily: 'Inter_400Regular',
  },
});

export default OpusAgentLogo;
