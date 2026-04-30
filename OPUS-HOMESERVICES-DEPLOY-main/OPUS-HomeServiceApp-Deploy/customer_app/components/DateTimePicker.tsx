import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

interface DateTimePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: string, time: string, endTime?: string) => void;
  serviceTitle: string;
  useBlueGradient?: boolean; // Use blue gradient for services.tsx bookings (automobile, appliance, home)
  manualTimeInput?: boolean; // Allow manual time entry instead of predefined slots
  timeRangeInput?: boolean; // Allow from-to time range input
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  visible,
  onClose,
  onConfirm,
  serviceTitle,
  useBlueGradient = false,
  manualTimeInput = false,
  timeRangeInput = false,
}) => {
  const { colors } = useTheme();
  
  // Color scheme: blue gradient for services.tsx (automobile, appliance, home), teal for others
  const gradientColors: readonly [string, string, ...string[]] = useBlueGradient 
    ? [colors.secondary, colors.secondaryDark] as const // Blue gradient: #004c8f to #0c1a5d
    : ['#26A69A', '#00897B', '#00796B'] as const; // Old teal gradient
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Handle date selection and clear time if it becomes invalid
  const handleDateSelect = (fullDate: string) => {
    setSelectedDate(fullDate);
    // Clear selected time if it's now invalid for the new date
    if (selectedTime && isTimeSlotDisabled(selectedTime, fullDate)) {
      setSelectedTime('');
    }
  };
  
  // Manual time input states (From time)
  const [manualHour, setManualHour] = useState<string>('');
  const [manualMinute, setManualMinute] = useState<string>('');
  const [amPm, setAmPm] = useState<'AM' | 'PM'>('AM');
  
  // Time range states (To time)
  const [toHour, setToHour] = useState<string>('');
  const [toMinute, setToMinute] = useState<string>('');
  const [toAmPm, setToAmPm] = useState<'AM' | 'PM'>('PM');

  // Generate next 7 days
  const getNextDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayDate = date.getDate();
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const fullDate = date.toISOString().split('T')[0];
      
      days.push({
        dayName,
        dayDate,
        month,
        fullDate,
        isToday: i === 0,
      });
    }
    return days;
  };

  // Generate time slots (9 AM - 7 PM, hourly, 12h format)
  const getTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 9; hour <= 19; hour++) {
      const hr12 = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      slots.push(`${hr12}:00 ${ampm}`);
    }
    return slots;
  };

  // Check if a time slot should be disabled (past or less than 1 hour from now)
  const isTimeSlotDisabled = (timeSlot: string, dateStr: string): boolean => {
    if (!dateStr) return false;
    
    const timeMatch = timeSlot.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!timeMatch) return false;
    
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const period = timeMatch[3].toUpperCase() as 'AM' | 'PM';
    
    // Convert to 24-hour format
    let hour24 = hour;
    if (period === 'PM' && hour !== 12) hour24 += 12;
    if (period === 'AM' && hour === 12) hour24 = 0;
    
    const now = new Date();
    const slotDateTime = new Date(dateStr);
    slotDateTime.setHours(hour24, minute, 0, 0);
    
    // Add 1 hour buffer to current time
    const minAllowedTime = new Date(now.getTime() + 60 * 60 * 1000);
    
    return slotDateTime < minAllowedTime;
  };

  // Helper function to convert 12-hour time to 24-hour format
  const convertTo24Hour = (hour: number, minute: number, period: 'AM' | 'PM'): { hour24: number; minute: number } => {
    let hour24 = hour;
    if (period === 'PM' && hour !== 12) hour24 += 12;
    if (period === 'AM' && hour === 12) hour24 = 0;
    return { hour24, minute };
  };

  // Helper function to check if time is at least 1 hour in the future
  const isTimeValid = (date: string, hour: number, minute: number, period: 'AM' | 'PM'): boolean => {
    const now = new Date();
    const selectedDateTime = new Date(date);
    const { hour24 } = convertTo24Hour(hour, minute, period);
    
    selectedDateTime.setHours(hour24, minute, 0, 0);
    
    // Add 1 hour buffer to current time
    const minAllowedTime = new Date(now.getTime() + 60 * 60 * 1000);
    
    return selectedDateTime >= minAllowedTime;
  };

  const handleConfirm = () => {
    if (!selectedDate) {
      Alert.alert('Please select a date');
      return;
    }

    let timeToConfirm = selectedTime;
    let endTimeToConfirm: string | undefined;

    if (manualTimeInput || timeRangeInput) {
      // Validate FROM time input
      const hour = parseInt(manualHour, 10);
      const minute = parseInt(manualMinute || '0', 10);

      if (!manualHour || isNaN(hour) || hour < 1 || hour > 12) {
        Alert.alert('Invalid Time', 'Please enter a valid start hour (1-12)');
        return;
      }

      if (manualMinute && (isNaN(minute) || minute < 0 || minute > 59)) {
        Alert.alert('Invalid Time', 'Please enter valid start minutes (0-59)');
        return;
      }

      // Check if the start time is at least 1 hour in the future
      if (!isTimeValid(selectedDate, hour, minute, amPm)) {
        Alert.alert(
          'Invalid Time',
          'Please select a time at least 1 hour from now. You cannot book for past times.'
        );
        return;
      }

      const formattedMinute = manualMinute ? manualMinute.padStart(2, '0') : '00';
      timeToConfirm = `${hour}:${formattedMinute} ${amPm}`;

      // Validate TO time if time range is enabled
      if (timeRangeInput) {
        const toHourNum = parseInt(toHour, 10);
        const toMinuteNum = parseInt(toMinute || '0', 10);

        if (!toHour || isNaN(toHourNum) || toHourNum < 1 || toHourNum > 12) {
          Alert.alert('Invalid Time', 'Please enter a valid end hour (1-12)');
          return;
        }

        if (toMinute && (isNaN(toMinuteNum) || toMinuteNum < 0 || toMinuteNum > 59)) {
          Alert.alert('Invalid Time', 'Please enter valid end minutes (0-59)');
          return;
        }

        // Check if end time is after start time
        const startTime24 = convertTo24Hour(hour, minute, amPm);
        const endTime24 = convertTo24Hour(toHourNum, toMinuteNum, toAmPm);
        
        const startMinutes = startTime24.hour24 * 60 + startTime24.minute;
        const endMinutes = endTime24.hour24 * 60 + endTime24.minute;
        
        if (endMinutes <= startMinutes) {
          Alert.alert(
            'Invalid Time Range',
            'End time must be after start time. Please adjust your time selection.'
          );
          return;
        }

        const formattedToMinute = toMinute ? toMinute.padStart(2, '0') : '00';
        endTimeToConfirm = `${toHourNum}:${formattedToMinute} ${toAmPm}`;
      }
    } else if (!selectedTime) {
      Alert.alert('Please select a time');
      return;
    } else {
      // Validate predefined time slot selection
      const timeMatch = selectedTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeMatch) {
        const hour = parseInt(timeMatch[1], 10);
        const minute = parseInt(timeMatch[2], 10);
        const period = timeMatch[3].toUpperCase() as 'AM' | 'PM';
        
        if (!isTimeValid(selectedDate, hour, minute, period)) {
          Alert.alert(
            'Invalid Time',
            'Please select a time at least 1 hour from now.'
          );
          return;
        }
      }
    }

    // Pass the ISO date format (YYYY-MM-DD) instead of formatted string
    // selectedDate is already in YYYY-MM-DD format from day.fullDate
    // This ensures the database receives the correct date format
    onConfirm(selectedDate, timeToConfirm, endTimeToConfirm);
    onClose();
  };

  const days = getNextDays();
  const timeSlots = getTimeSlots();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Book {serviceTitle}</Text>
              <Text style={styles.subtitle}>Select date and time to continue</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Date Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Date</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateScrollContent}
              >
                {days.map((day, index) => (
                  selectedDate === day.fullDate ? (
                    <LinearGradient
                      key={index}
                      colors={gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      locations={useBlueGradient ? undefined : [0, 0.5, 1]}
                      style={styles.dateGradient}
                    >
                      <TouchableOpacity
                        style={styles.dateButtonSelected}
                        onPress={() => handleDateSelect(day.fullDate)}
                        activeOpacity={0.9}
                      >
                        <Text style={[styles.dayName, styles.dateSelectedText]}>
                          {day.isToday ? 'Today' : day.dayName}
                        </Text>
                        <Text style={[styles.dayDate, styles.dateSelectedText]}>
                          {day.dayDate}
                        </Text>
                        <Text style={[styles.month, styles.dateSelectedText]}>
                          {day.month}
                        </Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  ) : (
                    <TouchableOpacity
                      key={index}
                      style={styles.dateButton}
                      onPress={() => handleDateSelect(day.fullDate)}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.dayName}>
                        {day.isToday ? 'Today' : day.dayName}
                      </Text>
                      <Text style={styles.dayDate}>
                        {day.dayDate}
                      </Text>
                      <Text style={styles.month}>
                        {day.month}
                      </Text>
                    </TouchableOpacity>
                  )
                ))}
              </ScrollView>
            </View>

            {/* Time Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {timeRangeInput ? 'Enter Time Range' : (manualTimeInput ? 'Enter Time' : 'Select Time')}
              </Text>
              
              {(manualTimeInput || timeRangeInput) ? (
                <View style={styles.manualTimeContainer}>
                  {/* FROM Time */}
                  {timeRangeInput && (
                    <Text style={styles.timeRangeLabel}>From</Text>
                  )}
                  <View style={styles.manualTimeInputRow}>
                    <View style={styles.timeInputWrapper}>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="HH"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={2}
                        value={manualHour}
                        onChangeText={(text) => {
                          const num = text.replace(/[^0-9]/g, '');
                          if (num === '' || (parseInt(num) >= 1 && parseInt(num) <= 12)) {
                            setManualHour(num);
                          }
                        }}
                      />
                      <Text style={styles.timeInputLabel}>Hour</Text>
                    </View>
                    
                    <Text style={styles.timeSeparator}>:</Text>
                    
                    <View style={styles.timeInputWrapper}>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="MM"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={2}
                        value={manualMinute}
                        onChangeText={(text) => {
                          const num = text.replace(/[^0-9]/g, '');
                          if (num === '' || (parseInt(num) >= 0 && parseInt(num) <= 59)) {
                            setManualMinute(num);
                          }
                        }}
                      />
                      <Text style={styles.timeInputLabel}>Minute</Text>
                    </View>
                    
                    <View style={styles.amPmContainer}>
                      <TouchableOpacity
                        style={[
                          styles.amPmButton,
                          amPm === 'AM' && { backgroundColor: gradientColors[0] }
                        ]}
                        onPress={() => setAmPm('AM')}
                      >
                        <Text style={[styles.amPmText, amPm === 'AM' && styles.amPmTextSelected]}>AM</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.amPmButton,
                          amPm === 'PM' && { backgroundColor: gradientColors[0] }
                        ]}
                        onPress={() => setAmPm('PM')}
                      >
                        <Text style={[styles.amPmText, amPm === 'PM' && styles.amPmTextSelected]}>PM</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* TO Time (only if time range enabled) */}
                  {timeRangeInput && (
                    <>
                      <View style={styles.timeRangeDivider}>
                        <View style={styles.timeRangeLine} />
                        <Ionicons name="arrow-down" size={20} color="#9CA3AF" />
                        <View style={styles.timeRangeLine} />
                      </View>
                      
                      <Text style={styles.timeRangeLabel}>To</Text>
                      <View style={styles.manualTimeInputRow}>
                        <View style={styles.timeInputWrapper}>
                          <TextInput
                            style={styles.timeInput}
                            placeholder="HH"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="number-pad"
                            maxLength={2}
                            value={toHour}
                            onChangeText={(text) => {
                              const num = text.replace(/[^0-9]/g, '');
                              if (num === '' || (parseInt(num) >= 1 && parseInt(num) <= 12)) {
                                setToHour(num);
                              }
                            }}
                          />
                          <Text style={styles.timeInputLabel}>Hour</Text>
                        </View>
                        
                        <Text style={styles.timeSeparator}>:</Text>
                        
                        <View style={styles.timeInputWrapper}>
                          <TextInput
                            style={styles.timeInput}
                            placeholder="MM"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="number-pad"
                            maxLength={2}
                            value={toMinute}
                            onChangeText={(text) => {
                              const num = text.replace(/[^0-9]/g, '');
                              if (num === '' || (parseInt(num) >= 0 && parseInt(num) <= 59)) {
                                setToMinute(num);
                              }
                            }}
                          />
                          <Text style={styles.timeInputLabel}>Minute</Text>
                        </View>
                        
                        <View style={styles.amPmContainer}>
                          <TouchableOpacity
                            style={[
                              styles.amPmButton,
                              toAmPm === 'AM' && { backgroundColor: gradientColors[0] }
                            ]}
                            onPress={() => setToAmPm('AM')}
                          >
                            <Text style={[styles.amPmText, toAmPm === 'AM' && styles.amPmTextSelected]}>AM</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.amPmButton,
                              toAmPm === 'PM' && { backgroundColor: gradientColors[0] }
                            ]}
                            onPress={() => setToAmPm('PM')}
                          >
                            <Text style={[styles.amPmText, toAmPm === 'PM' && styles.amPmTextSelected]}>PM</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}
                  
                  <Text style={styles.timeHint}>
                    {timeRangeInput 
                      ? 'Enter the time range you need the driver (e.g., 9:00 AM - 5:00 PM)'
                      : 'Enter your preferred pickup time (e.g., 9:30 AM)'
                    }
                  </Text>
                </View>
              ) : (
                <View style={styles.timeContainer}>
                  {timeSlots.map((time, index) => {
                    const isDisabled = isTimeSlotDisabled(time, selectedDate);
                    
                    if (isDisabled) {
                      return (
                        <View
                          key={index}
                          style={[styles.timeButton, styles.timeButtonDisabled]}
                        >
                          <Text style={[styles.timeText, styles.timeTextDisabled]}>
                            {time}
                          </Text>
                        </View>
                      );
                    }
                    
                    return selectedTime === time ? (
                      <LinearGradient
                        key={index}
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1}}
                        locations={useBlueGradient ? undefined : [0, 0.5, 1]}
                        style={styles.timeGradient}
                      >
                        <TouchableOpacity
                          style={styles.timeButtonSelected}
                          onPress={() => setSelectedTime(time)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.timeText, styles.timeSelectedText]}>
                            {time}
                          </Text>
                        </TouchableOpacity>
                      </LinearGradient>
                    ) : (
                      <TouchableOpacity
                        key={index}
                        style={styles.timeButton}
                        onPress={() => setSelectedTime(time)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.timeText}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Selected Summary */}
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText} numberOfLines={1}>
              {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Pick a date'}
              {(manualTimeInput || timeRangeInput)
                ? (manualHour 
                    ? ` • ${manualHour}:${manualMinute || '00'} ${amPm}${timeRangeInput && toHour ? ` - ${toHour}:${toMinute || '00'} ${toAmPm}` : ''}`
                    : '')
                : (selectedTime ? ` • ${selectedTime}` : '')
              }
            </Text>
            {(!selectedDate || ((manualTimeInput || timeRangeInput) ? (!manualHour || (timeRangeInput && !toHour)) : !selectedTime)) ? (
              <View style={[styles.confirmButton, styles.confirmButtonDisabled]}>
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </View>
            ) : (
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                locations={useBlueGradient ? undefined : [0, 0.5, 1]}
                style={styles.confirmButtonGradient}
              >
                <TouchableOpacity
                  style={styles.confirmButtonInner}
                  onPress={handleConfirm}
                  activeOpacity={0.9}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    padding: 5,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 15,
  },
  dateScrollContent: {
    paddingRight: 12,
  },
  dateButton: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    minWidth: 72,
    marginRight: 10,
  },
  dateGradient: {
    borderRadius: 12,
    marginRight: 10,
  },
  dateButtonSelected: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  dateSelectedText: {
    color: '#fff',
  },
  dayName: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  dayDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  month: {
    fontSize: 10,
    color: '#6b7280',
  },
  timeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  timeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    marginBottom: 10,
    width: '31%',
    alignItems: 'center',
  },
  timeGradient: {
    borderRadius: 10,
    marginBottom: 10,
    width: '31%',
  },
  timeButtonSelected: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  timeSelectedText: {
    color: '#fff',
  },
  timeButtonDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    opacity: 0.6,
  },
  timeTextDisabled: {
    color: '#9ca3af',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  summaryText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#0A6DDB',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonGradient: {
    borderRadius: 10,
  },
  confirmButtonInner: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#ccc',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  manualTimeContainer: {
    alignItems: 'center',
  },
  manualTimeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timeInputWrapper: {
    alignItems: 'center',
  },
  timeInput: {
    width: 70,
    height: 60,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  timeInputLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  timeSeparator: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginHorizontal: 4,
    marginBottom: 16,
  },
  amPmContainer: {
    marginLeft: 12,
    gap: 6,
    marginBottom: 16,
  },
  amPmButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  amPmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  amPmTextSelected: {
    color: '#fff',
  },
  timeHint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 16,
    textAlign: 'center',
  },
  timeRangeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
    alignSelf: 'flex-start',
    marginLeft: 20,
  },
  timeRangeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    width: '100%',
  },
  timeRangeLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    width: 60,
    marginHorizontal: 12,
  },
});

export default DateTimePicker;