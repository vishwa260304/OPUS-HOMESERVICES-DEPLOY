// Import AsyncStorage for persistence
import AsyncStorage from '@react-native-async-storage/async-storage';

// TypeScript interfaces for app state
export interface CompanyInfo {
  companyName: string;
  typeOfBusiness: string;
  servicesOffered: string;
  phone: string;
  email: string;
  address: string;
  photo: string | null;
  providerServiceId?: number; // The provider_service_id from provider_service_mapping table
}

export interface User {
  name: string | null;
  phone: string | null;
  email: string | null;
  isLoggedIn: boolean;
}

export interface Account {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  password: string | null;
}

export interface Stats {
  totalRequests: number;
  acceptedRequests: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  sub: string;
  time: string;
  read: boolean;
}

export interface KycData {
  uploaded: boolean;
  data: any | null;
}

export interface BankAccount {
  id: string | number;
  [key: string]: any;
}

export interface Employee {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  status: 'active' | 'inactive';
  avatar?: string | null;
  photo?: string | null;
  [key: string]: any;
}

export interface Booking {
  id: string;
  customerName: string;
  location: string;
  serviceName: string;
  amount: string | number;
  paymentMode: string;
  status: 'New' | 'Assigned' | 'InProgress' | 'Completed' | 'Cancelled' | 'Unassigned';
  partnerId?: string | null;
  partnerName?: string | null;
  partnerPhone?: string | null;
  partnerPhoto?: string | null;
  createdAt: string;
  assignedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  [key: string]: any;
}

export interface Ticket {
  id: string;
  title: string;
  category: string;
  orderRef: string;
  description: string;
  status: string;
  updatedAt: string;
}

export interface EarningsSummary {
  todayAmount: number;
  todayCompletedCount: number;
  weeklyAmount: number;
  acceptancePct: number;
}

export interface Feedback {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
}

export type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

export interface BreakTime {
  start: string;
  end: string;
}

export interface AvailabilityState {
  days: Record<DayKey, DaySchedule>;
  breaks: BreakTime[];
  autoAccept: boolean;
  maxDistanceKm: number;
}

export interface AppState {
  companyInfo: CompanyInfo;
  onlineStatus: boolean;
  user: User;
  accounts: Account[];
  lastUsedAccountId: string | null;
  stats: Stats;
  notifications: Notification[];
  selectedSector: string;
  kyc: KycData;
  bankAccounts: BankAccount[];
  employees: Employee[];
  bookings: Booking[];
  currentAssignBookingId: string | null;
  tickets: Ticket[];
  feedbacks: Feedback[];
  availability: AvailabilityState;
}

// Simple in-memory app state. Replace with AsyncStorage/Backend as needed.
const appState: AppState = {
  companyInfo: {
    companyName: 'Fixit Partner',
    typeOfBusiness: 'Multi-sector services platform',
    servicesOffered: 'Healthcare, Home Services, Automobile, Appliance Services',
    phone: '+91-9876543210',
    email: 'support@fixit.com',
    address: 'Chennai, Tamil Nadu, India',
    photo: null,
  },
  onlineStatus: false,
  user: {
    name: null,
    phone: null,
    email: null,
    isLoggedIn: false,
  },
  // New: simple multi-account store (in-memory)
  accounts: [], // each: { id, name, email, phone, password }
  lastUsedAccountId: null,
  stats: {
    totalRequests: 0,
    acceptedRequests: 0,
  },
  notifications: [],
  selectedSector: 'home',
  kyc: { uploaded: false, data: null },
  bankAccounts: [],
  employees: [],
  bookings: [],
  currentAssignBookingId: null,
  tickets: [],
  feedbacks: [],
  availability: {
    days: {
      Mon: { enabled: true, start: '09:00', end: '18:00' },
      Tue: { enabled: true, start: '09:00', end: '18:00' },
      Wed: { enabled: true, start: '09:00', end: '18:00' },
      Thu: { enabled: true, start: '09:00', end: '18:00' },
      Fri: { enabled: true, start: '09:00', end: '18:00' },
      Sat: { enabled: false, start: '10:00', end: '16:00' },
      Sun: { enabled: false, start: '10:00', end: '16:00' },
    },
    breaks: [{ start: '13:00', end: '14:00' }],
    autoAccept: false,
    maxDistanceKm: 10,
  },
};

