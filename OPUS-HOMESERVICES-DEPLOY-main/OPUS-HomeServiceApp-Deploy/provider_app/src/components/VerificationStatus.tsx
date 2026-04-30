import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVerification } from '../hooks/useVerification';

interface VerificationStatusProps {
  onPress?: () => void;
  showDetails?: boolean;
}

const VerificationStatus: React.FC<VerificationStatusProps> = ({ onPress, showDetails = true }) => {
  const { verification, loading, status } = useVerification();

  const getStatusInfo = () => {
    if (!verification) {
      return {
        status: 'not_started',
        text: 'Company verification not started',
        color: '#666',
        icon: 'business-outline',
        description: 'Complete your company verification to start providing services'
      };
    }

    switch (status) {
      case 'pending':
        return {
          status: 'pending',
          text: 'Verification Pending',
          color: '#FFA500',
          icon: 'time-outline',
          description: 'Complete your verification to get started'
        };
      case 'under_review':
        return {
          status: 'under_review',
          text: 'Under Review',
          color: '#3B82F6',
          icon: 'search-outline',
          description: 'Verification is being processed'
        };
      case 'approved':
        return {
          status: 'approved',
          text: 'Verified',
          color: '#10B981',
          icon: 'checkmark-circle',
          description: 'Your company is verified and ready to go!'
        };
      case 'rejected':
        return {
          status: 'rejected',
          text: 'Verification Rejected',
          color: '#EF4444',
          icon: 'close-circle',
          description: verification.verification_notes || 'Please resubmit your documents'
        };
      default:
        return {
          status: 'unknown',
          text: 'Unknown Status',
          color: '#666',
          icon: 'help-circle-outline',
          description: 'Please contact support'
        };
    }
  };

  const statusInfo = getStatusInfo();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#0b1960" />
        <Text style={styles.loadingText}>Loading verification status...</Text>
      </View>
    );
  }

  const StatusComponent = () => (
    <View style={styles.statusContainer}>
      <View style={styles.statusHeader}>
        <Ionicons name={statusInfo.icon as any} size={20} color={statusInfo.color} />
        <Text style={[styles.statusText, { color: statusInfo.color }]}>
          {statusInfo.text}
        </Text>
      </View>
      {showDetails && (
        <Text style={styles.statusDescription}>
          {statusInfo.description}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
        <StatusComponent />
        <Ionicons name="chevron-forward" size={16} color="#666" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <StatusComponent />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E6ECFF',
  },
  statusContainer: {
    flex: 1,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusDescription: {
    fontSize: 12,
    color: '#666',
    marginLeft: 28,
  },
  loadingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
});

export default VerificationStatus;
