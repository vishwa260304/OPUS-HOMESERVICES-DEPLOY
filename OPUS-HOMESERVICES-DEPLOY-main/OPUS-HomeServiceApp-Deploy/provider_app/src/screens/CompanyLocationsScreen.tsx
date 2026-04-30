import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import BackButton from '../components/BackButton';

interface CompanyDetails {
  id: string;
  company_name: string;
  gst_number: string;
  business_address: string;
}

const CompanyLocationsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetails | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // State for editing company address (structured fields)
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch company details with GSTIN
      const { data: companyData, error: companyError } = await api.companyVerification.getCompanyVerification(user.id);
      
      if (companyError) {
        console.error('Error fetching company details:', companyError);
      } else if (companyData) {
        setCompanyDetails({
          id: companyData.id,
          company_name: companyData.company_name,
          gst_number: companyData.gst_number || '',
          business_address: companyData.business_address || '',
        });
        
        // Prime structured fields by trying to split the stored address
        const addr = (companyData.business_address || '').split(',').map((s: string) => s.trim());
        setAddressLine1(addr[0] || '');
        setAddressLine2(addr[1] || '');
        setCity(addr[2] || '');
        setStateName(addr[3] || '');
        // pincode might be the last token; extract digits
        const pinCandidate = (addr[4] || '').replace(/[^0-9]/g, '');
        setPincode(pinCandidate);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCompanyAddress = () => {
    // Ensure fields are primed from latest details
    const raw = companyDetails?.business_address || '';
    const parts = raw.split(',').map((s: string) => s.trim());
    setAddressLine1(parts[0] || '');
    setAddressLine2(parts[1] || '');
    setCity(parts[2] || '');
    setStateName(parts[3] || '');
    const pin = (parts[4] || '').replace(/[^0-9]/g, '');
    setPincode(pin);
    setShowEditModal(true);
  };

  const handleSaveCompanyAddress = async () => {
    if (!user || !companyDetails) return;
    if (!addressLine1.trim()) {
      Alert.alert('Validation Error', 'Address Line 1 is required');
      return;
    }
    if (!city.trim() || !stateName.trim()) {
      Alert.alert('Validation Error', 'City and State are required');
      return;
    }
    if (pincode && !/^\d{6}$/.test(pincode)) {
      Alert.alert('Validation Error', 'Please enter a valid 6-digit pincode');
      return;
    }

    const composedAddress = [addressLine1, addressLine2, city, stateName, pincode]
      .filter(Boolean)
      .join(', ');

    try {
      setSaving(true);

      const { error } = await api.companyVerification.updateCompanyVerification(
        companyDetails.id,
        { business_address: composedAddress }
      );

      if (error) {
        console.error('Error updating address:', error);
        Alert.alert('Error', 'Failed to update address');
        return;
      }

      Alert.alert('Success', 'Company address updated successfully!');
      setShowEditModal(false);
      
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Error updating address:', error);
      Alert.alert('Error', 'Failed to update address');
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading locations...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <BackButton color={colors.text} />
        <Text style={[styles.title, { color: colors.text }]}>Company Location</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Company Info Card */}
        {companyDetails && (
          <View style={[styles.companyCard, { backgroundColor: colors.card }]}> 
            <View style={styles.companyHeader}>
              <Ionicons name="business" size={24} color={colors.primary} />
              <View style={styles.companyInfo}>
                <Text style={[styles.companyName, { color: colors.text }]}> 
                  {companyDetails.company_name}
                </Text>
                <Text style={[styles.gstNumber, { color: colors.textSecondary }]}> 
                  GSTIN: {companyDetails.gst_number || 'Not Available'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Business Address Section Title */}
        {companyDetails && (
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Business Address</Text>
        )}

        {/* Business Address Card - Separate Section */}
        {companyDetails && (
          <View style={[styles.addressCard, { backgroundColor: colors.card }]}> 
            <TouchableOpacity
              style={[styles.editAddressButtonAbsolute, styles.editAddressButton, { borderColor: colors.primary }]}
              onPress={handleEditCompanyAddress}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={16} color={colors.primary} />
              <Text style={[styles.editAddressText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <Text style={[styles.addressText, { color: colors.textSecondary }]}> 
              {companyDetails.business_address || 'No address added yet'}
            </Text>
          </View>
        )}

      </ScrollView>

      {/* Edit Company Address Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Business Address</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Address Line 1 *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="House/Flat, Street"
                placeholderTextColor={colors.textSecondary}
                value={addressLine1}
                onChangeText={setAddressLine1}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Address Line 2</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Area, Landmark"
                placeholderTextColor={colors.textSecondary}
                value={addressLine2}
                onChangeText={setAddressLine2}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>City *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="City"
                placeholderTextColor={colors.textSecondary}
                value={city}
                onChangeText={setCity}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>State *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="State"
                placeholderTextColor={colors.textSecondary}
                value={stateName}
                onChangeText={setStateName}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Pincode</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="6-digit pincode"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={pincode}
                onChangeText={(v) => setPincode(v.replace(/[^0-9]/g, '').slice(0,6))}
              />

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveCompanyAddress}
                disabled={saving}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#004c8f', '#0c1a5d']}
                  style={styles.saveButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Address</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
  scrollContainer: {
    flex: 1,
  },
  companyCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  companyInfo: {
    marginLeft: 12,
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  gstNumber: {
    fontSize: 14,
    color: '#666',
  },
  addressSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  editAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#004c8f',
  },
  editAddressButtonAbsolute: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
  },
  editAddressText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#004c8f',
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    paddingRight: 96, // keep text clear of the edit button
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 24,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CompanyLocationsScreen;

