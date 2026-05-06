import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { moderateScale } from '../utils/responsive';
import { getKyc } from '../utils/appState';

type RowProps = {
  title: string;
  value?: string | number | null;
};

const Row: React.FC<RowProps> = ({ title, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowTitle}>{title}</Text>
    <Text style={styles.rowValue}>{value || '-'}</Text>
  </View>
);

const KYCDetailsScreen: React.FC = () => {
  const navigation = useNavigation();
  const kyc = getKyc();
  const uploads = kyc?.data?.uploads || {};
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>KYC Documents</Text>
          <View style={{ width: moderateScale(40) }} />
        </View>

        {!kyc?.uploaded ? (
          <Text style={styles.note}>No KYC documents uploaded yet.</Text>
        ) : (
          <View style={styles.card}>
            {Object.entries(uploads).map(([key, file]: any) => (
              <View key={key} style={styles.docBlock}>
                <Text style={styles.docTitle}>{key}</Text>
                {file?.mimeType?.startsWith('image') || /\.(png|jpg|jpeg|gif)$/i.test(file?.name || '') ? (
                  <Image source={{ uri: file.uri }} style={styles.preview} />
                ) : (
                  <Text style={styles.fileName}>{file?.name || 'File'}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0b1960', padding: moderateScale(16) },
  content: { paddingBottom: moderateScale(120) },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: moderateScale(12) },
  backBtn: { paddingVertical:6, paddingHorizontal:10, backgroundColor:'#E6ECFF', borderRadius:10 },
  backText: { color:'#0b1960', fontWeight:'700' },
  title: { color:'#ffffff', fontWeight:'800' },
  note: { color:'#cfe0ff' },
  card: { backgroundColor:'#ffffff', borderRadius:16, padding:moderateScale(14) },
  docBlock: { marginBottom: moderateScale(12) },
  docTitle: { color:'#0b1960', fontWeight:'700', marginBottom: 6, textTransform:'capitalize' },
  fileName: { color:'#374151' },
  preview: { width: '100%', height: moderateScale(200), borderRadius: 12 },
  row: { flexDirection:'row', justifyContent:'space-between', marginBottom: 8 },
  rowTitle: { color:'#6B7280' },
  rowValue: { color:'#111827', fontWeight:'700' },
});

export default KYCDetailsScreen;


