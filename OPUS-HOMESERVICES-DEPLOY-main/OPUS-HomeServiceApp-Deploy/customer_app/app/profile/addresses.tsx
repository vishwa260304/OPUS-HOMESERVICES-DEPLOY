import React, { useEffect, useState, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Platform,
  ToastAndroid,
  Modal,
  Switch,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useNavigation } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { UserAddressesApi } from "../../lib/userAddresses";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from '../../context/ThemeContext';

type Address = {
  id: string;
  line: string;
  tag?: "Home" | "Work" | "Other";
  isDefault?: boolean;
  name?: string;
  phone?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export default function AddressesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [newAddress, setNewAddress] = useState("");
  const [addName, setAddName] = useState<string>("");
  const [addPhone, setAddPhone] = useState<string>("");
  const [addCity, setAddCity] = useState<string>("");
  const [addState, setAddState] = useState<string>("");
  const [addPincode, setAddPincode] = useState<string>("");
  const [addDefault, setAddDefault] = useState<boolean>(false);
  const [addFlat, setAddFlat] = useState<string>("");
  const [addLandmark, setAddLandmark] = useState<string>("");
  const [tag, setTag] = useState<Address["tag"]>("Home");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLine, setEditLine] = useState<string>("");
  const [editTag, setEditTag] = useState<Address["tag"]>("Home");
  const [editName, setEditName] = useState<string>("");
  const [editPhone, setEditPhone] = useState<string>("");
  const [editCity, setEditCity] = useState<string>("");
  const [editState, setEditState] = useState<string>("");
  const [editPincode, setEditPincode] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false } as any);
  }, [navigation]);

  useEffect(() => {
    const load = async () => {
      try {
        if (user?.id) {
          const rows = await UserAddressesApi.listByUser(user.id);
          const mapped: Address[] = rows.map((r) => ({
            id: r.id,
            line: r.line1,
            tag: (r.label as any) || "Home",
            name: r.recipient_name || "",
            phone: r.phone || "",
            city: r.city || "",
            state: r.state || "",
            pincode: r.pincode || "",
          }));
          setAddresses(mapped);
        } else {
          const raw = await AsyncStorage.getItem("user_addresses");
          if (raw) setAddresses(JSON.parse(raw));
        }
      } catch {}
    };
    load();
  }, [user?.id]);

  // Refresh the list whenever this screen regains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      try {
        if (user?.id) {
          const rows = await UserAddressesApi.listByUser(user.id);
          const mapped: Address[] = rows.map((r) => ({
            id: r.id,
            line: r.line1,
            tag: (r.label as any) || 'Home',
            name: r.recipient_name || '',
            phone: r.phone || '',
            city: r.city || '',
            state: r.state || '',
            pincode: r.pincode || '',
          }));
          setAddresses(mapped);
        } else {
          const raw = await AsyncStorage.getItem('user_addresses');
          if (raw) setAddresses(JSON.parse(raw));
        }
      } catch {}
    });
    return unsubscribe as any;
  }, [navigation, user?.id]);

  const persist = async (data: Address[]) => {
    setAddresses(data);
    try {
      if (!user?.id) {
        await AsyncStorage.setItem("user_addresses", JSON.stringify(data));
      }
      if (Platform.OS === "android") {
        ToastAndroid.show("Addresses updated", ToastAndroid.SHORT);
      }
    } catch {}
  };

  const addAddress = async () => {
    const locality = newAddress.trim();
    if (!locality) return;
    try {
      const line1 = [addFlat?.trim(), locality, addLandmark?.trim()].filter(Boolean).join(", ");
      if (user?.id) {
        const saved = await UserAddressesApi.create({
          user_id: user.id,
          label: tag || "Home",
          recipient_name: addName || undefined,
          phone: addPhone || undefined,
          line1,
          city: addCity || "",
          state: addState || "",
          pincode: addPincode || "",
          // default flag may be ignored if backend schema doesn't support it yet
        });
        const next = [
          {
            id: saved.id,
            line: saved.line1,
            tag: (saved.label as any) || "Home",
            name: saved.recipient_name || "",
            phone: saved.phone || "",
            city: saved.city || "",
            state: saved.state || "",
            pincode: saved.pincode || "",
          },
          ...addresses,
        ];
        setAddresses(next);
      } else {
        const next = [
          {
            id: Date.now().toString(),
            line: line1,
            tag,
            isDefault: addresses.length === 0,
            name: addName,
            phone: addPhone,
            city: addCity,
            state: addState,
            pincode: addPincode,
            flat: addFlat,
            landmark: addLandmark,
          },
          ...addresses,
        ];
        await persist(next);
      }
      setNewAddress("");
      setAddName("");
      setAddPhone("");
      setAddCity("");
      setAddState("");
      setAddPincode("");
      setAddFlat("");
      setAddLandmark("");
      setShowAdd(false);
      if (Platform.OS === "android") {
        ToastAndroid.show("Address added", ToastAndroid.SHORT);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to add address");
    }
  };

  const remove = async (id: string) => {
    try {
      if (user?.id) {
        await UserAddressesApi.remove(user.id, id);
        setAddresses((prev) => prev.filter((a) => a.id !== id)); // ✅ update state immediately
        if (Platform.OS === "android") {
          ToastAndroid.show("Address deleted", ToastAndroid.SHORT);
        }
      } else {
        const next = addresses.filter((a) => a.id !== id);
        await persist(next);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to delete address");
    }
  };

  const openEdit = (item: Address) => {
    setEditingId(item.id);
    setEditLine(item.line);
    setEditTag(item.tag ?? "Home");
    setEditName(item.name || "");
    setEditPhone(item.phone || "");
    setEditCity(item.city || "");
    setEditState(item.state || "");
    setEditPincode(item.pincode || "");
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editLine.trim();
    if (!trimmed) return;
    try {
      if (user?.id) {
        await UserAddressesApi.update(user.id, editingId, {
          line1: trimmed,
          label: editTag || "Home",
          recipient_name: editName || undefined,
          phone: editPhone || undefined,
          city: editCity || "",
          state: editState || "",
          pincode: editPincode || "",
        });
      }

      // ✅ Always update from form values to guarantee UI update
      setAddresses((prev) =>
        prev.map((a) =>
          a.id === editingId
            ? {
                ...a,
                line: trimmed,
                tag: editTag,
                name: editName,
                phone: editPhone,
                city: editCity,
                state: editState,
                pincode: editPincode,
              }
            : a
        )
      );

      setShowEdit(false);
      if (Platform.OS === "android") {
        ToastAndroid.show("Address updated", ToastAndroid.SHORT);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save");
    }
  };

  const renderItem = ({ item }: { item: Address }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.tagPill,
            item.tag === "Home" && styles.tagHome,
            item.tag === "Work" && styles.tagWork,
            item.tag === "Other" && styles.tagOther,
          ]}
        >
          <Text style={styles.tagText}>{(item.tag || "Other").toString()}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => openEdit(item)}
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="pencil-outline" size={20} color={colors.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => remove(item.id)}
            style={[styles.iconBtn, styles.iconBtnDanger, { backgroundColor: colors.surface }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {(item.name || item.phone) && (
        <View style={styles.contactInfo}>
          {item.name && <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>}
          {item.phone && <Text style={[styles.contactPhone, { color: colors.textSecondary }]}>{item.phone}</Text>}
        </View>
      )}

      <Text style={[styles.addressMain, { color: colors.text }]}>{item.line}</Text>
      {item.city || item.state || item.pincode ? (
        <Text style={[styles.addressSub, { color: colors.textSecondary }]}>
          {[item.city, item.state].filter(Boolean).join(", ")}
          {item.pincode ? ` - ${item.pincode}` : ""}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Saved address</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item, index) =>
          item?.id ? String(item.id) : `addr-${index}`
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.background }]} />}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="location-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No addresses yet.</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Add an address to get started</Text>
          </View>
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[styles.bigAdd, !user?.id && { opacity: 0.6 }]}
        activeOpacity={0.9}
        onPress={() => {
          if (!user?.id) {
            Alert.alert('Login required', 'Please log in to add addresses.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Login', onPress: () => router.push('/subcategories/login' as any) },
            ]);
            return;
          }
          setShowAdd(true);
        }}
      >
        <LinearGradient
          colors={['#004c8f', '#0c1a5d']}
          style={styles.bigAddGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons
            name="add"
            size={22}
            color="#FFFFFF"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.bigAddText}>Add New Address</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Add Address Modal - Bottom Sheet */}
      <Modal
        visible={showAdd && !!user?.id}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAdd(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity 
            style={styles.sheetBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowAdd(false)} 
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>Add New Address</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.sheetContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionHeader}>Contact Info</Text>
              <TextInput style={styles.modalInput} placeholder="Full Name" value={addName} onChangeText={setAddName} />
              <TextInput style={styles.modalInput} placeholder="Phone" keyboardType="phone-pad" value={addPhone} onChangeText={setAddPhone} />

              <View style={styles.divider} />
              <Text style={styles.sectionHeader}>Address Info</Text>
              <View style={styles.inputRow}>
                <TextInput style={[styles.modalInput, styles.halfInput]} placeholder="Pincode" keyboardType="number-pad" value={addPincode} onChangeText={setAddPincode} />
                <TextInput style={[styles.modalInput, styles.halfInput]} placeholder="City" value={addCity} onChangeText={setAddCity} />
              </View>
              <TextInput style={styles.modalInput} placeholder="State" value={addState} onChangeText={setAddState} />
              <TextInput style={styles.modalInput} placeholder="Locality / Area / Street" value={newAddress} onChangeText={setNewAddress} />
              <TextInput style={styles.modalInput} placeholder="Flat no / Building Name" value={addFlat} onChangeText={setAddFlat} />
              <TextInput style={styles.modalInput} placeholder="Landmark (optional)" value={addLandmark} onChangeText={setAddLandmark} />

              <Text style={styles.sectionHeader}>Address Type</Text>
              <View style={styles.tagRow}>
                {(["Home", "Work", "Other"] as const).map((t) => (
                  <TouchableOpacity key={t} style={[styles.tagOption, tag === t && styles.tagOptionActive]} onPress={() => setTag(t)}>
                    <Text style={[styles.tagOptionText, tag === t && styles.tagOptionTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.switchContainer}>
                <Switch value={addDefault} onValueChange={setAddDefault} />
                <Text style={styles.switchText}>Make as default address</Text>
              </View>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.sheetSaveBtn} onPress={addAddress}>
                <Text style={styles.sheetSaveText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEdit}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEdit(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Address</Text>
            <View style={styles.tagRow}>
              {(["Home", "Work", "Other"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.tagOption,
                    editTag === t && styles.tagOptionActive,
                  ]}
                  onPress={() => setEditTag(t)}
                >
                  <Text
                    style={[
                      styles.tagOptionText,
                      editTag === t && styles.tagOptionTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Full Name"
              value={editName}
              onChangeText={setEditName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Phone Number"
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Address Line"
              value={editLine}
              onChangeText={setEditLine}
              multiline
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="City"
                value={editCity}
                onChangeText={setEditCity}
              />
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="State"
                value={editState}
                onChangeText={setEditState}
              />
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Pincode"
              value={editPincode}
              onChangeText={setEditPincode}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.smallBtn, styles.cancelBtn]}
                onPress={() => setShowEdit(false)}
              >
                <Text style={[styles.smallBtnText, styles.cancelBtnText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallBtn} onPress={saveEdit}>
                <Text style={styles.smallBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", letterSpacing: 0.3 },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  separator: { height: 14 },
  card: {
    marginHorizontal: 0,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDanger: {},
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e9efff",
  },
  tagHome: { backgroundColor: "#dcfce7" },
  tagWork: { backgroundColor: "#dbeafe" },
  tagOther: { backgroundColor: "#fef3c7" },
  tagText: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 13,
    textTransform: "capitalize",
  },
  addressMain: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  addressSub: { marginTop: 4, fontSize: 14, lineHeight: 20 },
  contactInfo: {
    marginTop: 10,
    marginBottom: 6,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  empty: { textAlign: "center", fontSize: 16, fontWeight: "600", marginBottom: 4 },
  emptySub: { textAlign: "center", fontSize: 14, opacity: 0.9 },
  smallBtn: {
    backgroundColor: "#004c8f",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  smallBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  cancelBtn: { backgroundColor: "#e5e7eb" },
  cancelBtnText: { color: "#111" },
  bigAdd: {
    margin: 16,
    borderRadius: 18,
    height: 56,
    overflow: 'hidden', // Ensure gradient doesn't overflow rounded corners
  },
  bigAddGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderRadius: 18,
  },
  bigAddText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOverlay: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    backgroundColor: 'rgba(0,0,0,0.4)' 
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheet: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: '25%', // This will make it take up 75% from the top
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  sheetHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16, // Reduced padding to eliminate white space
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  sheetSaveBtn: { 
    height: 50, 
    borderRadius: 12, 
    backgroundColor: '#2d31ff', 
    alignItems: 'center', 
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  sheetSaveText: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  switchText: {
    marginLeft: 12,
    fontWeight: '600',
    color: '#111',
    fontSize: 14,
  },
  modalCard: {
    width: "86%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: { color: '#111', fontWeight: '800', marginTop: 6, marginBottom: 6 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#111", marginBottom: 8 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  tagRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  tagOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
  },
  tagOptionActive: { backgroundColor: "#2563eb" },
  tagOptionText: {
    color: "#111",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "capitalize",
  },
  tagOptionTextActive: { color: "#fff" },
});