import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Image, Alert, Switch } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import BackButton from '../components/BackButton';
import { moderateScale } from '../utils/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type Employee = {
  id: string;
  name: string;
  role: string;
  phone: string;
  email?: string;
  status: 'active' | 'inactive';
  avatar?: string;
  photo?: string | null;
};

const EmployeeDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const [searchQuery, setSearchQuery] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<Set<string>>(new Set());

  const fetchEmployees = async () => {
    try {
      if (!user?.id) return;
      const { data, error } = await api.employees.getEmployees(user.id);
      if (error) {
        console.warn('Error fetching employees by provider:', error);
      }
      let list = (data || []) as unknown as Employee[];
      if (!list.length) {
        try {
          const { data: verification } = await api.companyVerification.getCompanyVerification(user.id);
          const companyId = verification?.id;
          if (companyId) {
            const { data: byCompany } = await api.employees.getEmployeesByCompany(companyId);
            if (byCompany) list = byCompany as unknown as Employee[];
          }
        } catch {}
      }
      setEmployees(list);
    } catch (e) {
      console.warn('Failed to fetch employees:', (e as any)?.message || e);
    }
  };

  useEffect(() => { fetchEmployees(); }, [user?.id]);
  useEffect(() => { if (isFocused) fetchEmployees(); }, [isFocused]);

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleEmployeeStatus = async (id: string, currentStatus: 'active' | 'inactive') => {
    if (updatingStatus.has(id)) return;
    
    const nextStatus: 'active' | 'inactive' = currentStatus === 'active' ? 'inactive' : 'active';
    const idNum = Number(id);
    
    if (Number.isNaN(idNum)) return;

    try {
      setUpdatingStatus(prev => new Set(prev).add(id));
      
      // Optimistic update
      setEmployees(prev => prev.map(emp => 
        emp.id === id ? { ...emp, status: nextStatus } : emp
      ));

      const { data, error } = await api.employees.updateEmployee(idNum, { status: nextStatus });
      
      if (error) {
        // Revert on error
        setEmployees(prev => prev.map(emp => 
          emp.id === id ? { ...emp, status: currentStatus } : emp
        ));
        Alert.alert('Error', 'Failed to update employee status');
      } else if (data && data[0]) {
        // Update with server response
        setEmployees(prev => prev.map(emp => 
          emp.id === id ? { ...emp, status: (data[0] as any).status || nextStatus } : emp
        ));
      }
    } catch (e) {
      // Revert on error
      setEmployees(prev => prev.map(emp => 
        emp.id === id ? { ...emp, status: currentStatus } : emp
      ));
      Alert.alert('Error', 'Failed to update employee status');
    } finally {
      setUpdatingStatus(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <LinearGradient colors={[colors.primary, colors.primary]} start={{x:0,y:0}} end={{x:0,y:1}} style={styles.gradientBg}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <BackButton style={styles.backBtn} color="#000000" size={moderateScale(24)} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Employee Details</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} style={{ backgroundColor: colors.background }}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Search employees by name or role..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            
            <TouchableOpacity 
              style={[styles.addEmployeeBtn, { backgroundColor: colors.primary }]}
              onPress={() => (navigation as any).navigate('AddNewEmployee')}
              activeOpacity={0.8}
            >
              <Text style={[styles.addEmployeeBtnText, { color: '#ffffff' }]}>Add new employee</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>All Employees</Text>

            {filteredEmployees.map(employee => (
              <View key={employee.id} style={[styles.employeeCard, { borderBottomColor: colors.border }] }>
                <TouchableOpacity style={styles.employeeInfo} activeOpacity={0.8} onPress={() => (navigation as any).navigate('EmployeeProfile', { employee })}>
                  <View style={styles.avatarContainer}>
                    {employee.photo ? (
                      <Image source={{ uri: employee.photo }} style={{ width: '100%', height: '100%', borderRadius: moderateScale(24) }} />
                    ) : employee.avatar ? (
                      <Text style={styles.avatarText}>{employee.avatar}</Text>
                    ) : (
                      <Ionicons name="person" size={moderateScale(20)} color="#3B5BFD" />
                    )}
                  </View>
                  <View style={styles.employeeDetails}>
                    <Text style={[styles.employeeName, { color: colors.text }]}>{employee.name}</Text>
                    <Text style={[styles.employeeRole, { color: colors.textSecondary }]}>{employee.role}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: employee.status === 'active' ? '#4CAF50' : '#F44336' }]} />
                      <Text style={[styles.statusText, { color: colors.textSecondary }]}>{employee.status === 'active' ? 'Active' : 'Inactive'}</Text>
                    </View>
                    <View style={styles.phoneRow}>
                      <Ionicons name="call" size={moderateScale(14)} color="#666" />
                      <Text style={[styles.phoneText, { color: colors.textSecondary }]}>{employee.phone}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <Switch
                  value={employee.status === 'active'}
                  onValueChange={() => toggleEmployeeStatus(employee.id, employee.status)}
                  disabled={updatingStatus.has(employee.id)}
                  trackColor={{ false: '#d0d4dc', true: '#b8c7ff' }}
                  thumbColor={employee.status === 'active' ? '#3B5BFD' : '#f4f3f4'}
                />
              </View>
            ))}

            {filteredEmployees.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={moderateScale(48)} color="#8E9BB9" />
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No employees found</Text>
                <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>Try adjusting your search or add a new employee</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  container: { flex: 1, padding: moderateScale(20) },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(20) },
  backBtn: { 
    marginRight: moderateScale(12),
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255,255,255,0.8)'
  },
  headerTitle: { color: '#ffffff', fontWeight: '800', fontSize: moderateScale(20) },
  scrollContent: { paddingBottom: moderateScale(100) },
  card: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16) },
  searchInput: { 
    height: moderateScale(48), 
    borderRadius: moderateScale(12), 
    backgroundColor: '#F4F6FB', 
    paddingHorizontal: moderateScale(12), 
    color: '#000000', 
    borderWidth: 1, 
    borderColor: '#E6ECFF',
    marginBottom: moderateScale(16)
  },
  addEmployeeBtn: { 
    backgroundColor: '#3B5BFD', 
    borderRadius: moderateScale(12), 
    paddingVertical: moderateScale(14), 
    alignItems: 'center', 
    marginBottom: moderateScale(20) 
  },
  addEmployeeBtnText: { color: '#ffffff', fontWeight: '700', fontSize: moderateScale(16) },
  sectionTitle: { color: '#0b1960', fontWeight: '800', fontSize: moderateScale(18), marginBottom: moderateScale(16) },
  employeeCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: moderateScale(12), 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0' 
  },
  employeeInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { 
    width: moderateScale(48), 
    height: moderateScale(48), 
    borderRadius: moderateScale(24), 
    backgroundColor: '#EAF0FF', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: moderateScale(12) 
  },
  avatarText: { color: '#3B5BFD', fontWeight: '700', fontSize: moderateScale(16) },
  employeeDetails: { flex: 1 },
  employeeName: { color: '#0b1960', fontWeight: '700', fontSize: moderateScale(16), marginBottom: moderateScale(2) },
  employeeRole: { color: '#666', fontSize: moderateScale(14), marginBottom: moderateScale(4) },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(4) },
  statusDot: { width: moderateScale(8), height: moderateScale(8), borderRadius: moderateScale(4), marginRight: moderateScale(6) },
  statusText: { color: '#666', fontSize: moderateScale(12), textTransform: 'capitalize' },
  phoneRow: { flexDirection: 'row', alignItems: 'center' },
  phoneText: { color: '#666', fontSize: moderateScale(12), marginLeft: moderateScale(4) },
  emptyState: { alignItems: 'center', paddingVertical: moderateScale(40) },
  emptyStateText: { color: '#8E9BB9', fontWeight: '600', fontSize: moderateScale(16), marginTop: moderateScale(12) },
  emptyStateSubtext: { color: '#8E9BB9', fontSize: moderateScale(14), marginTop: moderateScale(4), textAlign: 'center' },
});

export default EmployeeDetailsScreen;