export const getCompanyInfo = (): CompanyInfo => ({ ...appState.companyInfo });

export const setCompanyInfo = (updates: Partial<CompanyInfo>): CompanyInfo => {
  appState.companyInfo = { ...appState.companyInfo, ...updates };
  return { ...appState.companyInfo };
};

const ONLINE_STATUS_KEY = '@provider_online_status';

// Load online status from AsyncStorage on app start
export const loadOnlineStatus = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(ONLINE_STATUS_KEY);
    if (value !== null) {
      appState.onlineStatus = value === 'true';
    }
  } catch (error) {
    console.error('Error loading online status:', error);
  }
  return appState.onlineStatus;
};

export const getOnlineStatus = (): boolean => appState.onlineStatus;

export const setOnlineStatus = async (value: boolean): Promise<boolean> => {
  appState.onlineStatus = !!value;
  // Persist to AsyncStorage
  try {
    await AsyncStorage.setItem(ONLINE_STATUS_KEY, String(appState.onlineStatus));
  } catch (error) {
    console.error('Error saving online status:', error);
  }
  return appState.onlineStatus;
};

export const setUser = (user: Partial<User>): User => {
  appState.user = { ...appState.user, ...user, isLoggedIn: true };
  // propagate to profile/company info if provided
  if (user?.name) appState.companyInfo.companyName = user.name;
  if (user?.phone) appState.companyInfo.phone = user.phone;
  if (user?.email) appState.companyInfo.email = user.email;
  return { ...appState.user };
};

export const getUser = (): User => ({ ...appState.user });

export const logout = async (): Promise<boolean> => {
  appState.user = { name: null, phone: null, email: null, isLoggedIn: false };
  appState.onlineStatus = false;
  // Clear persisted online status
  try {
    await AsyncStorage.removeItem(ONLINE_STATUS_KEY);
  } catch (error) {
    console.error('Error clearing online status:', error);
  }
  return true;
};

// Accounts helpers (in-memory)
export const getAccounts = (): Account[] => appState.accounts.map(a => ({ ...a }));
export const addAccount = (account: Partial<Account>): Account => {
  const id = account?.id || String(Date.now());
  const newAcc: Account = {
    id,
    name: account?.name || 'User',
    email: account?.email || null,
    phone: account?.phone || null,
    password: account?.password || null,
  };
  // Avoid duplicate by email or phone
  const exists = appState.accounts.find(a => (newAcc.email && a.email === newAcc.email) || (newAcc.phone && a.phone === newAcc.phone));
  if (!exists) {
    appState.accounts = [newAcc, ...appState.accounts];
  }
  appState.lastUsedAccountId = (exists ? exists.id : newAcc.id);
  return exists || newAcc;
};
export const setLastUsedAccountId = (id: string): string => {
  appState.lastUsedAccountId = id;
  return id;
};
export const getLastUsedAccount = (): Account | null => appState.accounts.find(a => a.id === appState.lastUsedAccountId) || null;

export const findAccountByLogin = (login: string): Account | null => {
  if (!login) return null;
  const key = String(login).toLowerCase();
  return appState.accounts.find(a => (a.email && a.email.toLowerCase() === key) || (a.phone && a.phone === key)) || null;
};

export interface AuthResult {
  ok: boolean;
  reason?: string;
  account?: Account;
}

export const authenticate = ({ login, password }: { login: string; password: string }): AuthResult => {
  const acc = findAccountByLogin(login);
  if (!acc) return { ok: false, reason: 'not_found' };
  if (acc.password && password && acc.password !== password) {
    return { ok: false, reason: 'bad_credentials' };
  }
  setLastUsedAccountId(acc.id);
  setUser({ name: acc.name, email: acc.email, phone: acc.phone });
  return { ok: true, account: { ...acc } };
};

// Simple job stats
export const recordJobRequest = (): Stats => {
  appState.stats.totalRequests += 1;
  return { ...appState.stats };
};
export const recordJobAccepted = (): Stats => {
  appState.stats.acceptedRequests += 1;
  return { ...appState.stats };
};
export const getStats = (): Stats => ({ ...appState.stats });

