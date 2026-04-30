import React, { useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, StatusBar, Modal, Pressable, Image, KeyboardAvoidingView, Platform, Alert, Animated } from 'react-native';
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticButtonPress, hapticSuccess } from '../../utils/haptics';
import { createPropertyListing, PropertyListing, uploadPropertyImages } from '../../lib/propertyListings';

export default function SellPropertyScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();

  const [apartmentType, setApartmentType] = useState<string>('Select Property Type');
  const [bhkType, setBhkType] = useState<string>('Select BHK type');
  const [propertySize, setPropertySize] = useState<string>('');
  const [facing, setFacing] = useState<string>('Select');
  const [propertyAge, setPropertyAge] = useState<string>('Select Property Age');
  const [floor, setFloor] = useState<string>('Select');
  const [totalFloor, setTotalFloor] = useState<string>('Select');
  const [title, setTitle] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [selectOpen, setSelectOpen] = useState<{key: string; visible: boolean}>({ key: '', visible: false });
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [datePickerType, setDatePickerType] = useState<'availableFrom' | 'leaseStart' | 'leaseEnd'>('availableFrom');
  
  // Animation values
  const [scrollY] = useState(new Animated.Value(0));
  const [progressValue] = useState(new Animated.Value(0.75)); // 75% complete (step 3 of 4)

  // Property availability: 'rent', 'lease', or 'sale'
  const [propertyFor, setPropertyFor] = useState<'rent' | 'lease' | 'sale'>('rent');
  
  // Rent-specific fields
  const [rentAmount, setRentAmount] = useState<string>('');
  const [rentNegotiable, setRentNegotiable] = useState<boolean>(false);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [monthlyMaintenance, setMonthlyMaintenance] = useState<string>('');
  
  // Lease-specific fields
  const [leaseAmount, setLeaseAmount] = useState<string>('');
  const [securityDeposit, setSecurityDeposit] = useState<string>('');
  const [leaseStart, setLeaseStart] = useState<string>('');
  const [leaseEnd, setLeaseEnd] = useState<string>('');
  const [leaseStatus, setLeaseStatus] = useState<'Active' | 'Expired' | 'Pending Renewal'>('Active');
  const [renewalOption, setRenewalOption] = useState<boolean>(false);
  
  // Sale-specific fields
  const [salePrice, setSalePrice] = useState<string>('');
  const [priceNegotiable, setPriceNegotiable] = useState<boolean>(false);
  const [expectedPrice, setExpectedPrice] = useState<string>('');
  const [pricePerSqft, setPricePerSqft] = useState<string>('');
  const [bookingAmount, setBookingAmount] = useState<string>('');
  
  // Common fields
  const [availableFrom, setAvailableFrom] = useState<string>('');
  const [furnishing, setFurnishing] = useState<string>('');
  const [parking, setParking] = useState<string>('');
  const [preferredTenants, setPreferredTenants] = useState<{ anyone?: boolean; family?: boolean; bachelorMale?: boolean; bachelorFemale?: boolean; company?: boolean }>({});
  

  const [bathrooms, setBathrooms] = useState<number>(0);
  const [balconies, setBalconies] = useState<number>(0);
  const [nonVegAllowed, setNonVegAllowed] = useState<boolean>(false);
  const [gatedSecurity, setGatedSecurity] = useState<boolean>(false);
  const [gym, setGym] = useState<boolean>(false);
  const [petAllowed, setPetAllowed] = useState<boolean>(false);
  const [directionsTip, setDirectionsTip] = useState<string>('');
  const [currentSituation, setCurrentSituation] = useState<string>('');
  const [waterSupply, setWaterSupply] = useState<string>('');
  const [secondaryNumber, setSecondaryNumber] = useState<string>('');
  const [otherAmenities, setOtherAmenities] = useState<Record<string, boolean>>({});

  const options = useMemo(() => ({
    apartmentType: [
      'Residential',
      'Commercial',
      'Industrial',
      'Land & Plots',
      'PG',
    ],
    bhkType: ['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK'],
    facing: ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'],
    propertyAge: ['0-1 Years', '1-3 Years', '3-5 Years', '5-10 Years', '10+ Years'],
    floor: Array.from({ length: 51 }, (_, i) => (i === 0 ? 'Ground' : String(i))),
    totalFloor: Array.from({ length: 61 }, (_, i) => String(i)),
    currentSituation: ['Ready to Move', 'Under Construction', 'Occupied', 'Vacant'],
    waterSupply: ['24 Hours', 'Daily', 'Alternate Days', 'Weekly', 'No Water Supply'],
  }), []);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
    
    // Animate progress bar on mount
    Animated.spring(progressValue, {
      toValue: 0.75,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [navigation]);

  const renderInputField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    icon: any,
    keyboardType: any = 'default',
    fieldName: string
  ) => {
    const isFocused = focusedField === fieldName;
    return (
      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: isFocused ? colors.secondary : colors.text }]}>
          {label}
        </Text>
        <View style={[
          styles.inputWrapper,
          { 
            backgroundColor: isDark ? colors.card : '#ffffff',
            borderColor: isFocused ? colors.secondary : colors.border,
            borderWidth: isFocused ? 2 : 1,
          }
        ]}>
          <View style={[
            styles.iconContainer,
            { backgroundColor: isFocused ? colors.secondary + '15' : colors.border + '30' }
          ]}>
            <Ionicons 
              name={icon} 
              size={20} 
              color={isFocused ? colors.secondary : colors.textSecondary} 
            />
          </View>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            keyboardType={keyboardType}
            onFocus={() => setFocusedField(fieldName)}
            onBlur={() => setFocusedField(null)}
            style={[styles.inputField, { color: colors.text }]}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent />

      {/* Enhanced Header with gradient and progress */}
      <LinearGradient
        colors={isDark 
          ? ['#1a1a1a', colors.background + 'ee', colors.background] 
          : [colors.secondary + '25', colors.secondary + '10', colors.background]}
        style={styles.headerGradient}
      >
        <View style={styles.headerSpacer} />
        <View style={styles.headerRow}>
          <TouchableOpacity 
            onPress={() => {
              hapticButtonPress();
              router.back();
            }} 
            style={[styles.iconBtn, { 
              backgroundColor: isDark ? colors.card : '#ffffff',
            }]}
          > 
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>List Your Property</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Step 3 of 3</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <Animated.ScrollView 
        contentContainerStyle={styles.content} 
        keyboardShouldPersistTaps="handled" 
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Basic Details Section */}
        <View style={[styles.sectionContainer, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border }]}>
          <View style={[styles.stepHeader, { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0 }]}>
            <LinearGradient
              colors={[colors.secondary + '20', colors.secondary + '10']}
              style={styles.sectionIconBg}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="home" size={22} color={colors.secondary} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Basic Property Details</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>Essential information about your property</Text>
            </View>
          </View>
          
        <View style={styles.formContent}>
        {/* House Type */}
        <FieldLabel colors={colors} label="House Type*" />
        <SelectField
          colors={colors}
          icon="home-outline"
          value={apartmentType}
          onPress={() => setSelectOpen({ key: 'apartmentType', visible: true })}
        />

        {/* BHK Type */}
        <FieldLabel colors={colors} label="BHK Type*" />
        <SelectField
          colors={colors}
          value={bhkType}
          onPress={() => setSelectOpen({ key: 'bhkType', visible: true })}
        />

        {/* Property Size */}
        <FieldLabel colors={colors} label="Property Size*" />
        <TextInput
          placeholder="Built Up Area (Sq. Ft.)"
          keyboardType="numeric"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          value={propertySize}
          onChangeText={setPropertySize}
        />

        {/* Facing */}
        <FieldLabel colors={colors} label="Facing" />
        <SelectField
          colors={colors}
          icon="compass-outline"
          value={facing}
          onPress={() => setSelectOpen({ key: 'facing', visible: true })}
        />

        {/* Property Age */}
        <FieldLabel colors={colors} label="Property Age*" />
        <SelectField
          colors={colors}
          icon="calendar-outline"
          value={propertyAge}
          onPress={() => setSelectOpen({ key: 'propertyAge', visible: true })}
        />

        {/* Floor and Total Floor */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <FieldLabel colors={colors} label="Floor*" />
            <SelectField
              colors={colors}
              icon="layers-outline"
              value={floor}
              onPress={() => setSelectOpen({ key: 'floor', visible: true })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel colors={colors} label="Total Floor*" />
            <SelectField
              colors={colors}
              icon="podium-outline"
              value={totalFloor}
              onPress={() => setSelectOpen({ key: 'totalFloor', visible: true })}
            />
          </View>
        </View>

        {/* Title, Location, Price, Description */}
        <FieldLabel colors={colors} label="Title" />
        <TextInput value={title} onChangeText={setTitle} placeholder="Spacious 3BHK Apartment" placeholderTextColor={colors.textSecondary} style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} />
        <FieldLabel colors={colors} label="Location" />
        <TextInput value={location} onChangeText={setLocation} placeholder="Chennai, Tamil Nadu" placeholderTextColor={colors.textSecondary} style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} />
        {/* Price field removed as per requirement */}
        </View>
        </View>

        {/* Property Pricing Details */}
        <View style={[styles.sectionContainer, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border, marginTop: 16 }]}>
        <View style={[styles.stepHeader, { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0 }]}>
          <LinearGradient
            colors={[colors.secondary + '20', colors.secondary + '10']}
            style={styles.sectionIconBg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="pricetag" size={22} color={colors.secondary} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Property Pricing</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>Set your pricing details</Text>
          </View>
        </View>
        
        <View style={styles.formContent}>
          <Text style={[styles.smallLabel, { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 12 }]}>I want to</Text>
          <View style={styles.rowGap8}>
            <ChipToggle colors={colors} active={propertyFor === 'rent'} label="Rent" onPress={() => setPropertyFor('rent')} icon="key" />
            <ChipToggle colors={colors} active={propertyFor === 'lease'} label="Lease" onPress={() => setPropertyFor('lease')} icon="document-text" />
            <ChipToggle colors={colors} active={propertyFor === 'sale'} label="Sale" onPress={() => setPropertyFor('sale')} icon="cash" />
          </View>

          {/* RENT DETAILS */}
          {propertyFor === 'rent' && (
            <View style={{ marginTop: 16 }}>
              {renderInputField('Expected Rent (₹/month)', rentAmount, setRentAmount, 'Enter monthly rent', 'cash-outline', 'numeric', 'rentAmount')}
              
              <TouchableOpacity 
                onPress={() => setRentNegotiable(v => !v)} 
                style={[styles.checkboxRow, { borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16 }]}
                activeOpacity={0.7}
              > 
                <View style={[styles.checkboxBox, { borderColor: colors.border, backgroundColor: rentNegotiable ? colors.secondary : 'transparent' }]}>
                  {rentNegotiable && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 }}>Rent Negotiable</Text>
              </TouchableOpacity>

              {renderInputField('Security Deposit (₹)', depositAmount, setDepositAmount, 'Enter security deposit', 'shield-checkmark-outline', 'numeric', 'depositAmount')}
              {renderInputField('Monthly Maintenance (₹)', monthlyMaintenance, setMonthlyMaintenance, 'Enter maintenance charges', 'build-outline', 'numeric', 'monthlyMaintenance')}
            </View>
          )}

          {/* LEASE DETAILS */}
          {propertyFor === 'lease' && (
            <View style={{ marginTop: 16 }}>
              {renderInputField('Lease Amount (₹)', leaseAmount, setLeaseAmount, 'Enter lease amount', 'cash-outline', 'numeric', 'leaseAmount')}
              {renderInputField('Security Deposit (₹)', securityDeposit, setSecurityDeposit, 'Enter security deposit', 'shield-checkmark-outline', 'numeric', 'securityDeposit')}

              <Text style={[styles.smallLabel, { color: colors.text, marginTop: 8, marginBottom: 8 }]}>Lease Period</Text>
              <View style={styles.rowGap12}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.text, marginBottom: 8 }]}>Start Date</Text>
                  <TouchableOpacity
                    onPress={() => {
                      hapticButtonPress();
                      setDatePickerType('leaseStart');
                      setShowDatePicker(true);
                    }}
                    style={[
                      styles.inputWrapper,
                      { 
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderWidth: 1
                      }
                    ]}
                  >
                    <Ionicons 
                      name="calendar-outline" 
                      size={20} 
                      color={colors.textSecondary} 
                      style={styles.inputIcon}
                    />
                    <Text style={{ color: leaseStart ? colors.text : colors.textSecondary, flex: 1, fontSize: 14 }}>
                      {leaseStart || 'DD/MM/YYYY'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.text, marginBottom: 8 }]}>End Date</Text>
                  <TouchableOpacity
                    onPress={() => {
                      hapticButtonPress();
                      setDatePickerType('leaseEnd');
                      setShowDatePicker(true);
                    }}
                    style={[
                      styles.inputWrapper,
                      { 
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderWidth: 1
                      }
                    ]}
                  >
                    <Ionicons 
                      name="calendar-outline" 
                      size={20} 
                      color={colors.textSecondary} 
                      style={styles.inputIcon}
                    />
                    <Text style={{ color: leaseEnd ? colors.text : colors.textSecondary, flex: 1, fontSize: 14 }}>
                      {leaseEnd || 'DD/MM/YYYY'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.smallLabel, { color: colors.text, marginTop: 8, marginBottom: 8 }]}>Lease Status</Text>
              <View style={styles.rowGap8}>
                {['Active','Expired','Pending Renewal'].map((s) => (
                  <ChipToggle key={s} colors={colors} active={leaseStatus===s} label={s} onPress={() => setLeaseStatus(s as any)} />
                ))}
              </View>

              <Text style={[styles.smallLabel, { color: colors.text, marginTop: 16, marginBottom: 8 }]}>Renewal Option Available?</Text>
              <View style={styles.rowGap8}>
                <ChipToggle colors={colors} active={renewalOption} label="Yes" onPress={() => setRenewalOption(true)} />
                <ChipToggle colors={colors} active={!renewalOption} label="No" onPress={() => setRenewalOption(false)} />
              </View>
            </View>
          )}

          {/* SALE DETAILS */}
          {propertyFor === 'sale' && (
            <View style={{ marginTop: 16 }}>
              {renderInputField('Expected Price (₹)', salePrice, setSalePrice, 'Enter expected price', 'cash-outline', 'numeric', 'salePrice')}
              
              <TouchableOpacity 
                onPress={() => setPriceNegotiable(v => !v)} 
                style={[styles.checkboxRow, { borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16 }]}
                activeOpacity={0.7}
              > 
                <View style={[styles.checkboxBox, { borderColor: colors.border, backgroundColor: priceNegotiable ? colors.secondary : 'transparent' }]}>
                  {priceNegotiable && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 }}>Price Negotiable</Text>
              </TouchableOpacity>

              {renderInputField('Price per Sq.Ft (₹)', pricePerSqft, setPricePerSqft, 'Auto-calculated or enter', 'calculator-outline', 'numeric', 'pricePerSqft')}
              {renderInputField('Booking Amount (₹)', bookingAmount, setBookingAmount, 'Enter booking/token amount', 'wallet-outline', 'numeric', 'bookingAmount')}
            </View>
          )}

          {/* Common fields for all types */}
          <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 20 }]} />

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Available From</Text>
            <TouchableOpacity
              onPress={() => {
                hapticButtonPress();
                setDatePickerType('availableFrom');
                setShowDatePicker(true);
              }}
              style={[
                styles.inputWrapper,
                { 
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1
                }
              ]}
            >
              <Ionicons 
                name="calendar-outline" 
                size={20} 
                color={colors.textSecondary} 
                style={styles.inputIcon}
              />
              <Text style={{ color: availableFrom ? colors.text : colors.textSecondary, flex: 1 }}>
                {availableFrom || 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.smallLabel, { color: colors.text, marginTop: 8, marginBottom: 8 }]}>Furnishing Status</Text>
          <View style={styles.rowGap8}>
            {['Unfurnished', 'Semi-Furnished', 'Fully Furnished'].map((f) => (
              <ChipToggle key={f} colors={colors} active={furnishing === f} label={f} onPress={() => setFurnishing(f)} />
            ))}
          </View>

          <Text style={[styles.smallLabel, { color: colors.text, marginTop: 16, marginBottom: 8 }]}>Parking Available</Text>
          <View style={styles.rowGap8}>
            {['No Parking', 'Bike', 'Car', 'Both'].map((p) => (
              <ChipToggle key={p} colors={colors} active={parking === p} label={p} onPress={() => setParking(p)} />
            ))}
          </View>

          {propertyFor === 'rent' && (
            <>
              <Text style={[styles.smallLabel, { color: colors.text, marginTop: 16, marginBottom: 8 }]}>Preferred Tenants</Text>
              <View style={[styles.rowWrap, { gap: 10 }]}>
                {[
                  ['anyone','Anyone'],['family','Family'],['bachelorMale','Bachelor Male'],['bachelorFemale','Bachelor Female'],['company','Company']
                ].map(([key,label]) => (
                  <TouchableOpacity 
                    key={key} 
                    onPress={() => {
                      hapticButtonPress();
                      if (key === 'anyone') {
                        // If clicking "Anyone", toggle all on/off
                        const newValue = !preferredTenants.anyone;
                        setPreferredTenants({
                          anyone: newValue,
                          family: newValue,
                          bachelorMale: newValue,
                          bachelorFemale: newValue,
                          company: newValue,
                        });
                      } else {
                        // If clicking any specific option, toggle it and uncheck "Anyone" if needed
                        const newState = { ...preferredTenants, [key]: !preferredTenants[key as keyof typeof preferredTenants] };
                        // Check if all specific options are selected
                        const allSelected = newState.family && newState.bachelorMale && newState.bachelorFemale && newState.company;
                        newState.anyone = allSelected;
                        setPreferredTenants(newState);
                      }
                    }} 
                    style={[styles.checkboxRow, { borderColor: colors.border, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }]}
                    activeOpacity={0.7}
                  > 
                    <View style={[styles.checkboxBox, { borderColor: colors.border, backgroundColor: preferredTenants[key as keyof typeof preferredTenants] ? colors.secondary : 'transparent' }]}>
                      {preferredTenants[key as keyof typeof preferredTenants] && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
        </View>

        {/* Amenities Details Section */}
        <View style={[styles.sectionContainer, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border, marginTop: 16 }]}>
        <View style={[styles.stepHeader, { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0 }]}>
          <LinearGradient
            colors={[colors.secondary + '20', colors.secondary + '10']}
            style={styles.sectionIconBg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="star" size={22} color={colors.secondary} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Amenities & Features</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>Add amenities to attract buyers</Text>
          </View>
        </View>
        
        <View style={styles.formContent}>
          <View style={styles.rowSpace}>
            <Counter label="Bathroom(s)" value={bathrooms} setValue={setBathrooms} colors={colors} />
            <Counter label="Balcony(s)" value={balconies} setValue={setBalconies} colors={colors} />
          </View>

          {[
            ['Non-veg allowed', nonVegAllowed, setNonVegAllowed],
            ['Gated Security', gatedSecurity, setGatedSecurity],
            ['Gym', gym, setGym],
            ['Pet', petAllowed, setPetAllowed],
          ].map(([label, val, setter]: any) => (
            <View key={label} style={styles.rowSpace}>
              <Text style={{ color: colors.text, flex: 1 }}>{label as string}</Text>
              <View style={styles.rowGap8}>
                <ChipToggle colors={colors} active={!val} label="No" onPress={() => setter(false)} />
                <ChipToggle colors={colors} active={!!val} label="Yes" onPress={() => setter(true)} />
              </View>
            </View>
          ))}

          <FieldLabel colors={colors} label="Add Directions Tip for your tenants" />
          <TextInput value={directionsTip} onChangeText={setDirectionsTip} placeholder="Eg: The road opposite to ..." placeholderTextColor={colors.textSecondary} style={[styles.textarea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} multiline numberOfLines={3} />

          <FieldLabel colors={colors} label="Current Situation of Property" />
          <SelectField
            colors={colors}
            icon="information-circle-outline"
            value={currentSituation || 'Select'}
            onPress={() => setSelectOpen({ key: 'currentSituation', visible: true })}
          />

          <FieldLabel colors={colors} label="Water supply" />
          <SelectField
            colors={colors}
            icon="water-outline"
            value={waterSupply || 'Select'}
            onPress={() => setSelectOpen({ key: 'waterSupply', visible: true })}
          />

          <FieldLabel colors={colors} label="Enter Secondary Number" />
          <TextInput value={secondaryNumber} onChangeText={setSecondaryNumber} placeholder="Secondary phone" keyboardType="phone-pad" placeholderTextColor={colors.textSecondary} style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} />

          <FieldLabel colors={colors} label="Other Amenities" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {[ 'Air-Conditioner','Club','Playground','Gas','Rain Water Harvesting','Sewage','Power Backup','Lift','Fire-Alarm','House-Keeper','Park','Shopping Center','Swimming Pool','Intercom','Visitor Parking','Internet' ].map((amen) => (
              <TouchableOpacity 
                key={amen} 
                onPress={() => {
                  hapticButtonPress();
                  setOtherAmenities(prev => ({ ...prev, [amen]: !prev[amen] }));
                }} 
                style={[styles.checkboxRow, { borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 10, marginRight: 8, marginBottom: 8 }]}
                activeOpacity={0.7}
              > 
                <View style={[styles.checkboxBox, { borderColor: colors.border, backgroundColor: otherAmenities[amen] ? colors.secondary : 'transparent' }]}>
                  {otherAmenities[amen] && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={{ color: colors.text }}>{amen}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TextInput
          placeholder="Description"
          placeholderTextColor={colors.textSecondary}
          style={[styles.textarea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          multiline
          numberOfLines={5}
        />
        </View>

        {/* Property Images Section */}
        <View style={[styles.sectionContainer, { backgroundColor: isDark ? colors.card : '#ffffff', borderColor: colors.border, marginTop: 16 }]}>
          <View style={[styles.stepHeader, { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0 }]}>
            <LinearGradient
              colors={[colors.secondary + '20', colors.secondary + '10']}
              style={styles.sectionIconBg}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="images" size={22} color={colors.secondary} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Property Images</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>Add photos to get 5X more responses</Text>
            </View>
          </View>
          
        <View style={styles.formContent}>
        <View style={[styles.imagesBox, { borderColor: colors.border, backgroundColor: colors.surface || colors.background }]}> 
          {selectedImageUris.length > 0 ? (
            <Image source={{ uri: selectedImageUris[0] }} style={styles.imagesHero} resizeMode="cover" />
          ) : (
            <Ionicons name="camera-outline" size={36} color={colors.textSecondary} style={{ alignSelf: 'center', marginBottom: 10 }} />
          )}
          <Text style={[styles.imagesHint, { color: colors.text }]}>Add photos to get 5X more responses.</Text>
          <Text style={[styles.imagesSubHint, { color: colors.textSecondary }]}>
            {selectedImageUris.length > 0 
              ? `${selectedImageUris.length} of 5 images selected` 
              : 'Select 1-5 images. 90% tenants contact on properties with photos.'}
          </Text>
          <View style={styles.imagesBtnRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.imagesBtn, { backgroundColor: colors.secondary, opacity: selectedImageUris.length >= 5 ? 0.5 : 1 }]}
              disabled={selectedImageUris.length >= 5}
              onPress={async () => {
                hapticButtonPress();
                if (selectedImageUris.length >= 5) {
                  Alert.alert('Maximum Images', 'You can only select up to 5 images.');
                  return;
                }
                const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!perm.granted) return;
                const remainingSlots = 5 - selectedImageUris.length;
                const res = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  allowsMultipleSelection: true,
                  selectionLimit: remainingSlots,
                  quality: 0.8,
                });
                if (!res.canceled) {
                  const newImages = res.assets.map(a => a.uri).slice(0, remainingSlots);
                  setSelectedImageUris(prev => [...prev, ...newImages]);
                }
              }}
            >
              <Text style={styles.imagesBtnText}>Add Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.imagesBtn, { backgroundColor: colors.secondary, opacity: selectedImageUris.length >= 5 ? 0.5 : 1 }]}
              disabled={selectedImageUris.length >= 5}
              onPress={async () => {
                hapticButtonPress();
                if (selectedImageUris.length >= 5) {
                  Alert.alert('Maximum Images', 'You can only select up to 5 images.');
                  return;
                }
                const perm = await ImagePicker.requestCameraPermissionsAsync();
                if (!perm.granted) return;
                const res = await ImagePicker.launchCameraAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.8,
                });
                if (!res.canceled) setSelectedImageUris(prev => [...prev, res.assets[0].uri]);
              }}
            >
              <Text style={styles.imagesBtnText}>Take Pictures</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contact Number */}
        <FieldLabel colors={colors} label="Contact Number" />
        <TextInput
          value={contactNumber}
          onChangeText={setContactNumber}
          placeholder="Owner/Agent phone number"
          keyboardType="phone-pad"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
        />
        </View>
        </View>

        {/* Save Button */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.primaryBtn, { backgroundColor: colors.secondary }]}
            onPress={async () => {
              hapticButtonPress();
              
              // Validate at least 1 image is selected
              if (selectedImageUris.length === 0) {
                Alert.alert('Images Required', 'Please select at least 1 image for your property.');
                return;
              }
              
              try {
                // Generate a temporary property ID for organizing images
                const tempPropertyId = `prop_${Date.now()}`;
                
                // Upload images to Supabase storage
                const uploadedImageUrls = await uploadPropertyImages(selectedImageUris, tempPropertyId);
                
                if (uploadedImageUrls.length === 0) {
                  Alert.alert('Upload Failed', 'Failed to upload images. Please try again.');
                  return;
                }
                
                // Normalize mapping to category/subcategory
                const toCategoryAndSub = (type: string): { category: string; subcategory: string } => {
                switch (type) {
                  case 'Residential':
                  case 'Commercial':
                  case 'Industrial':
                  case 'Land & Plots':
                    return { category: type, subcategory: 'General' };
                  case 'Sale':
                    return { category: 'Residential', subcategory: 'Properties for Sale' };
                  case 'Rent / Lease':
                    return { category: 'Residential', subcategory: 'Properties for Rent' };
                  case 'Short-term Rentals':
                    return { category: 'Residential', subcategory: 'Short-term Rentals' };
                  case 'PG':
                    return { category: 'Residential', subcategory: 'PG Accommodations' };
                  case 'Ready to Move':
                    return { category: 'Residential', subcategory: 'Ready to Move Properties' };
                  case 'Under Construction':
                    return { category: 'Residential', subcategory: 'Under Construction Properties' };
                  case 'New Launch':
                    return { category: 'Residential', subcategory: 'New Launch Properties' };
                  default:
                    return { category: 'Residential', subcategory: 'Properties for Sale' };
                }
              };
              const { category, subcategory } = toCategoryAndSub(apartmentType);

              // Prepare property listing data
              const propertyData: PropertyListing = {
                apartment_type: apartmentType,
                bhk_type: bhkType,
                property_size: propertySize,
                facing: facing !== 'Select' ? facing : undefined,
                property_age: propertyAge !== 'Select Property Age' ? propertyAge : undefined,
                floor: floor !== 'Select' ? floor : undefined,
                total_floor: totalFloor !== 'Select' ? totalFloor : undefined,
                title: title || `${bhkType} in ${category}`,
                location: location || 'Not specified',
                property_for: propertyFor,
                
                // Rent fields
                rent_amount: propertyFor === 'rent' ? rentAmount : undefined,
                rent_negotiable: propertyFor === 'rent' ? rentNegotiable : undefined,
                deposit_amount: propertyFor === 'rent' ? depositAmount : undefined,
                monthly_maintenance: propertyFor === 'rent' ? monthlyMaintenance : undefined,
                
                // Lease fields
                lease_amount: propertyFor === 'lease' ? leaseAmount : undefined,
                security_deposit: propertyFor === 'lease' ? securityDeposit : undefined,
                lease_start: propertyFor === 'lease' ? leaseStart : undefined,
                lease_end: propertyFor === 'lease' ? leaseEnd : undefined,
                lease_status: propertyFor === 'lease' ? leaseStatus : undefined,
                renewal_option: propertyFor === 'lease' ? renewalOption : undefined,
                
                // Sale fields
                sale_price: propertyFor === 'sale' ? salePrice : undefined,
                price_negotiable: propertyFor === 'sale' ? priceNegotiable : undefined,
                price_per_sqft: propertyFor === 'sale' ? pricePerSqft : undefined,
                booking_amount: propertyFor === 'sale' ? bookingAmount : undefined,
                
                // Common fields
                available_from: availableFrom,
                furnishing: furnishing,
                parking: parking,
                preferred_tenants: propertyFor === 'rent' ? preferredTenants : undefined,
                
                // Amenities
                bathrooms: bathrooms,
                balconies: balconies,
                non_veg_allowed: nonVegAllowed,
                gated_security: gatedSecurity,
                gym: gym,
                pet_allowed: petAllowed,
                directions_tip: directionsTip,
                current_situation: currentSituation,
                water_supply: waterSupply,
                secondary_number: secondaryNumber,
                other_amenities: otherAmenities,
                description: description,
                
                // Images and contact - USE UPLOADED URLs
                images: uploadedImageUrls,
                contact_number: contactNumber || '',
                
                // Metadata
                category: category,
                subcategory: subcategory,
                is_verified: false,
                is_featured: false,
                status: 'active',
              };

                // Save to Supabase database
                const { data, error } = await createPropertyListing(propertyData);
                
                if (error) {
                  Alert.alert('Error', 'Failed to save property listing. Please try again.');
                  console.error('Error saving property:', error);
                  return;
                }

                // Also save to AsyncStorage for backward compatibility
                const key = 'user_properties';
                const existing = await AsyncStorage.getItem(key);
                const arr = existing ? JSON.parse(existing) : [];
                const newItem = {
                  id: data?.id || String(Date.now()),
                  title: propertyData.title,
                  location: propertyData.location,
                  price: propertyFor === 'rent' ? `₹${rentAmount}/month` : 
                         propertyFor === 'lease' ? `₹${leaseAmount}` : 
                         `₹${salePrice}`,
                  deposit: propertyFor === 'rent' ? depositAmount : 
                           propertyFor === 'lease' ? securityDeposit : '',
                  area: propertySize ? `${propertySize} sqft` : '—',
                  areaType: 'Built-up Area',
                  postedDays: 0,
                  dealerName: (params?.name as string) || 'You',
                  isVerified: false,
                  isFeatured: false,
                  imageCount: uploadedImageUrls.length,
                  category,
                  subcategory,
                  contactNumber: contactNumber || '',
                  person: {
                    name: (params?.name as string) || '',
                    address: (params?.address as string) || '',
                    phone: (params?.phone as string) || contactNumber || '',
                    houseType: (params?.houseType as string) || '',
                    houseAddress: (params?.houseAddress as string) || '',
                  },
                  image: uploadedImageUrls[0] ? { uri: uploadedImageUrls[0] } : require('../../assets/images/Aframe.webp'),
                };
                await AsyncStorage.setItem(key, JSON.stringify([newItem, ...arr]));

                hapticSuccess();
                
                // Determine section label for navigation UI
                const sectionLabelMap: Record<string, string> = {
                  'Residential': 'Residential',
                  'Commercial': 'Commercial',
                  'Industrial': 'Industrial',
                  'Land & Plots': 'Land & Plots',
                  'Properties for Sale': 'Sale',
                  'Properties for Rent': 'Rent / Lease',
                  'Short-term Rentals': 'Short-term Rentals',
                  'PG Accommodations': 'PG',
                  'Ready to Move Properties': 'Ready to Move',
                  'Under Construction Properties': 'Under Construction',
                  'New Launch Properties': 'New Launch',
                };
                const section = sectionLabelMap[subcategory] || sectionLabelMap[category] || 'Residential';
                
                // Navigate to success page
                router.push({ 
                  pathname: '/realestate/listing-success', 
                  params: { 
                    propertyTitle: propertyData.title,
                    propertyType: propertyFor === 'rent' ? 'For Rent' : 
                                  propertyFor === 'lease' ? 'For Lease' : 'For Sale',
                    section: section
                  } 
                });
              } catch (error) {
                console.error('Error saving property listing:', error);
                Alert.alert('Error', 'Failed to save property listing. Please try again.');
              }
            }}
          >
            <Text style={styles.primaryBtnText}>Save and Continue</Text>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)}>
            <View style={[styles.datePickerSheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 16 }]}>
                {datePickerType === 'availableFrom' ? 'Select Available From Date' :
                 datePickerType === 'leaseStart' ? 'Select Lease Start Date' :
                 'Select Lease End Date'}
              </Text>
              
              <ScrollView style={{ maxHeight: 300 }}>
                {/* Generate next 90 days */}
                {Array.from({ length: 365 }, (_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() + i);
                  const formatted = date.toLocaleDateString('en-GB');
                  const displayDate = date.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  });
                  
                  const currentValue = datePickerType === 'availableFrom' ? availableFrom :
                                      datePickerType === 'leaseStart' ? leaseStart : leaseEnd;
                  
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        if (datePickerType === 'availableFrom') {
                          setAvailableFrom(formatted);
                        } else if (datePickerType === 'leaseStart') {
                          setLeaseStart(formatted);
                        } else {
                          setLeaseEnd(formatted);
                        }
                        setShowDatePicker(false);
                        hapticSuccess();
                      }}
                      style={[
                        styles.dateOption,
                        { 
                          backgroundColor: currentValue === formatted ? colors.secondary + '20' : 'transparent',
                          borderColor: colors.border 
                        }
                      ]}
                    >
                      <Text style={{ 
                        color: currentValue === formatted ? colors.secondary : colors.text,
                        fontWeight: currentValue === formatted ? '700' : '500'
                      }}>
                        {displayDate}
                      </Text>
                      {i === 0 && <Text style={{ color: colors.secondary, fontSize: 12, fontWeight: '600' }}> (Today)</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}

      <OptionModal
        visible={selectOpen.visible}
        colors={colors}
        title={
          selectOpen.key === 'apartmentType' ? 'Select house type' :
          selectOpen.key === 'bhkType' ? 'Select BHK type' :
          selectOpen.key === 'facing' ? 'Select facing' :
          selectOpen.key === 'propertyAge' ? 'Select property age' :
          selectOpen.key === 'floor' ? 'Select floor' :
          selectOpen.key === 'totalFloor' ? 'Select total floors' :
          selectOpen.key === 'currentSituation' ? 'Select current situation' :
          selectOpen.key === 'waterSupply' ? 'Select water supply' : ''
        }
        options={
          selectOpen.key === 'apartmentType' ? options.apartmentType :
          selectOpen.key === 'bhkType' ? options.bhkType :
          selectOpen.key === 'facing' ? options.facing :
          selectOpen.key === 'propertyAge' ? options.propertyAge :
          selectOpen.key === 'floor' ? options.floor :
          selectOpen.key === 'totalFloor' ? options.totalFloor :
          selectOpen.key === 'currentSituation' ? options.currentSituation :
          selectOpen.key === 'waterSupply' ? options.waterSupply : []
        }
        onClose={() => setSelectOpen({ key: '', visible: false })}
        onSelect={(val) => {
          if (selectOpen.key === 'apartmentType') setApartmentType(val);
          if (selectOpen.key === 'bhkType') setBhkType(val);
          if (selectOpen.key === 'facing') setFacing(val);
          if (selectOpen.key === 'propertyAge') setPropertyAge(val);
          if (selectOpen.key === 'floor') setFloor(val);
          if (selectOpen.key === 'totalFloor') setTotalFloor(val);
          if (selectOpen.key === 'currentSituation') setCurrentSituation(val);
          if (selectOpen.key === 'waterSupply') setWaterSupply(val);
          setSelectOpen({ key: '', visible: false });
        }}
      />
    </View>
  );
}

