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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import BackButton from '../components/BackButton';
import { moderateScale } from '../utils/responsive';

interface Service {
  id: number;
  user_id: string;
  company_id: string | null;
  service_name: string;
  service_type: string;
  description: string | null;
  experience_years: number | null;
  submitted_at: string;
  updated_at: string;
}

const YourServicesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<number | null>(null);

  useEffect(() => {
    fetchServices();
  }, [user]);

  const fetchServices = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await api.services.getServices(user.id);
      if (error) {
        console.error('Error fetching services:', error);
        Alert.alert('Error', 'Failed to load services');
      } else {
        setServices(data || []);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      Alert.alert('Error', 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchServices();
    setRefreshing(false);
  };


  const handleDeleteService = (service: Service) => {
    Alert.alert(
      'Delete Service',
      `Are you sure you want to delete "${service.service_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingServiceId(service.id);
              console.log('Deleting service with ID:', service.id);
              const { error } = await api.services.deleteService(service.id);
              
              if (error) {
                console.error('Delete service error:', error);
                Alert.alert('Error', `Failed to delete service: ${error.message || 'Unknown error'}`);
              } else {
                console.log('Service deleted successfully from database');
                // Update local state to remove the deleted service
                setServices(prev => prev.filter(s => s.id !== service.id));
                Alert.alert('Success', 'Service deleted successfully');
              }
            } catch (error) {
              console.error('Delete service exception:', error);
              Alert.alert('Error', 'Failed to delete service. Please try again.');
            } finally {
              setDeletingServiceId(null);
            }
          }
        }
      ]
    );
  };


  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <BackButton color="#333" />
          <Text style={styles.title}>Your Services</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading services...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <BackButton color="#333" />
        <Text style={styles.title}>Your Services</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => (navigation as any).navigate('AddNewService')}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Services Added</Text>
            <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>
              Add your first service to start getting bookings
            </Text>
            <TouchableOpacity
              style={[styles.addServiceButton, { backgroundColor: colors.primary }]}
              onPress={() => (navigation as any).navigate('AddNewService')}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addServiceButtonText}>Add Service</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.servicesList}>
            {services.map((service) => (
              <View key={service.id} style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceInfo}>
                    <Text style={[styles.serviceName, { color: colors.text }]}>{service.service_name}</Text>
                    <Text style={[styles.serviceType, { color: colors.textSecondary }]}>{service.service_type}</Text>
                    {service.description && (
                      <Text style={[styles.serviceDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                        {service.description}
                      </Text>
                    )}
                    {service.experience_years && (
                      <Text style={[styles.experienceText, { color: colors.textSecondary }]}>
                        {service.experience_years} years experience
                      </Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.serviceFooter}>
                  <Text style={[styles.submittedDate, { color: colors.textSecondary }]}>
                    Added {new Date(service.submitted_at).toLocaleDateString()}
                  </Text>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.surface }]}
                      onPress={() => handleDeleteService(service)}
                      disabled={deletingServiceId === service.id}
                    >
                      {deletingServiceId === service.id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
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
  },
  scrollContentContainer: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    minHeight: 400,
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
  addServiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addServiceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  servicesList: {
    gap: 16,
    paddingBottom: 20,
  },
  serviceCard: {
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
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 14,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  experienceText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  submittedDate: {
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

export default YourServicesScreen;