// Notifications
export const pushNotification = (n: Partial<Notification>): Notification => {
  const id = n?.id || String(Date.now());
  const note: Notification = {
    id,
    type: n?.type || 'order',
    title: n?.title || 'New request',
    sub: n?.sub || '',
    time: n?.time || 'just now',
    read: false
  };
  appState.notifications = [note, ...appState.notifications];
  return note;
};
export const getNotifications = (): Notification[] => appState.notifications.map(n => ({ ...n }));
export const clearNotifications = (): Notification[] => {
  appState.notifications = [];
  return [];
};

// Selected sector for Add Services defaults
export const setSelectedSector = (sector: string): string => {
  const allowed = ['home', 'healthcare', 'appliance', 'automobile', 'actingDrivers'];
  if (allowed.includes(sector)) appState.selectedSector = sector;
  return appState.selectedSector;
};
export const getSelectedSector = (): string => appState.selectedSector;

// KYC
export const getKyc = (): KycData => ({ ...appState.kyc });
export const setKyc = (updates: Partial<KycData>): KycData => {
  appState.kyc = { ...appState.kyc, ...updates };
  return getKyc();
};

// Bank accounts (in-memory persistence)
export const getBankAccounts = (): BankAccount[] => appState.bankAccounts.map(b => ({ ...b }));
export const setBankAccounts = (list: BankAccount[]): BankAccount[] => {
  appState.bankAccounts = Array.isArray(list) ? list.map(b => ({ ...b })) : [];
  return getBankAccounts();
};
export const upsertBankAccount = (account: BankAccount): BankAccount[] => {
  const list = getBankAccounts();
  const idx = list.findIndex(a => a.id === account.id);
  let next: BankAccount[] = [];
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...account };
    next = list;
  } else {
    // enforce maximum of 3 accounts
    if (list.length >= 3) return list;
    next = [{ ...account, id: account.id || Date.now() }, ...list];
  }
  setBankAccounts(next);
  return getBankAccounts();
};
export const removeBankAccountById = (id: string | number): BankAccount[] => {
  setBankAccounts(getBankAccounts().filter(a => a.id !== id));
  return getBankAccounts();
};

// Employees
export const getEmployees = (): Employee[] => appState.employees.map(e => ({ ...e }));
export const addEmployee = (employee: Partial<Employee>): Employee => {
  const id = employee?.id || String(Date.now());
  const newEmp: Employee = {
    id,
    name: employee?.name || 'Unnamed Employee',
    phone: employee?.phone,
    email: employee?.email,
    role: employee?.role,
    status: employee?.status || 'active',
    avatar: employee?.avatar || null,
    photo: employee?.photo || null,
  };
  appState.employees = [newEmp, ...appState.employees];
  return newEmp;
};
export const removeEmployee = (id: string): Employee[] => {
  appState.employees = appState.employees.filter(e => e.id !== id);
  return getEmployees();
};

// Bookings
export const getBookings = (): Booking[] => appState.bookings.map(b => ({ ...b })); // Spread preserves all fields including appointmentDate/appointmentTime
export const setBookings = (bookings: Booking[]): void => {
  // Ensure all fields are preserved when setting bookings
  appState.bookings = bookings.map(b => ({ ...b }));
};
export const addBooking = (booking: Partial<Booking>): Booking => {
  const id = booking?.id || String(Date.now());
  const newBooking: Booking = {
    id,
    customerName: booking?.customerName || 'Unknown Customer',
    location: booking?.location || 'Unknown Location',
    serviceName: booking?.serviceName || 'Unknown Service',
    amount: booking?.amount || '0',
    paymentMode: booking?.paymentMode || 'Unknown',
    status: booking?.status || 'New',
    partnerId: booking?.partnerId || null,
    partnerName: booking?.partnerName || null,
    partnerPhone: booking?.partnerPhone || null,
    partnerPhoto: booking?.partnerPhoto || null,
    createdAt: booking?.createdAt || new Date().toISOString(),
    assignedAt: booking?.assignedAt,
    completedAt: booking?.completedAt,
    cancelledAt: booking?.cancelledAt,
    // Preserve all additional fields from the booking object (including appointmentDate, appointmentTime, etc.)
    ...booking,
  };
  appState.bookings = [newBooking, ...appState.bookings];
  return newBooking;
};
export const markBookingInProgress = (id: string): Booking[] => {
  appState.bookings = appState.bookings.map(b => b.id === id ? { ...b, status: 'InProgress' } : b);
  return getBookings();
};
export const completeBooking = (id: string): Booking[] => {
  // Find the booking to get the partner ID
  const booking = appState.bookings.find(b => b.id === id);

  // Mark booking as completed
  appState.bookings = appState.bookings.map(b => b.id === id ? { ...b, status: 'Completed', completedAt: new Date().toISOString() } : b);

  // If there was a partner assigned, mark them as available again
  if (booking && booking.partnerId) {
    appState.employees = appState.employees.map(e =>
      e.id === booking.partnerId ? { ...e, status: 'active' } : e
    );
  }

  return getBookings();
};

