import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { moderateScale } from '../utils/responsive';
import BottomTab from '../components/BottomTab';
import { RootStackParamList } from '../types/navigation';

type ServiceSubmittedRouteProp = RouteProp<RootStackParamList, 'ServiceSubmitted'>;

const ServiceSubmittedScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<ServiceSubmittedRouteProp>();
  const serviceName = route?.params?.serviceName || 'Your service';

  return (
    <LinearGradient colors={["#0A0F4A", "#001973"]} start={{x:0,y:0}} end={{x:0,y:1}} style={styles.gradientBg}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.illustrationWrap}>
              <View style={styles.outerRing}>
                <View style={styles.midRing}>
                  <View style={styles.innerRing}>
                    <Ionicons name="time" size={moderateScale(22)} color="#1E3A8A" />
                  </View>
                </View>
              </View>
            </View>

            <Text style={styles.title}>Your service has been{"\n"}added successfully!</Text>
            <Text style={styles.subText}>Weve saved your service to your account.</Text>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Service Name</Text>
                <Text style={styles.infoValue}>{serviceName}</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }] }>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={styles.infoStatus}>Added</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={() => navigation.replace('YourServices' as never, undefined as never)}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} activeOpacity={0.9} onPress={() => navigation.replace('AddNewService')}>
              <Text style={styles.outlineBtnText}>Add Another Service</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <BottomTab active={'Home'} />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  container: { flex: 1, padding: moderateScale(16) },
  scrollContent: { paddingBottom: moderateScale(80) },
  card: { backgroundColor:'#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16) },
  illustrationWrap: { alignItems:'center', marginTop: moderateScale(14), marginBottom: moderateScale(12) },
  outerRing: { width: moderateScale(150), height: moderateScale(150), borderRadius: moderateScale(75), backgroundColor:'#DFEAFF', alignItems:'center', justifyContent:'center' },
  midRing: { width: moderateScale(110), height: moderateScale(110), borderRadius: moderateScale(55), backgroundColor:'#BFD4FF', alignItems:'center', justifyContent:'center' },
  innerRing: { width: moderateScale(70), height: moderateScale(70), borderRadius: moderateScale(35), backgroundColor:'#EAF0FF', alignItems:'center', justifyContent:'center' },
  title: { color:'#111827', fontWeight:'800', fontSize: moderateScale(20), textAlign:'center', lineHeight: moderateScale(28), marginTop: moderateScale(8) },
  subText: { color:'#6B7280', textAlign:'center', marginTop: moderateScale(10) },
  infoCard: { backgroundColor:'#F6F8FF', borderRadius: moderateScale(14), padding: moderateScale(14), marginTop: moderateScale(14) },
  infoRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical: moderateScale(10), borderBottomWidth: 1, borderBottomColor:'#E6ECFF' },
  infoLabel: { color:'#6B7280', fontWeight:'600' },
  infoValue: { color:'#111827', fontWeight:'700' },
  infoStatus: { color:'#F4B000', fontWeight:'800' },
  primaryBtn: { backgroundColor:'#2E3A8C', borderRadius: moderateScale(12), paddingVertical: moderateScale(14), alignItems:'center', marginTop: moderateScale(16) },
  primaryBtnText: { color:'#ffffff', fontWeight:'800' },
  outlineBtn: { borderWidth: 2, borderColor:'#2E3A8C', borderRadius: moderateScale(12), paddingVertical: moderateScale(14), alignItems:'center', marginTop: moderateScale(16) },
  outlineBtnText: { color:'#2E3A8C', fontWeight:'800' },
});

export default ServiceSubmittedScreen;


