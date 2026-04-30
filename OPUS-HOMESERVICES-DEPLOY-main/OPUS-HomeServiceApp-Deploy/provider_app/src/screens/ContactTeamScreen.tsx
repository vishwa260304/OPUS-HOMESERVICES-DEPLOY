import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { moderateScale } from '../utils/responsive';

const ContactTeamScreen: React.FC = () => {
  const navigation = useNavigation();
  const [subject, setSubject] = useState('KYC Verification Help');
  const [message, setMessage] = useState('');

  const submit = () => {
    if (!message.trim()) {
      Alert.alert('Message required', 'Please describe your issue.');
      return;
    }
    Alert.alert('Sent', 'Your message has been sent to our team.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Contact Verification Team</Text>
      <Text style={styles.label}>Subject</Text>
      <TextInput style={styles.input} value={subject} onChangeText={setSubject} />
      <Text style={styles.label}>Message</Text>
      <TextInput style={styles.textarea} value={message} onChangeText={setMessage} multiline placeholder="Describe your issue..." placeholderTextColor="#9AA5C9" />
      <TouchableOpacity style={styles.primaryBtn} onPress={submit} activeOpacity={0.85}>
        <Text style={styles.primaryText}>Send</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0b1960', padding: moderateScale(16) },
  title: { color:'#ffffff', fontWeight:'800', fontSize: 16, marginBottom: moderateScale(12) },
  label: { color:'#cfe0ff', marginTop: moderateScale(8), marginBottom: moderateScale(6) },
  input: { backgroundColor:'#F4F6FB', borderRadius: 12, height: 46, paddingHorizontal: 12, borderWidth:1, borderColor:'#E6ECFF', color:'#111827' },
  textarea: { backgroundColor:'#F4F6FB', borderRadius: 12, height: 140, paddingHorizontal: 12, paddingVertical: 12, borderWidth:1, borderColor:'#E6ECFF', color:'#111827', textAlignVertical:'top' },
  primaryBtn: { backgroundColor:'#3b5bfd', marginTop: moderateScale(16), paddingVertical: moderateScale(14), borderRadius: 12, alignItems:'center' },
  primaryText: { color:'#ffffff', fontWeight:'700' },
});

export default ContactTeamScreen;