export const cancelBooking = (id: string): Booking[] => {
  // Find the booking to get the partner ID
  const booking = appState.bookings.find(b => b.id === id);

  // Mark booking as cancelled
  appState.bookings = appState.bookings.map(b => b.id === id ? { ...b, status: 'Cancelled', cancelledAt: new Date().toISOString() } : b);

  // If there was a partner assigned, mark them as available again
  if (booking && booking.partnerId) {
    appState.employees = appState.employees.map(e =>
      e.id === booking.partnerId ? { ...e, status: 'active' } : e
    );
  }

  return getBookings();
};
export const updateBookingStatus = (id: string, status: Booking['status']): Booking[] => {
  if (!id || !status) return getBookings();
  switch (status) {
    case 'InProgress':
      return markBookingInProgress(id);
    case 'Completed':
      return completeBooking(id);
    case 'Cancelled':
      return cancelBooking(id);
    default: {
      appState.bookings = appState.bookings.map(b => {
        if (b.id !== id) return b;
        const updates: Partial<Booking> = { status };
        if (status === 'Assigned' && !b.assignedAt) {
          updates.assignedAt = new Date().toISOString();
        }
        if (status === 'New') {
          updates.assignedAt = undefined;
          updates.completedAt = undefined;
          updates.cancelledAt = undefined;
          updates.partnerId = null;
          updates.partnerName = null;
          updates.partnerPhone = null;
          updates.partnerPhoto = null;
        }
        return { ...b, ...updates } as Booking;
      });
      return getBookings();
    }
  }
};
export const setCurrentAssignBooking = (id: string): string => {
  appState.currentAssignBookingId = id;
  return id;
};
export const getCurrentAssignBooking = (): string | null => appState.currentAssignBookingId;
export const assignPartnerToBooking = (bookingId: string, employee: Employee): Booking[] => {
  // Mark partner busy
  appState.employees = appState.employees.map(e => e.id === employee.id ? { ...e, status: 'inactive' } : e);
  // Update existing booking
  let updated = false;
  appState.bookings = appState.bookings.map(b => {
    if (b.id === bookingId) {
      updated = true;
      return {
        ...b,
        status: 'Assigned',
        partnerId: employee.id,
        partnerName: employee.name,
        partnerPhone: employee.phone,
        partnerPhoto: employee.photo || null,
        assignedAt: new Date().toISOString()
      };
    }
    return b;
  });
  if (!updated) {
    // fallback: create a new booking
    assignPartnerToNewBooking(employee);
  }
  return getBookings();
};
export const assignPartnerToNewBooking = (employee: Employee, bookingInfo: Partial<Booking> = {}): Booking => {
  // Mark partner busy
  appState.employees = appState.employees.map(e => e.id === employee.id ? { ...e, status: 'inactive' } : e);
  // Create a simple booking entry
  const defaultBooking: Partial<Booking> = {
    customerName: bookingInfo.customerName || 'Customer',
    location: bookingInfo.location || 'Nearby',
    serviceName: bookingInfo.serviceName || (employee.role || 'Service'),
    amount: bookingInfo.amount || '—',
    paymentMode: bookingInfo.paymentMode || '—',
    status: 'Assigned',
    partnerId: employee.id,
    partnerName: employee.name,
    partnerPhone: employee.phone,
    partnerPhoto: employee.photo || null,
    createdAt: new Date().toISOString(),
    assignedAt: new Date().toISOString(),
  };
  return addBooking(defaultBooking);
};

