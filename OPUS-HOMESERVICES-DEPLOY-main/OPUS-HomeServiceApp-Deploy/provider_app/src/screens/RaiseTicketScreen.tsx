import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ScrollView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { moderateScale } from '../utils/responsive';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

const ISSUE_OPTIONS = [
  'Payment Issues',
  'Job Issues',
  'Technical Help',
  'KYC & Verification',
  'Other'
];

const RaiseTicketScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [orderRef, setOrderRef] = useState('');
  const [description, setDescription] = useState('');
  const [showCategoryList, setShowCategoryList] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);

  const onPickUpload = async () => {
    Keyboard.dismiss();
    Alert.alert('Upload', 'Choose a source', [
      {
        text: 'Photos',
        onPress: async () => {
          try {
            const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
            if (res.canceled) return;
            const asset = res.assets?.[0];
            if (asset) {
              setAttachmentName(asset.fileName || asset.uri?.split('/').pop() || 'image.jpg');
            }
          } catch (e) {}
        }
      },
      {
        text: 'Files',
        onPress: async () => {
          try {
            const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: false });
            if ((res as any).canceled || (res as any).type === 'cancel') return;
            const file = (res as any).assets?.[0] ?? res;
            setAttachmentName(file.name || 'document');
          } catch (e) {}
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const handleSave = () => {
    Keyboard.dismiss();
    Alert.alert('Saved', 'Your ticket has been saved as a draft.');
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!category) {
      Alert.alert('Category required', 'Please select an issue category.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Description required', 'Please describe your issue.');
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user?.id ?? null,
        title: description.slice(0, 32) || 'Support Ticket',
        category: category || 'Other',
        order_ref: orderRef || null,
        description,
        status: 'Pending',
      });
      if (error) throw error;
      Alert.alert('Submitted', 'Your ticket has been submitted.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      console.error('Failed to submit ticket:', err);
      Alert.alert('Error', 'Failed to submit ticket. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + moderateScale(10) }]}> 
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); navigation.goBack(); }} activeOpacity={0.8} style={styles.backBtnShadow}>
                <LinearGradient colors={["#004c8f", "#0c1a5d"]} style={styles.backBtn}>
                  <Ionicons name="chevron-back" size={moderateScale(22)} color="#ffffff" />
                </LinearGradient>
              </TouchableOpacity>
              <Text style={[styles.headerTitleCenter, { color: colors.text }]}>Raise a Ticket</Text>
              <View style={{ width: moderateScale(36) }} />
            </View>

            {/* Card */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              {/* Issue Category (select row look) */}
              <Text style={[styles.label, { color: colors.text }]}>Issue Category</Text>
              <TouchableOpacity style={[styles.selectRow, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} activeOpacity={0.8} onPress={() => setShowCategoryList(!showCategoryList)}>
                <Text style={[styles.selectPlaceholder, { color: category ? colors.text : colors.textSecondary }, category && styles.selectValue]}>{category || 'Select an issue category'}</Text>
                <Ionicons name={showCategoryList ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#111827" />
              </TouchableOpacity>
              {showCategoryList && (
                <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {ISSUE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                      onPress={() => { setCategory(opt); setShowCategoryList(false); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.text }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Order/Service Ref */}
              <Text style={[styles.label, styles.mt16, { color: colors.text }]}>Order/Service Reference <Text style={[styles.optionalText, { color: colors.textSecondary }]}>(Optional)</Text></Text>
              <View style={[styles.inputRow, { backgroundColor: colors.surface }] }>
                <Ionicons name="search" size={moderateScale(16)} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Enter Order ID / Service Name"
                  placeholderTextColor={colors.textSecondary}
                  value={orderRef}
                  onChangeText={setOrderRef}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

              {/* Description */}
              <Text style={[styles.label, styles.mt16, { color: colors.text }]}>Description of Issue</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.surface, color: colors.text }]}
                placeholder="Describe your problem in detail..."
                placeholderTextColor={colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
              />

              {/* Attachment */}
              <Text style={[styles.label, styles.mt16, { color: colors.text }]}>Attach Screenshot / Document <Text style={[styles.optionalText, { color: colors.textSecondary }]}>(Optional)</Text></Text>
              <TouchableOpacity style={[styles.uploadBox, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.8} onPress={onPickUpload}>
                <Ionicons name="attach" size={moderateScale(22)} color={colors.textSecondary} />
                <Text style={[styles.uploadTitle, { color: colors.text }]}>Tap to upload files</Text>
                <Text style={[styles.uploadSub, { color: colors.textSecondary }]}>Supports images and PDF files</Text>
                {attachmentName ? <Text style={[styles.fileCaption, { color: colors.textSecondary }]}>{attachmentName}</Text> : null}
              </TouchableOpacity>

              {/* Submit Button */}
              <TouchableOpacity activeOpacity={0.9} onPress={handleSubmit}>
                <LinearGradient colors={["#004c8f", "#0c1a5d"]} style={styles.submitGradientBtn}>
                  <Text style={[styles.submitText, { color: '#ffffff' }]}>Submit Ticket</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F4A', padding: moderateScale(20) },
  scrollContent: { paddingBottom: moderateScale(24) },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(16) },
  backBtn: { width: moderateScale(36), height: moderateScale(36), borderRadius: moderateScale(18), alignItems: 'center', justifyContent: 'center' },
  backBtnShadow: { borderRadius: moderateScale(18), overflow:'hidden' },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: moderateScale(18), marginLeft: moderateScale(10) },
  headerTitleCenter: { color: '#111827', fontWeight: '800', fontSize: moderateScale(20), textAlign:'center', flex: 1 },
  card: { backgroundColor: '#ffffff', borderRadius: moderateScale(16), padding: moderateScale(16) },
  label: { color: '#111827', fontWeight: '700' },
  optionalText: { color: '#6B7280', fontWeight: '500' },
  selectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F4F6', borderRadius: moderateScale(14), paddingHorizontal: moderateScale(14), paddingVertical: moderateScale(12), marginTop: moderateScale(8) },
  selectPlaceholder: { color: '#6B7280' },
  selectValue: { color: '#111827', fontWeight: '600' },
  dropdown: { backgroundColor:'#F9FAFB', borderRadius: moderateScale(12), borderWidth: 1, borderColor:'#E5E7EB', marginTop: moderateScale(8), overflow:'hidden' },
  dropdownItem: { paddingVertical: moderateScale(12), paddingHorizontal: moderateScale(14), borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  dropdownItemText: { color:'#111827' },
  mt16: { marginTop: moderateScale(16) },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: moderateScale(14), paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(10), marginTop: moderateScale(8) },
  input: { marginLeft: moderateScale(8), color: '#111827', flex: 1 },
  textArea: { backgroundColor: '#F3F4F6', borderRadius: moderateScale(14), padding: moderateScale(12), marginTop: moderateScale(8), minHeight: moderateScale(48), color: '#111827' },
  uploadBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', borderRadius: moderateScale(14), alignItems:'center', justifyContent:'center', paddingVertical: moderateScale(22), marginTop: moderateScale(8) },
  uploadTitle: { color: '#374151', fontWeight: '700', marginTop: moderateScale(8) },
  uploadSub: { color: '#6B7280', marginTop: moderateScale(4) },
  fileCaption: { color:'#4B5563', marginTop: moderateScale(8), fontSize: moderateScale(12) },
  submitBtn: { marginTop: moderateScale(16), backgroundColor:'#3B5BFD', alignItems:'center', justifyContent:'center', paddingVertical: moderateScale(14), borderRadius: moderateScale(16) },
  submitGradientBtn: { marginTop: moderateScale(16), alignItems:'center', justifyContent:'center', paddingVertical: moderateScale(14), borderRadius: moderateScale(16) },
  submitText: { color:'#ffffff', fontWeight:'700' }
});

export default RaiseTicketScreen;