function FieldLabel({ colors, label }: { colors: any; label: string }) {
  return <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>;
}

function SelectField({ colors, value, onPress, icon }: { colors: any; value: string; onPress: () => void; icon?: any }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.select, { backgroundColor: colors.card, borderColor: colors.border }]}> 
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
        {!!icon && <Ionicons name={icon} size={18} color={colors.text} />}
        <Text style={{ color: value.startsWith('Select') ? colors.textSecondary : colors.text, flex: 1 }}>{value}</Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

function OptionModal({ visible, colors, title, options, onClose, onSelect }: { visible: boolean; colors: any; title: string; options: string[]; onClose: () => void; onSelect: (v: string) => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background, borderColor: colors.border }]}> 
          <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {options.map((opt) => (
              <TouchableOpacity key={opt} onPress={() => onSelect(opt)} style={[styles.modalItem, { borderColor: colors.border }]}> 
                <Text style={{ color: colors.text }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

function ChipToggle({ colors, active, label, onPress, icon }: { colors: any; active: boolean; label: string; onPress: () => void; icon?: any }) {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={0.7} 
      style={[
        styles.chipToggle,
        { 
          borderColor: active ? colors.secondary : colors.border, 
          backgroundColor: active ? colors.secondary : 'transparent',
          borderWidth: active ? 0 : 1
        }
      ]}
    > 
      {icon && <Ionicons name={icon} size={16} color={active ? '#fff' : colors.text} style={{ marginRight: 6 }} />}
      <Text style={{ color: active ? '#fff' : colors.text, fontSize: 14, fontWeight: active ? '700' : '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Counter({ label, value, setValue, colors }: { label: string; value: number; setValue: (n: number) => void; colors: any }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[{ marginBottom: 6 }, { color: colors.text }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity onPress={() => setValue(Math.max(0, value - 1))} style={[{ width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth }, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text }}>-</Text>
        </TouchableOpacity>
        <Text style={{ minWidth: 24, textAlign: 'center', color: colors.text }}>{value}</Text>
        <TouchableOpacity onPress={() => setValue(value + 1)} style={[{ width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth }, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerGradient: {
    paddingTop: 0,
    paddingBottom: 20,
  },
  headerSpacer: { height: 50 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 0 },
  iconBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepIndicatorContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  progressBar: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  headerRight: { width: 44 },
  content: { padding: 16, paddingBottom: 32 },
  sectionContainer: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  formContent: {
    marginTop: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, marginTop: 8 },
  stepHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: StyleSheet.hairlineWidth, 
    marginBottom: 12 
  },
  stepBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  stepTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  stepSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  sectionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8, letterSpacing: 0.2 },
  input: { 
    borderWidth: StyleSheet.hairlineWidth, 
    borderRadius: 14, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    marginBottom: 14,
    fontSize: 15,
    fontWeight: '500',
  },
  inputContainer: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  inputIcon: {
    marginRight: 12,
  },
  select: { 
    borderWidth: StyleSheet.hairlineWidth, 
    borderRadius: 14, 
    paddingHorizontal: 16, 
    paddingVertical: 16, 
    marginBottom: 14, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
  },
  textarea: { 
    borderWidth: StyleSheet.hairlineWidth, 
    borderRadius: 14, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    minHeight: 120, 
    textAlignVertical: 'top', 
    marginBottom: 18,
    fontSize: 15,
    fontWeight: '500',
  },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  primaryBtn: { 
    flex: 1, 
    height: 56, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: '#00000066', padding: 24, justifyContent: 'center' },
  modalSheet: { borderRadius: 20, padding: 20, borderWidth: StyleSheet.hairlineWidth, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, letterSpacing: 0.3 },
  modalItem: { paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth },
  imagesBox: { 
    borderWidth: 2, 
    borderStyle: 'dashed',
    borderRadius: 16, 
    padding: 24, 
    alignItems: 'center', 
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  imagesHint: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  imagesSubHint: { fontSize: 13, textAlign: 'center', marginTop: 6, fontWeight: '500' },
  imagesBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  imagesBtn: { 
    paddingHorizontal: 24, 
    paddingVertical: 14, 
    borderRadius: 12,
  },
  imagesBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },
  orRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  orLine: { height: 1, flex: 1 },
  orDot: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, marginHorizontal: 10 },
  imagesHero: { width: '100%', height: 200, borderRadius: 16, marginBottom: 16 },
  helpCard: { flex: 1, borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 8 },
  helpTitle: { fontSize: 13, fontWeight: '700' },
  helpValue: { fontSize: 13, fontWeight: '500' },
  sectionCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 16, marginBottom: 18 },
  rowGap8: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  rowSpace: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  rowGap12: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  checkboxBox: { 
    width: 22, 
    height: 22, 
    borderWidth: 2, 
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10, letterSpacing: 0.2 },
  negotiableRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, marginTop: 8 },
  negotiableBox: { width: 24, height: 24, borderWidth: 2, borderRadius: 8 },
  chipToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  datePickerSheet: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    maxHeight: '70%',
  },
  dateOption: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 8,
  },
});