// Tickets
export const getTickets = (): Ticket[] => appState.tickets.map(t => ({ ...t }));
export const addTicket = (ticket: Partial<Ticket>): Ticket => {
  const id = ticket?.id || String(Date.now());
  const newTicket: Ticket = {
    id,
    title: ticket?.title || 'Support Ticket',
    category: ticket?.category || 'Other',
    orderRef: ticket?.orderRef || '',
    description: ticket?.description || '',
    status: ticket?.status || 'Pending',
    updatedAt: ticket?.updatedAt || new Date().toISOString(),
  };
  appState.tickets = [newTicket, ...appState.tickets];
  return newTicket;
};

// Earnings / Insights helpers
const parseAmountToNumber = (amount: string | number): number => {
  if (typeof amount === 'number') return amount;
  if (!amount) return 0;
  const n = Number(String(amount).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const isSameDay = (aIso: string, bIso: string): boolean => {
  if (!aIso || !bIso) return false;
  const a = new Date(aIso);
  const b = new Date(bIso);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

const isWithinLastDays = (iso: string, days: number): boolean => {
  if (!iso) return false;
  const d = new Date(iso).getTime();
  const now = Date.now();
  return d >= now - days * 24 * 60 * 60 * 1000;
};

export const getEarningsSummary = (): EarningsSummary => {
  const list = getBookings();
  const nowIso = new Date().toISOString();
  const todayCompleted = list.filter(b => b.status === 'Completed' && isSameDay(b.createdAt, nowIso));
  const todayAmount = todayCompleted.reduce((sum, b) => sum + parseAmountToNumber(b.amount), 0);

  const weeklyList = list.filter(b => isWithinLastDays(b.createdAt, 7));
  const weeklyAmount = weeklyList
    .filter(b => b.status === 'Completed' || b.status === 'InProgress')
    .reduce((sum, b) => sum + parseAmountToNumber(b.amount), 0);

  const total = list.length;
  const accepted = list.filter(b => b.status === 'Assigned' || b.status === 'InProgress' || b.status === 'Completed').length;
  const acceptancePct = total ? Math.round((accepted / total) * 100) : 0;

  return {
    todayAmount,
    todayCompletedCount: todayCompleted.length,
    weeklyAmount,
    acceptancePct,
  };
};

// Persistence helpers for earnings summary + avg rating
const EARNINGS_SUMMARY_KEY = '@provider_earnings_summary';
const AVG_RATING_KEY = '@provider_avg_rating';

export const cacheEarningsSummary = async (summary: EarningsSummary): Promise<void> => {
  try {
    await AsyncStorage.setItem(EARNINGS_SUMMARY_KEY, JSON.stringify(summary));
  } catch (error) {
    console.error('Error caching earnings summary:', error);
  }
};

export const loadCachedEarningsSummary = async (): Promise<EarningsSummary | null> => {
  try {
    const raw = await AsyncStorage.getItem(EARNINGS_SUMMARY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EarningsSummary;
  } catch (error) {
    console.error('Error loading cached earnings summary:', error);
    return null;
  }
};

export const cacheAvgRating = async (data: { avgRating: number; reviewCount: number }): Promise<void> => {
  try {
    await AsyncStorage.setItem(AVG_RATING_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error caching avg rating:', error);
  }
};

export const loadCachedAvgRating = async (): Promise<{ avgRating: number; reviewCount: number } | null> => {
  try {
    const raw = await AsyncStorage.getItem(AVG_RATING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { avgRating: number; reviewCount: number };
  } catch (error) {
    console.error('Error loading cached avg rating:', error);
    return null;
  }
};

// Total wallet balance derived from all completed bookings
export const getWalletBalance = (): number => {
  const list = getBookings();
  return list
    .filter(b => b.status === 'Completed')
    .reduce((sum, b) => sum + parseAmountToNumber(b.amount), 0);
};

// Dev helpers
export const clearFakeBookings = (): Booking[] => {
  // Remove demo/test bookings created via the dev button
  appState.bookings = appState.bookings.filter(b => !(b.customerName === 'Test User' || b.serviceName === 'Demo Service'));
  return getBookings();
};

export const clearAllBookings = (): Booking[] => {
  appState.bookings = [];
  return getBookings();
};

// Feedback functions
export const getFeedbacks = (): Feedback[] => {
  return appState.feedbacks.map(f => ({ ...f }));
};

export const addFeedback = (feedback: Partial<Feedback>): Feedback => {
  const newFeedback: Feedback = {
    id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    customerName: feedback.customerName || 'Anonymous',
    rating: feedback.rating || 5,
    comment: feedback.comment || '',
    date: feedback.date || new Date().toISOString(),
  };
  appState.feedbacks.push(newFeedback);
  return { ...newFeedback };
};

export const generateDummyFeedbacks = (count: number): Feedback[] => {
  const dummyNames = [
    'Sarah Johnson', 'Michael Chen', 'Emily Rodriguez', 'David Kim', 'Lisa Thompson',
    'James Wilson', 'Maria Garcia', 'Robert Brown', 'Jennifer Davis', 'Christopher Lee',
    'Amanda White', 'Daniel Martinez', 'Jessica Taylor', 'Matthew Anderson', 'Ashley Thomas'
  ];

  const dummyComments = [
    'Excellent service! Very professional and punctual.',
    'Great work, highly recommend!',
    'Very satisfied with the quality of service.',
    'Outstanding service, will definitely use again.',
    'Professional and efficient, exactly what I needed.',
    'Great experience, very happy with the results.',
    'Excellent communication and timely completion.',
    'Very pleased with the service quality.',
    'Outstanding work, exceeded my expectations.',
    'Professional team, highly recommended!',
    'Great service, very reliable and trustworthy.',
    'Excellent work, very satisfied!',
    'Outstanding service, will use again.',
    'Very professional and efficient.',
    'Great experience, highly recommend!'
  ];

  const newFeedbacks: Feedback[] = [];

  for (let i = 0; i < count; i++) {
    const randomName = dummyNames[Math.floor(Math.random() * dummyNames.length)];
    const randomComment = dummyComments[Math.floor(Math.random() * dummyComments.length)];
    const randomRating = Math.round((Math.random() * 2 + 3) * 10) / 10; // Rating between 3.0 and 5.0
    const randomDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Random date within last 30 days

    const feedback = addFeedback({
      customerName: randomName,
      rating: randomRating,
      comment: randomComment,
      date: randomDate.toISOString(),
    });

    newFeedbacks.push(feedback);
  }

  return newFeedbacks;
};

// Availability functions
export const getAvailability = (): AvailabilityState => {
  return { ...appState.availability };
};

export const setAvailability = (availability: AvailabilityState): AvailabilityState => {
  appState.availability = { ...availability };
  return { ...appState.availability };
};

// Doctor Specializations
export interface DoctorSpecialization {
  id: string;
  name: string;
  icon: string;
  category: string;
}

const DOCTOR_SPECIALIZATIONS_KEY = '@provider_doctor_specializations';

export const getDoctorSpecializations = async (): Promise<DoctorSpecialization[]> => {
  // Try to get from AsyncStorage first
  try {
    const stored = await AsyncStorage.getItem(DOCTOR_SPECIALIZATIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading doctor specializations:', error);
  }
  return [];
};

export const setDoctorSpecializations = async (specializations: DoctorSpecialization[]): Promise<DoctorSpecialization[]> => {
  try {
    await AsyncStorage.setItem(DOCTOR_SPECIALIZATIONS_KEY, JSON.stringify(specializations));
  } catch (error) {
    console.error('Error saving doctor specializations:', error);
  }
  return specializations;
};

export const hasDoctorSpecializationSet = async (): Promise<boolean> => {
  try {
    const stored = await AsyncStorage.getItem(DOCTOR_SPECIALIZATIONS_KEY);
    return stored !== null && JSON.parse(stored).length > 0;
  } catch (error) {
    console.error('Error checking doctor specializations:', error);
    return false;
  }
};

export default appState;
