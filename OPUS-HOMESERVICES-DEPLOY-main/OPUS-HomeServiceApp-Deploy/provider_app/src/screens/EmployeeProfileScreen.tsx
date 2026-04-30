import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image, ActivityIndicator, Alert, ScrollView, Switch, TouchableOpacity, Linking, Modal, TextInput } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../components/BackButton';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';

type RouteParams = {
  employee: {
    id: string;
    name: string;
    role: string;
    phone: string;
    email?: string;
    status: 'active' | 'inactive';
    avatar?: string;
    photo?: string | null;
  };
};

type FullEmployee = {
  id: number;
  provider_id: string;
  company_id?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  role: string;
  skills?: string[] | null;
  experience_years?: number | null;
  status: 'active' | 'inactive';
  avatar?: string | null;
  photo?: string | null;
  address?: string | null;
  updated_at?: string;
};

const EmployeeProfileScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { employee } = route.params as RouteParams;

  const [fullEmployee, setFullEmployee] = useState<FullEmployee | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [editPhone, setEditPhone] = useState<string>('');
  const [editAddress, setEditAddress] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      try {
        const idNum = Number((employee as any)?.id);
        if (!idNum || Number.isNaN(idNum)) {
          setFullEmployee(null);
          setLoading(false);
          return;
        }
        const { data, error } = await api.employees.getEmployee(idNum);
        if (error) {
          Alert.alert('Error', 'Failed to load employee details');
        }
        setFullEmployee((data as any) || null);
      } catch (e) {
        // fallback to basic data
        setFullEmployee(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [employee?.id]);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  const currentStatus: 'active' | 'inactive' = (fullEmployee?.status || employee.status) as 'active' | 'inactive';
  const isActive = currentStatus === 'active';

  const toggleStatus = async () => {
    if (saving) return;
    const idNum = Number(fullEmployee?.id ?? employee.id);
    if (!idNum || Number.isNaN(idNum)) return;
    const nextStatus: 'active' | 'inactive' = isActive ? 'inactive' : 'active';
    try {
      setSaving(true);
      // Optimistic update
      setFullEmployee(prev => (prev ? { ...prev, status: nextStatus } : prev));
      const { data, error } = await api.employees.updateEmployee(idNum, { status: nextStatus });
      if (error) {
        // Revert on error
        setFullEmployee(prev => (prev ? { ...prev, status: currentStatus } : prev));
        Alert.alert('Error', 'Failed to update status');
      } else if (data && data[0]) {
        setFullEmployee(data[0] as FullEmployee);
      }
    } catch (e) {
      setFullEmployee(prev => (prev ? { ...prev, status: currentStatus } : prev));
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    const phone = fullEmployee?.phone || employee.phone || '';
    setEditPhone(phone.replace(/^\+91\s*/, ''));
    setEditAddress(fullEmployee?.address || '');
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    const idNum = Number(fullEmployee?.id ?? employee.id);
    if (!idNum || Number.isNaN(idNum)) return;
    if (!editPhone.trim()) {
      Alert.alert('Error', 'Phone number is required');
      return;
    }
    try {
      setSaving(true);
      const phoneFormatted = editPhone.trim().startsWith('+91') ? editPhone.trim() : `+91 ${editPhone.trim()}`;
      const { data, error } = await api.employees.updateEmployee(idNum, {
        phone: phoneFormatted,
        address: editAddress.trim() || null,
      });
      if (error) {
        Alert.alert('Error', 'Failed to update employee');
      } else if (data && data[0]) {
        setFullEmployee(data[0] as FullEmployee);
        setEditing(false);
        Alert.alert('Success', 'Employee updated successfully');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    const idNum = Number(fullEmployee?.id ?? employee.id);
    if (!idNum || Number.isNaN(idNum)) return;
    Alert.alert('Remove employee?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await api.employees.deleteEmployee(idNum);
            if (error) {
              Alert.alert('Error', 'Failed to remove employee');
            } else {
              (navigation as any).goBack();
            }
          } catch (e) {
            Alert.alert('Error', 'Failed to remove employee');
          }
        }
      }
    ]);
  };

  return (
    <LinearGradient colors={[colors.primary, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientBg}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <BackButton style={styles.backBtn} color="#000000" size={moderateScale(24)} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Employee Profile</Text>
        </View>

        {loading ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }]}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: moderateScale(40) }}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <View style={styles.topRow}>
                <View style={styles.avatarContainerLarge}>
                  {(fullEmployee?.photo || employee.photo) ? (
                    <Image source={{ uri: (fullEmployee?.photo || employee.photo) as string }} style={{ width: '100%', height: '100%', borderRadius: moderateScale(40) }} />
                  ) : (fullEmployee?.avatar || employee.avatar) ? (
                    <Text style={styles.avatarTextLarge}>{(fullEmployee?.avatar || employee.avatar) as string}</Text>
                  ) : (
                    <Ionicons name="person" size={moderateScale(36)} color="#3B5BFD" />
                  )}
                </View>
                <View style={styles.nameRole}>
                  <Text style={[styles.name, { color: colors.text }]}>{fullEmployee?.name || employee.name}</Text>
                  <Text style={[styles.roleAligned, { color: colors.textSecondary }]}>{fullEmployee?.role || employee.role}</Text>
                  <View style={[styles.statusRow, { marginTop: moderateScale(10) }]}>
                    <View style={styles.statusLeft}>
                      <Text style={[styles.statusLabelText, { color: colors.textSecondary }]}>Status</Text>
                      <View style={[styles.statusPill, { backgroundColor: isActive ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)', borderColor: isActive ? '#4CAF50' : '#F44336' }]}>
                        <View style={[styles.statusDot, { backgroundColor: isActive ? '#4CAF50' : '#F44336' }]} />
                        <Text style={[styles.statusPillText, { color: isActive ? '#2e7d32' : '#b71c1c' }]}>{isActive ? 'Active' : 'Inactive'}</Text>
                      </View>
                    </View>
                    <Switch
                      value={isActive}
                      onValueChange={toggleStatus}
                      disabled={saving}
                      trackColor={{ false: '#d0d4dc', true: '#b8c7ff' }}
                      thumbColor={isActive ? '#3B5BFD' : '#f4f3f4'}
                    />
                  </View>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact</Text>
              <View style={styles.infoBlock}>
                <View style={[styles.infoCard, { backgroundColor: 'rgba(59, 91, 253, 0.06)', borderColor: colors.border }]}>
                  <View style={styles.rowBetween}>
                    <View style={styles.infoRowNoMargin}>
                      <Ionicons name="call" size={moderateScale(18)} color={colors.textSecondary} />
                      <Text style={[styles.infoText, { color: colors.text }]}>{fullEmployee?.phone || employee.phone}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => {
                        const phone = (fullEmployee?.phone || employee.phone || '').replace(/\s+/g, '');
                        if (phone) Linking.openURL(`tel:${phone}`);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="call" size={moderateScale(16)} color="#ffffff" />
                      <Text style={styles.actionBtnText}>Call</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {(fullEmployee?.email || employee.email) ? (
                  <View style={[styles.infoCard, { backgroundColor: 'rgba(59, 91, 253, 0.06)', borderColor: colors.border }]}>
                    <View style={styles.infoRow}>
                      <Ionicons name="mail" size={moderateScale(18)} color={colors.textSecondary} />
                      <Text style={[styles.infoText, { color: colors.text }]}>{fullEmployee?.email || employee.email}</Text>
                    </View>
                  </View>
                ) : null}
                {(fullEmployee?.address) ? (
                  <View style={[styles.infoCard, { backgroundColor: 'rgba(59, 91, 253, 0.06)', borderColor: colors.border }]}>
                    <View style={styles.infoRow}>
                      <Ionicons name="location" size={moderateScale(18)} color={colors.textSecondary} />
                      <Text style={[styles.infoText, { color: colors.text }]}>{fullEmployee.address}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {(fullEmployee?.skills && fullEmployee.skills.length) || typeof fullEmployee?.experience_years === 'number' ? (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Professional</Text>
                  <View style={styles.infoBlock}>
                    {(fullEmployee?.skills && fullEmployee.skills.length) ? (
                      <View style={[styles.infoCard, { backgroundColor: 'rgba(59, 91, 253, 0.06)', borderColor: colors.border }]}>
                        <View style={styles.chipsRow}>
                          {fullEmployee.skills.map((skill, idx) => (
                            <View key={idx} style={styles.chip}>
                              <Text style={styles.chipText}>{skill}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                    {(typeof fullEmployee?.experience_years === 'number') ? (
                      <View style={[styles.infoCard, { backgroundColor: 'rgba(59, 91, 253, 0.06)', borderColor: colors.border }]}>
                        <View style={styles.infoRow}>
                          <Ionicons name="briefcase" size={moderateScale(18)} color={colors.textSecondary} />
                          <Text style={[styles.infoText, { color: colors.text }]}>Experience: {fullEmployee?.experience_years} years</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : null}
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Identifiers</Text>
              <View style={styles.infoBlock}>
                <View style={[styles.infoCard, { backgroundColor: 'rgba(59, 91, 253, 0.06)', borderColor: colors.border }]}>
                  <View style={styles.infoRow}>
                    <Ionicons name="card" size={moderateScale(18)} color={colors.textSecondary} />
                    <Text style={[styles.infoText, { color: colors.text }]}>Employee ID: {fullEmployee?.id ?? employee.id}</Text>
                  </View>
                </View>
                {/* Provider ID intentionally hidden as per requirement */}
                {(fullEmployee?.company_id) ? (
                  <View style={[styles.infoCard, { backgroundColor: 'rgba(59, 91, 253, 0.06)', borderColor: colors.border }]}>
                    <View style={styles.infoRow}>
                      <Ionicons name="business" size={moderateScale(18)} color={colors.textSecondary} />
                      <Text style={[styles.infoText, { color: colors.text }]}>Company: {fullEmployee.company_id}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.footerButtonsRow}>
                <TouchableOpacity style={[styles.footerBtn, styles.footerBtnEdit]} onPress={handleEdit} activeOpacity={0.8}>
                  <Ionicons name="create" size={moderateScale(16)} color="#ffffff" />
                  <Text style={styles.footerBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.footerBtn, styles.footerBtnRemove]} onPress={handleRemove} activeOpacity={0.8}>
                  <Ionicons name="trash" size={moderateScale(16)} color="#ffffff" />
                  <Text style={styles.footerBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
      
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Contact Details</Text>
            <View style={styles.modalFieldContainer}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>Phone Number *</Text>
              <View style={styles.phoneInputContainer}>
                <View style={[styles.countryCode, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.countryCodeText, { color: colors.text }]}>+91</Text>
                </View>
                <TextInput
                  style={[styles.phoneInput, { backgroundColor: colors.surface, color: colors.text }]}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                  value={editPhone}
                  onChangeText={setEditPhone}
                />
              </View>
            </View>
            <View style={styles.modalFieldContainer}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>Address</Text>
              <TextInput
                style={[styles.addressInput, { backgroundColor: colors.surface, color: colors.text }]}
                placeholder="Enter address"
                placeholderTextColor={colors.textSecondary}
                value={editAddress}
                onChangeText={setEditAddress}
                multiline
              />
            </View>
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setEditing(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: '#3B5BFD' }]}
                onPress={handleSaveEdit}
                activeOpacity={0.8}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  container: { flex: 1, padding: moderateScale(20) },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(20) , marginHorizontal: 10,marginTop: 20},
  backBtn: {
    marginRight: moderateScale(12),
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255,255,255,0.8)'
  },
  headerTitle: { color: '#ffffff', fontWeight: '800', fontSize: moderateScale(20), flex: 1 , marginHorizontal:55},
  card: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16) },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(12) },
  avatarContainerLarge: {
    width: moderateScale(80),
    height: moderateScale(80),
    borderRadius: moderateScale(40),
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(16)
  },
  avatarTextLarge: { color: '#3B5BFD', fontWeight: '700', fontSize: moderateScale(28) },
  nameRole: { flex: 1 },
  name: { color: '#0b1960', fontWeight: '800', fontSize: moderateScale(20) },
  role: { color: '#666', fontSize: moderateScale(14), marginTop: moderateScale(4) },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(6) },
  roleBadge: { paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(6), borderRadius: moderateScale(20), marginRight: moderateScale(8) },
  roleBadgeText: { fontSize: moderateScale(12), fontWeight: '600' },
  roleAligned: { fontSize: moderateScale(14), marginTop: moderateScale(6) },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(6), borderRadius: moderateScale(20), borderWidth: 1 },
  statusPillText: { fontSize: moderateScale(12), fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(6), justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center' },
  statusLabelText: { fontSize: moderateScale(12), marginRight: moderateScale(8) },
  statusDot: { width: moderateScale(8), height: moderateScale(8), borderRadius: moderateScale(4), marginRight: moderateScale(6) },
  statusText: { color: '#666', fontSize: moderateScale(12), textTransform: 'capitalize' },
  sectionTitle: { fontSize: moderateScale(13), fontWeight: '800', marginTop: moderateScale(8), opacity: 0.8 },
  infoBlock: { marginTop: moderateScale(8) },
  infoCard: { borderWidth: 1, borderRadius: moderateScale(12), padding: moderateScale(12), marginTop: moderateScale(10) },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(10) },
  infoRowNoMargin: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoText: { marginLeft: moderateScale(10), fontSize: moderateScale(15) },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { backgroundColor: '#EAF0FF', paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(6), borderRadius: moderateScale(16), marginRight: moderateScale(8), marginBottom: moderateScale(8) },
  chipText: { color: '#3B5BFD', fontWeight: '600', fontSize: moderateScale(12) },
  actionsRow: { flexDirection: 'row', marginTop: moderateScale(12) },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B5BFD', paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(8), borderRadius: moderateScale(10), marginRight: moderateScale(10) },
  actionBtnText: { color: '#ffffff', fontWeight: '700', marginLeft: moderateScale(6) },
  footerButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: moderateScale(16) },
  footerBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(12), borderRadius: moderateScale(12), flex: 1, justifyContent: 'center' },
  footerBtnEdit: { backgroundColor: '#3B5BFD', marginRight: moderateScale(8) },
  footerBtnRemove: { backgroundColor: '#F44336', marginLeft: moderateScale(8) },
  footerBtnText: { color: '#ffffff', fontWeight: '700', marginLeft: moderateScale(8) },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(20), width: '85%', maxWidth: moderateScale(400) },
  modalTitle: { fontSize: moderateScale(20), fontWeight: '800', marginBottom: moderateScale(20), textAlign: 'center' },
  modalFieldContainer: { marginBottom: moderateScale(16) },
  modalLabel: { fontSize: moderateScale(14), fontWeight: '600', marginBottom: moderateScale(8) },
  phoneInputContainer: { flexDirection: 'row' },
  countryCode: { height: moderateScale(48), borderTopLeftRadius: moderateScale(12), borderBottomLeftRadius: moderateScale(12), borderWidth: 1, borderColor: '#E6ECFF', borderRightWidth: 0, paddingHorizontal: moderateScale(12), justifyContent: 'center' },
  countryCodeText: { fontWeight: '600' },
  phoneInput: { flex: 1, height: moderateScale(48), borderTopRightRadius: moderateScale(12), borderBottomRightRadius: moderateScale(12), borderWidth: 1, borderColor: '#E6ECFF', paddingHorizontal: moderateScale(12) },
  addressInput: { minHeight: moderateScale(80), borderRadius: moderateScale(12), borderWidth: 1, borderColor: '#E6ECFF', paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(12), textAlignVertical: 'top' },
  modalButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: moderateScale(20) },
  modalCancelBtn: { flex: 1, paddingVertical: moderateScale(12), borderRadius: moderateScale(12), alignItems: 'center', borderWidth: 1, marginRight: moderateScale(8) },
  modalCancelText: { fontWeight: '600', fontSize: moderateScale(16) },
  modalSaveBtn: { flex: 1, paddingVertical: moderateScale(12), borderRadius: moderateScale(12), alignItems: 'center', marginLeft: moderateScale(8) },
  modalSaveText: { color: '#ffffff', fontWeight: '700', fontSize: moderateScale(16) },
});

export default EmployeeProfileScreen;


