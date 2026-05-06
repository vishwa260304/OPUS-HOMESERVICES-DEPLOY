import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform, StatusBar, Modal, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { moderateScale } from '../utils/responsive';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

interface BankAccount {
  id: string;
  accountNumber: string;
  ifscNumber: string;
  accountType: string;
  accountStatus: string;
  createdDate: string;
  bankName: string;
}

const BankDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  
  const [bankAccounts, setBankAccountsState] = useState<BankAccount[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<Date>(new Date());
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingRemote, setLoadingRemote] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    bankName: '',
    accountNumber: '',
    ifscNumber: '',
    accountType: '',
    createdDate: '',
  });
  
  const sectorGradient: [string, string] = ['#004c8f', '#0c1a5d'];
  const sectorPrimary = '#3B5BFD';

  useEffect(() => {
    const load = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        console.error('Unable to load user for bank details:', authError);
        setUserId(null);
        setBankAccountsState([]);
        return;
      }
      setUserId(authData.user.id);
      await loadBankAccounts(authData.user.id);
    };
    load();
  }, []);

  const loadBankAccounts = async (uid: string) => {
    try {
      setLoadingRemote(true);
      const { data, error } = await supabase
        .from('providers_bank_details')
        .select('id, bank_name, account_number, ifsc_number, account_type, account_status, created_date, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bank details:', error);
        Alert.alert('Error', 'Could not load bank details');
        return;
      }

      const mapped: BankAccount[] =
        data?.map((row: any) => ({
          id: row.id,
          bankName: row.bank_name || '',
          accountNumber: row.account_number || '',
          ifscNumber: row.ifsc_number || '',
          accountType: row.account_type || '',
          accountStatus: row.account_status || 'Active',
          createdDate: row.created_date || (row.created_at
            ? new Date(row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : ''),
        })) || [];

      setBankAccountsState(mapped);
    } catch (err) {
      console.error('Exception fetching bank details:', err);
      Alert.alert('Error', 'Could not load bank details');
    } finally {
      setLoadingRemote(false);
    }
  };

  const openAddModal = (): void => {
    if (bankAccounts.length >= 3) {
      Alert.alert('Limit reached', 'You can save up to 3 bank accounts.');
      return;
    }
    setFormData({
      bankName: '',
      accountNumber: '',
      ifscNumber: '',
      accountType: '',
      createdDate: '',
    });
    setModalVisible(true);
  };

  const closeModal = (): void => {
    setModalVisible(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setFormData({
      bankName: '',
      accountNumber: '',
      ifscNumber: '',
      accountType: '',
      createdDate: '',
    });
    setSelectedDateTime(new Date());
  };

  const openDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (event.type === 'set' && date) {
      setSelectedDateTime(date);
      if (Platform.OS === 'android') {
        // On Android, show time picker after date is selected
        setShowTimePicker(true);
      } else {
        // On iOS, show time picker immediately
        setShowTimePicker(true);
      }
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    
    if (event.type === 'set' && time) {
      // Combine the selected date with the selected time
      const combinedDateTime = new Date(selectedDateTime);
      combinedDateTime.setHours(time.getHours());
      combinedDateTime.setMinutes(time.getMinutes());
      setSelectedDateTime(combinedDateTime);
      
      // Format the date and time
      const formattedDate = combinedDateTime.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const formattedTime = combinedDateTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      
      setFormData({ ...formData, createdDate: `${formattedDate} at ${formattedTime}` });
    } else if (event.type === 'dismissed') {
      setShowTimePicker(false);
    }
  };

  const handleSaveNewAccount = async (): Promise<void> => {
    if (!userId) {
      Alert.alert('Error', 'User not found. Please re-login.');
      return;
    }
    // Validation
    if (!formData.bankName.trim()) {
      Alert.alert('Validation Error', 'Please enter bank name');
      return;
    }
    if (!formData.accountNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter account number');
      return;
    }
    if (!formData.ifscNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter IFSC number');
      return;
    }
    if (!formData.accountType.trim()) {
      Alert.alert('Validation Error', 'Please enter account type');
      return;
    }

    const payload = {
      user_id: userId,
      bank_name: formData.bankName.trim(),
      account_number: formData.accountNumber.trim(),
      ifsc_number: formData.ifscNumber.trim().toUpperCase(),
      account_type: formData.accountType.trim(),
      account_status: 'Active',
      created_date: formData.createdDate.trim() || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };

    const { data, error } = await supabase
      .from('providers_bank_details')
      .upsert(payload, { onConflict: 'user_id,account_number' })
      .select()
      .single();

    if (error) {
      console.error('Error saving bank details:', error);
      Alert.alert('Error', 'Failed to save bank account');
      return;
    }

    const saved: BankAccount = {
      id: data?.id || `${Date.now()}`,
      bankName: data?.bank_name || payload.bank_name,
      accountNumber: data?.account_number || payload.account_number,
      ifscNumber: data?.ifsc_number || payload.ifsc_number,
      accountType: data?.account_type || payload.account_type,
      accountStatus: data?.account_status || 'Active',
      createdDate: data?.created_date || payload.created_date,
    };

    setBankAccountsState((prev) => [saved, ...prev.filter(a => a.accountNumber !== saved.accountNumber)]);
    closeModal();
    Alert.alert('Success', 'Bank account added successfully!');
  };

  const handleSaveExistingAccount = async (account: BankAccount): Promise<void> => {
    if (!userId) {
      Alert.alert('Error', 'User not found. Please re-login.');
      return;
    }

    const payload = {
      id: account.id,
      user_id: userId,
      bank_name: account.bankName.trim(),
      account_number: account.accountNumber.trim(),
      ifsc_number: account.ifscNumber.trim().toUpperCase(),
      account_type: account.accountType.trim(),
      account_status: account.accountStatus || 'Active',
      created_date: account.createdDate?.trim() || null,
    };

    const { data, error } = await supabase
      .from('providers_bank_details')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating bank account:', error);
      Alert.alert('Error', 'Failed to save bank account');
      return;
    }

    const updated: BankAccount = {
      id: data?.id || account.id,
      bankName: data?.bank_name || account.bankName,
      accountNumber: data?.account_number || account.accountNumber,
      ifscNumber: data?.ifsc_number || account.ifscNumber,
      accountType: data?.account_type || account.accountType,
      accountStatus: data?.account_status || account.accountStatus,
      createdDate: data?.created_date || account.createdDate,
    };

    setBankAccountsState((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    Alert.alert('Saved!', 'Bank account information has been saved successfully.');
  };

  const removeBankAccount = (id: string): void => {
    if (!userId) {
      Alert.alert('Error', 'User not found. Please re-login.');
      return;
    }

    if (bankAccounts.length > 1) {
      Alert.alert(
        'Remove Bank Account',
        'Are you sure you want to remove this bank account?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Remove', 
            style: 'destructive',
            onPress: async () => {
              const { error } = await supabase
                .from('providers_bank_details')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);

              if (error) {
                console.error('Error deleting bank account:', error);
                Alert.alert('Error', 'Failed to remove bank account');
                return;
              }

              setBankAccountsState(bankAccounts.filter(account => account.id !== id));
            }
          }
        ]
      );
    } else {
      Alert.alert('Cannot Remove', 'You must have at least one bank account.');
    }
  };

  const updateBankAccount = (id: string, field: keyof BankAccount, value: string): void => {
    setBankAccountsState(bankAccounts.map(account => 
      account.id === id ? { ...account, [field]: value } : account
    ));
  };

  const copyToClipboard = (text: string): void => {
    if (text.trim()) {
      // In a real app, you would use Clipboard API
      console.log('Copied to clipboard:', text);
      Alert.alert('Copied!', 'Information copied to clipboard');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={sectorGradient[0]} translucent />
      
      {/* Header */}
      <LinearGradient
        colors={sectorGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButtonHeader}
            >
              <Ionicons name="arrow-back" size={moderateScale(24)} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Bank Details</Text>
            <View style={{ width: moderateScale(40) }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView 
        style={[styles.scrollView, { backgroundColor: colors.background }]} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>

          {/* Bank Accounts */}
          {bankAccounts.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="card-outline" size={moderateScale(48)} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.text }]}>
                No bank accounts added
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                Add your bank account details to receive payments
              </Text>
            </View>
          ) : (
            bankAccounts.map((account, index) => (
            <View key={account.id} style={[styles.mainCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <TouchableOpacity
                style={styles.cardHeader}
                activeOpacity={0.8}
                onPress={() => {
                  setExpandedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(account.id)) next.delete(account.id); else next.add(account.id);
                    return next;
                  });
                }}
              >
                <Text style={styles.sectionTitle}>{account.bankName || `Bank Account ${index + 1}`}</Text>
                <View style={styles.headerActions}>
                  <Ionicons
                    name={expandedIds.has(account.id) ? 'chevron-up' : 'chevron-down'}
                    size={moderateScale(20)}
                    color={colors.text}
                    style={{ marginRight: bankAccounts.length > 1 ? moderateScale(8) : 0 }}
                  />
                  {bankAccounts.length > 1 && (
                    <TouchableOpacity 
                      style={styles.removeButton}
                      onPress={() => removeBankAccount(account.id)}
                    >
                      <Ionicons name="trash-outline" size={moderateScale(18)} color="#ff3b30" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>

              {expandedIds.has(account.id) && (
                <>
                  {/* Bank Name */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Bank Name</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                        value={account.bankName}
                        onChangeText={(value) => updateBankAccount(account.id, 'bankName', value)}
                        placeholder="Enter bank name"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>

                  {/* Account Number */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Account Number</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                        value={account.accountNumber}
                        onChangeText={(value) => updateBankAccount(account.id, 'accountNumber', value)}
                        placeholder="Enter account number"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                      />
                    </View>
                    <TouchableOpacity 
                      style={styles.copyButton}
                      onPress={() => copyToClipboard(account.accountNumber)}
                    >
                      <Ionicons name="copy-outline" size={moderateScale(18)} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  {/* IFSC Number */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>IFSC Number</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                        value={account.ifscNumber}
                        onChangeText={(value) => updateBankAccount(account.id, 'ifscNumber', value)}
                        placeholder="Enter IFSC code"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                    <TouchableOpacity 
                      style={styles.copyButton}
                      onPress={() => copyToClipboard(account.ifscNumber)}
                    >
                      <Ionicons name="copy-outline" size={moderateScale(18)} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  {/* Account Type */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Account Type</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                        value={account.accountType}
                        onChangeText={(value) => updateBankAccount(account.id, 'accountType', value)}
                        placeholder="e.g., Current, Savings"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>

                  {/* Account Status */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Account Status</Text>
                      <View style={styles.statusContainer}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>{account.accountStatus}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Created Date */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Created date</Text>
                      <TextInput
                        style={styles.textInput}
                        value={account.createdDate}
                        onChangeText={(value) => updateBankAccount(account.id, 'createdDate', value)}
                        placeholder="e.g., March 15, 2022"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>

                </>
              )}
            </View>
            ))
          )}

          {/* Add Bank Account Button */}
          {bankAccounts.length < 3 && (
            <TouchableOpacity style={[styles.addBankButton, { backgroundColor: colors.primary }]} onPress={openAddModal}>
              <Ionicons name="add-circle-outline" size={moderateScale(20)} color="#ffffff" style={styles.addIcon} />
              <Text style={[styles.addBankText, { color: '#ffffff' }]}>
                {bankAccounts.length === 0 ? 'Add bank account' : 'Add another bank account'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Add Bank Account Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                  {/* Modal Header with Gradient */}
                  <LinearGradient
                    colors={sectorGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.modalHeaderGradient}
                  >
                    <View style={styles.modalHeader}>
                      <View style={styles.modalHeaderLeft}>
                        <View style={styles.modalIconCircle}>
                          <Ionicons name="card" size={moderateScale(24)} color="#ffffff" />
                        </View>
                        <View>
                          <Text style={styles.modalTitle}>Add Bank Account</Text>
                          <Text style={styles.modalSubtitle}>Enter your bank details</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                        <Ionicons name="close" size={moderateScale(24)} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>

                  <ScrollView
                    style={styles.modalScrollView}
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                  >
                    {/* Bank Name */}
                    <View style={styles.modalField}>
                      <View style={styles.modalLabelContainer}>
                        <Ionicons name="business-outline" size={moderateScale(18)} color={sectorPrimary} style={styles.modalLabelIcon} />
                        <Text style={[styles.modalLabel, { color: colors.text }]}>
                          Bank Name <Text style={styles.required}>*</Text>
                        </Text>
                      </View>
                      <View style={[styles.modalInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TextInput
                          style={[styles.modalInput, { color: colors.text }]}
                          value={formData.bankName}
                          onChangeText={(value) => setFormData({ ...formData, bankName: value })}
                          placeholder="Enter bank name"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>
                    </View>

                    {/* Account Number */}
                    <View style={styles.modalField}>
                      <View style={styles.modalLabelContainer}>
                        <Ionicons name="card-outline" size={moderateScale(18)} color={sectorPrimary} style={styles.modalLabelIcon} />
                        <Text style={[styles.modalLabel, { color: colors.text }]}>
                          Account Number <Text style={styles.required}>*</Text>
                        </Text>
                      </View>
                      <View style={[styles.modalInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TextInput
                          style={[styles.modalInput, { color: colors.text }]}
                          value={formData.accountNumber}
                          onChangeText={(value) => setFormData({ ...formData, accountNumber: value })}
                          placeholder="Enter account number"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    {/* IFSC Number */}
                    <View style={styles.modalField}>
                      <View style={styles.modalLabelContainer}>
                        <Ionicons name="code-outline" size={moderateScale(18)} color={sectorPrimary} style={styles.modalLabelIcon} />
                        <Text style={[styles.modalLabel, { color: colors.text }]}>
                          IFSC Number <Text style={styles.required}>*</Text>
                        </Text>
                      </View>
                      <View style={[styles.modalInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TextInput
                          style={[styles.modalInput, { color: colors.text }]}
                          value={formData.ifscNumber}
                          onChangeText={(value) => setFormData({ ...formData, ifscNumber: value.toUpperCase() })}
                          placeholder="Enter IFSC code"
                          placeholderTextColor="#9CA3AF"
                          autoCapitalize="characters"
                          maxLength={11}
                        />
                      </View>
                    </View>

                    {/* Account Type */}
                    <View style={styles.modalField}>
                      <View style={styles.modalLabelContainer}>
                        <Ionicons name="wallet-outline" size={moderateScale(18)} color={sectorPrimary} style={styles.modalLabelIcon} />
                        <Text style={[styles.modalLabel, { color: colors.text }]}>
                          Account Type <Text style={styles.required}>*</Text>
                        </Text>
                      </View>
                      <View style={[styles.modalInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TextInput
                          style={[styles.modalInput, { color: colors.text }]}
                          value={formData.accountType}
                          onChangeText={(value) => setFormData({ ...formData, accountType: value })}
                          placeholder="e.g., Current, Savings"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>
                    </View>

                    {/* Created Date */}
                    <View style={styles.modalField}>
                      <View style={styles.modalLabelContainer}>
                        <Ionicons name="calendar-outline" size={moderateScale(18)} color={sectorPrimary} style={styles.modalLabelIcon} />
                        <Text style={[styles.modalLabel, { color: colors.text }]}>Created Date</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.modalInputContainer, styles.modalDateContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={openDatePicker}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.modalDateText, { color: formData.createdDate ? colors.text : '#9CA3AF' }]}>
                          {formData.createdDate || 'Tap to select date and time'}
                        </Text>
                        <Ionicons name="calendar" size={moderateScale(20)} color={sectorPrimary} />
                      </TouchableOpacity>
                    </View>
                  </ScrollView>

                  {/* Modal Footer Buttons */}
                  <View style={[styles.modalFooter, { backgroundColor: colors.card }]}>
                    <TouchableOpacity
                      style={[styles.modalCancelButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={closeModal}
                    >
                      <Ionicons name="close-outline" size={moderateScale(20)} color={colors.text} style={styles.modalButtonIcon} />
                      <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalSaveButton}
                      onPress={handleSaveNewAccount}
                    >
                      <LinearGradient
                        colors={sectorGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.modalSaveButtonGradient}
                      >
                        <Ionicons name="checkmark-circle" size={moderateScale(20)} color="#ffffff" style={styles.modalButtonIcon} />
                        <Text style={styles.modalSaveText}>Add Account</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Native Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDateTime}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Native Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={selectedDateTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: moderateScale(0),
    paddingBottom: moderateScale(16),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(10),
  },
  backButtonHeader: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: moderateScale(40),
  },
  contentWrap: {
    padding: moderateScale(20),
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: moderateScale(16),
    padding: moderateScale(20),
    marginBottom: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: moderateScale(16),
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#111827',
  },
  removeButton: {
    padding: moderateScale(8),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(12),
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: moderateScale(14),
    color: '#6B7280',
    marginBottom: moderateScale(4),
  },
  textInput: {
    fontSize: moderateScale(16),
    color: '#111827',
    fontWeight: '500',
    padding: 0,
    margin: 0,
  },
  copyButton: {
    padding: moderateScale(8),
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: '#26e07f',
    marginRight: moderateScale(8),
  },
  statusText: {
    fontSize: moderateScale(16),
    color: '#111827',
    fontWeight: '500',
  },
  addBankButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: moderateScale(14),
    paddingHorizontal: moderateScale(20),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  addIcon: {
    marginRight: moderateScale(8),
  },
  addBankText: {
    color: '#ffffff',
    fontSize: moderateScale(16),
    fontWeight: '600',
  },
  emptyState: {
    borderRadius: moderateScale(16),
    padding: moderateScale(40),
    marginBottom: moderateScale(16),
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    marginTop: moderateScale(16),
  },
  emptyStateSubtext: {
    fontSize: moderateScale(14),
    marginTop: moderateScale(8),
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#26e07f',
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(20),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: moderateScale(16),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  saveIcon: {
    marginRight: moderateScale(8),
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    maxHeight: '90%',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeaderGradient: {
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    paddingBottom: moderateScale(4),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(20),
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIconCircle: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(12),
  },
  modalTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: moderateScale(2),
  },
  modalSubtitle: {
    fontSize: moderateScale(13),
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  closeButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollView: {
    flex: 1,
    paddingTop: moderateScale(8),
  },
  modalScrollContent: {
    paddingBottom: moderateScale(20),
  },
  modalField: {
    paddingHorizontal: moderateScale(20),
    marginTop: moderateScale(20),
  },
  modalLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: moderateScale(10),
  },
  modalLabelIcon: {
    marginRight: moderateScale(8),
  },
  modalLabel: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#111827',
  },
  required: {
    color: '#ff3b30',
    fontWeight: '700',
  },
  modalInputContainer: {
    borderWidth: 1.5,
    borderRadius: moderateScale(14),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  modalInput: {
    fontSize: moderateScale(16),
    color: '#111827',
    padding: 0,
  },
  modalDateText: {
    fontSize: moderateScale(16),
    flex: 1,
  },
  modalDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  dateTimePickerContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    maxHeight: '80%',
  },
  dateTimePickerHeader: {
    borderTopLeftRadius: moderateScale(28),
    borderTopRightRadius: moderateScale(28),
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateTimePickerTitle: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: '#ffffff',
  },
  dateTimePickerClose: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTimePickerScroll: {
    maxHeight: moderateScale(400),
  },
  dateTimePickerItem: {
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
    borderBottomWidth: 1,
  },
  dateTimePickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimePickerItemText: {
    fontSize: moderateScale(16),
    color: '#111827',
  },
  todayBadge: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(4),
    borderRadius: moderateScale(12),
    marginLeft: moderateScale(8),
  },
  todayBadgeText: {
    color: '#ffffff',
    fontSize: moderateScale(11),
    fontWeight: '700',
  },
  timePickerContainer: {
    flexDirection: 'row',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(20),
    gap: moderateScale(12),
  },
  timePickerColumn: {
    flex: 1,
  },
  timePickerLabel: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    marginBottom: moderateScale(12),
    textAlign: 'center',
  },
  timePickerItem: {
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(8),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    marginBottom: moderateScale(8),
    alignItems: 'center',
  },
  timePickerItemText: {
    fontSize: moderateScale(16),
    color: '#111827',
  },
  dateTimePickerFooter: {
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(16),
    borderTopWidth: 1,
  },
  dateTimePickerFooterRow: {
    flexDirection: 'row',
    gap: moderateScale(12),
  },
  dateTimePickerButton: {
    flex: 1,
    borderRadius: moderateScale(12),
    overflow: 'hidden',
  },
  dateTimePickerButtonGradient: {
    paddingVertical: moderateScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(8),
  },
  dateTimePickerButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  dateTimePickerButtonSecondary: {
    flex: 1,
    paddingVertical: moderateScale(14),
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTimePickerButtonTextSecondary: {
    fontSize: moderateScale(16),
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(16),
    paddingBottom: moderateScale(20),
    gap: moderateScale(12),
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: moderateScale(16),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  modalCancelText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#111827',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: moderateScale(14),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  modalSaveButtonGradient: {
    paddingVertical: moderateScale(16),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#ffffff',
  },
  modalButtonIcon: {
    marginRight: moderateScale(6),
  },
});

export default BankDetailsScreen;
