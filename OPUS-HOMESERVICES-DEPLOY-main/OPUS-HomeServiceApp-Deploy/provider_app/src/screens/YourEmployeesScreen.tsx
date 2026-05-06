import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import { moderateScale } from '../utils/responsive';

interface Employee {
  id: number;
  provider_id: string;
  company_id?: string | null;
  name: string;
  phone: string;
  email?: string;
  role: string;
  skills?: string[];
  experience_years?: number;
  status: 'active' | 'inactive';
  photo?: string | null;
  avatar?: string | null;
  updated_at: string;
}

const YourEmployeesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (user) {
      fetchEmployees();
    }
  }, [user]);

  // Refetch when screen gains focus (e.g., after adding a new employee)
  useEffect(() => {
    if (isFocused && user) {
      fetchEmployees();
    }
  }, [isFocused, user]);

  const fetchEmployees = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await api.employees.getEmployees(user.id);
      if (error) {
        console.error('Error fetching employees:', error);
        Alert.alert('Error', 'Failed to load employees');
      } else {
        let list = data || [];
        // Fallback: if empty, try fetching by company_id
        if (!list.length) {
          try {
            const { data: verification } = await api.companyVerification.getCompanyVerification(user.id);
            const companyId = verification?.id;
            if (companyId) {
              const { data: byCompany, error: companyErr } = await api.employees.getEmployeesByCompany(companyId);
              if (!companyErr && byCompany) {
                list = byCompany;
              }
            }
          } catch (e) {
            // ignore fallback errors
          }
        }
        setEmployees(list);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      Alert.alert('Error', 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEmployees();
    setRefreshing(false);
  };

  const handleEditEmployee = (employee: Employee) => {
    (navigation as any).navigate('AddNewEmployee', { editEmployee: employee });
  };

  const handleDeleteEmployee = (employee: Employee) => {
    Alert.alert(
      'Delete Employee',
      `Are you sure you want to delete "${employee.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await api.employees.deleteEmployee(employee.id);
              if (error) {
                Alert.alert('Error', 'Failed to delete employee');
              } else {
                setEmployees(prev => prev.filter(e => e.id !== employee.id));
                Alert.alert('Success', 'Employee deleted successfully');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete employee');
            }
          }
        }
      ]
    );
  };

  const handleToggleStatus = async (employee: Employee) => {
    const newStatus = employee.status === 'active' ? 'inactive' : 'active';
    try {
      setUpdatingIds(prev => new Set(prev).add(employee.id));
      const { error } = await api.employees.updateEmployee(employee.id, { status: newStatus });
      if (error) {
        Alert.alert('Error', 'Failed to update employee status');
      } else {
        setEmployees(prev => 
          prev.map(e => e.id === employee.id ? { ...e, status: newStatus } : e)
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update employee status');
    } finally {
      setUpdatingIds(prev => { const n = new Set(prev); n.delete(employee.id); return n; });
    }
  };

  const openEmployeeProfile = (employee: Employee) => {
    (navigation as any).navigate('EmployeeProfile', {
      employee: {
        id: String(employee.id),
        name: employee.name,
        role: employee.role,
        phone: employee.phone,
        email: employee.email,
        status: employee.status,
        avatar: employee.avatar || undefined,
        photo: employee.photo || null,
      },
    });
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? '#12B76A' : '#EF4444';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => (navigation as any).navigate('Profile')}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Your Employees</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading employees...</Text>
      </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => (navigation as any).navigate('Profile')}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Your Employees</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => (navigation as any).navigate('AddNewEmployee')}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {employees.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Employees Added</Text>
            <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>
              Add your team members to manage them effectively
            </Text>
            <TouchableOpacity
              style={[styles.addEmployeeButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                Alert.alert('Add Employee', 'Employee management feature will be available soon!');
              }}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addEmployeeButtonText}>Add Employee</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.employeesList}>
            {employees.map((employee) => (
              <TouchableOpacity key={employee.id} style={[styles.employeeCard, { backgroundColor: colors.card, borderColor: colors.border }]} activeOpacity={0.85} onPress={() => openEmployeeProfile(employee)}>
                <View style={styles.employeeHeader}>
                  <View style={styles.employeeImageContainer}>
                    {employee.photo ? (
                      <Image 
                        source={{ uri: employee.photo }} 
                        style={styles.employeeImage}
                      />
                    ) : employee.avatar ? (
                      <View style={[styles.employeeAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.employeeAvatarText}>{employee.avatar}</Text>
                      </View>
                    ) : (
                      <View style={[styles.employeeAvatar, { backgroundColor: colors.surface }]}>
                        <Ionicons name="person" size={24} color={colors.textSecondary} />
                      </View>
                    )}
                  </View>
                  <View style={styles.employeeInfo}>
                    <Text style={[styles.employeeName, { color: colors.text }]}>{employee.name}</Text>
                    <Text style={[styles.employeeRole, { color: colors.textSecondary }]}>{employee.role}</Text>
                    <Text style={[styles.employeePhone, { color: colors.textSecondary }]}>{employee.phone}</Text>
                    {employee.email && (
                      <Text style={[styles.employeeEmail, { color: colors.textSecondary }]}>{employee.email}</Text>
                    )}
                    {employee.experience_years && (
                      <Text style={[styles.experienceText, { color: colors.textSecondary }]}>
                        {employee.experience_years} years experience
                      </Text>
                    )}
                    {employee.skills && employee.skills.length > 0 && (
                      <View style={styles.skillsContainer}>
                        {employee.skills.slice(0, 3).map((skill, index) => (
                          <View key={index} style={[styles.skillTag, { backgroundColor: colors.surface }]}>
                            <Text style={[styles.skillText, { color: colors.textSecondary }]}>{skill}</Text>
                          </View>
                        ))}
                        {employee.skills.length > 3 && (
                          <Text style={[styles.moreSkillsText, { color: colors.textSecondary }]}>
                            +{employee.skills.length - 3} more
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  <View style={styles.statusContainer}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(employee.status) + '20' }]}>
                      <Ionicons 
                        name={employee.status === 'active' ? 'checkmark-circle' : 'close-circle'} 
                        size={16} 
                        color={getStatusColor(employee.status)} 
                      />
                      <Text style={[styles.statusText, { color: getStatusColor(employee.status) }]}>
                        {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                      </Text>
                    </View>
                    <Switch
                      value={employee.status === 'active'}
                      onValueChange={() => handleToggleStatus(employee)}
                      disabled={updatingIds.has(employee.id)}
                      trackColor={{ false: '#d0d4dc', true: '#b8c7ff' }}
                      thumbColor={employee.status === 'active' ? '#3B5BFD' : '#f4f3f4'}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                </View>
                
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  addButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  addEmployeeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addEmployeeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  employeesList: {
    gap: 16,
  },
  employeeCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  employeeImageContainer: {
    marginRight: 12,
  },
  employeeImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  employeeAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  employeeAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  employeeInfo: {
    flex: 1,
    marginRight: 12,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  employeeRole: {
    fontSize: 14,
    marginBottom: 2,
  },
  employeePhone: {
    fontSize: 14,
    marginBottom: 2,
  },
  employeeEmail: {
    fontSize: 14,
    marginBottom: 4,
  },
  experienceText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  skillText: {
    fontSize: 10,
    fontWeight: '500',
  },
  moreSkillsText: {
    fontSize: 10,
    fontStyle: 'italic',
    alignSelf: 'center',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  employeeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  addedDate: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
  },
});

export default YourEmployeesScreen;
