import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput, Alert, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../components/BackButton';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { moderateScale } from '../utils/responsive';
import BottomTab from '../components/BottomTab';
import OpusAgentLogo from '../components/OpusAgentLogo';
import { getNotifications } from '../utils/appState';
import { supabase } from '../lib/supabase';

type CompanyForm = {
  companyName: string;
  typeOfBusiness: string;
  servicesOffered: string;
  phone: string;
  email: string;
  address: string;
  photo: string | null;
};

const CompanyInfoScreen = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const [brandName, setBrandName] = useState('Fixit Partner');
  const [notificationCount, setNotificationCount] = useState<number>(0);
  const [form, setForm] = useState<CompanyForm>({
    companyName: '',
    typeOfBusiness: '',
    servicesOffered: '',
    phone: '',
    email: '',
    address: '',
    photo: null,
  });

  useEffect(() => {
    if (!isFocused) return;
    setNotificationCount(getNotifications().length);

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('provider_company_info')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setBrandName(data.company_name || 'Fixit Partner');
        setForm({
          companyName: data.company_name || '',
          typeOfBusiness: data.type_of_business || '',
          servicesOffered: data.services_offered || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          photo: data.photo_url || null,
        });
      }
    })();
  }, [isFocused]);

  const onChange = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('provider_company_info').upsert({
        user_id: user.id,
        company_name: form.companyName,
        type_of_business: form.typeOfBusiness,
        services_offered: form.servicesOffered,
        phone: form.phone,
        email: form.email,
        address: form.address,
        photo_url: form.photo,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      Alert.alert('Saved', 'Company information updated');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save. Please try again.');
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to select a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) {
      const uri = result.assets?.[0]?.uri || null;
      setForm((f)=> ({ ...f, photo: uri }));
    }
  };

  return (
    <LinearGradient colors={[colors.primary, colors.primary]} start={{x:0,y:0}} end={{x:0,y:1}} style={styles.gradientBg}>
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <OpusAgentLogo />
          <View style={styles.rightHeader}>
            <TouchableOpacity style={styles.bellWrap} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.85}>
              <Ionicons name="notifications" size={moderateScale(18)} color="#ffffff" />
              {notificationCount > 0 ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : String(notificationCount)}</Text></View>
              ) : null}
            </TouchableOpacity>
            <View style={styles.avatarDot} />
          </View>
        </View>
        <Text style={[styles.brandName, { color: colors.text }]}>{brandName}</Text>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <View style={styles.cardHeaderRow}>
              <BackButton style={styles.backCircle} color="#0b1960" size={moderateScale(18)} />
              <Text style={styles.cardTitle}>Company information</Text>
            </View>

            {/* Photo */}
            <View style={[styles.fieldBlock, { alignItems:'center' }]}>
              {form.photo ? (
                <Image source={{ uri: form.photo }} style={{ width: moderateScale(84), height: moderateScale(84), borderRadius: moderateScale(42), marginBottom: moderateScale(8) }} />
              ) : (
                <View style={{ width: moderateScale(84), height: moderateScale(84), borderRadius: moderateScale(42), backgroundColor:'#EAF0FF', alignItems:'center', justifyContent:'center', marginBottom: moderateScale(8) }}>
                  <Ionicons name="person" size={moderateScale(32)} color="#9AA5C9" />
                </View>
              )}
              <TouchableOpacity onPress={pickImage} style={styles.photoBtn} activeOpacity={0.85}><Text style={styles.photoBtnText}>{form.photo ? 'Change photo' : 'Add photo'}</Text></TouchableOpacity>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Company name</Text>
              <TextInput style={styles.input} placeholder="e.g., Medway Diagnostics" placeholderTextColor="#9AA5C9" value={form.companyName} onChangeText={(v)=>onChange('companyName', v)} />
            </View>

            <View style={styles.divider} />
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Type of Business</Text>
              <TextInput style={styles.input} placeholder="e.g., Healthcare services" placeholderTextColor="#9AA5C9" value={form.typeOfBusiness} onChangeText={(v)=>onChange('typeOfBusiness', v)} />
            </View>

            <View style={styles.divider} />
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Services Offered</Text>
              <TextInput style={styles.input} placeholder="e.g., Blood tests, ECG at home" placeholderTextColor="#9AA5C9" value={form.servicesOffered} onChangeText={(v)=>onChange('servicesOffered', v)} />
            </View>

            <View style={styles.divider} />
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <TextInput style={styles.input} placeholder="e.g., +91 98765 43210" placeholderTextColor="#9AA5C9" value={form.phone} onChangeText={(v)=>onChange('phone', v)} keyboardType="phone-pad" />
            </View>

            <View style={styles.divider} />
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]} placeholder="e.g., support@yourcompany.com" placeholderTextColor={colors.textSecondary} value={form.email} onChangeText={(v)=>onChange('email', v)} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <View style={styles.divider} />
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Office Address</Text>
              <TextInput style={[styles.input, { height: moderateScale(80), textAlignVertical:'top', backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]} placeholder="e.g., 123 Anna Salai, Chennai, TN" placeholderTextColor={colors.textSecondary} value={form.address} onChangeText={(v)=>onChange('address', v)} multiline />
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={onSave} activeOpacity={0.9}>
              <Text style={[styles.saveBtnText, { color: '#ffffff' }]}>Save</Text>
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
  topHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  logo: { fontSize: moderateScale(24), color: '#ffffff', fontWeight:'800' },
  logoSub: { fontSize: moderateScale(16), fontWeight:'600' },
  rightHeader: { flexDirection:'row', alignItems:'center' },
  bellWrap: { width: moderateScale(28), height: moderateScale(28), borderRadius: moderateScale(14), backgroundColor:'#13235d', alignItems:'center', justifyContent:'center', marginRight: moderateScale(10), position:'relative' },
  badge: { position:'absolute', top:-6, right:-6, backgroundColor:'#3B5BFD', borderRadius: 8, paddingHorizontal:5, paddingVertical:1 },
  badgeText: { color:'#ffffff', fontSize:10, fontWeight:'700' },
  avatarDot: { width: moderateScale(28), height: moderateScale(28), borderRadius: moderateScale(14), backgroundColor: '#e6e8ff' },
  brandName: { color:'#ffffff', fontSize: moderateScale(24), fontWeight: '800' },
  statusPill: { alignSelf:'flex-start', paddingVertical: moderateScale(6), paddingHorizontal: moderateScale(12), borderRadius: moderateScale(16), marginBottom: moderateScale(10) },
  statusText: { color:'#fff', fontWeight:'700' },
  scrollContent: { paddingBottom: moderateScale(120) },
  card: { backgroundColor:'#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16) },
  cardHeaderRow: { flexDirection:'row', alignItems:'center', marginBottom: moderateScale(10) },
  backCircle: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), backgroundColor:'#EAF0FF', alignItems:'center', justifyContent:'center', marginRight: moderateScale(10) },
  cardTitle: { color:'#0b1960', fontWeight:'800', fontSize: 16 },
  fieldBlock: { marginTop: moderateScale(6), marginBottom: moderateScale(6) },
  fieldRowWithIcon: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop: moderateScale(6), marginBottom: moderateScale(6) },
  divider: { height: 1, backgroundColor:'#EEF2FF', marginVertical: moderateScale(6) },
  fieldLabel: { color:'#2457FF', fontWeight:'800', marginBottom: moderateScale(6) },
  fieldValue: { color:'#111827' },
  input: { height: moderateScale(44), borderRadius: moderateScale(10), backgroundColor:'#F4F6FB', paddingHorizontal: moderateScale(12), color:'#111827', borderWidth:1, borderColor:'#E6ECFF' },
  saveBtn: { backgroundColor:'#3b5bfd', borderRadius: moderateScale(12), paddingVertical: moderateScale(14), alignItems:'center', marginTop: moderateScale(12) },
  saveBtnText: { color:'#ffffff', fontWeight:'800' },
  photoBtn: { backgroundColor:'#0b1960', paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(8), borderRadius: moderateScale(10) },
  photoBtnText: { color:'#ffffff', fontWeight:'700' },
});

export default CompanyInfoScreen;


