export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  CreateAccount: undefined;
  VerifyPhone: undefined;
  VerifyOTP: { phone?: string } | undefined;
  ForgotPassword: undefined;
  ServiceSectorSelection: undefined;
  KYCVerification: { sector?: 'healthcare' | 'home' | 'automobile' | 'appliance' | 'actingDrivers'; sectorName?: string } | undefined;
  DoctorSpecialization: { editMode?: boolean } | undefined;
  DoctorVerification: { sector?: 'healthcare' | 'home' | 'automobile' | 'appliance' | 'actingDrivers'; sectorName?: string } | undefined;
  DoctorBio: { onboarding?: boolean } | undefined;
  DoctorDashboard: { specialty?: string } | undefined;

  CompletedAppointments: undefined;
  MyPatients: undefined;
  DoctorReviews: undefined;
  ProviderReviews: undefined;
  DoctorWeeklyPerformance: undefined;
  ProviderWeeklyPerformance: undefined;
  Dashboard: undefined;
  PharmDashboard: undefined;
  PharmOrderDetails: { orderId?: string } | undefined;
  ActingDriversDashboard: undefined;
  ActingDriverServices: undefined;
  ActingDriverFare: undefined;
  ActingDriverPersonalDetails: undefined;
  Profile: undefined;
  Bookings: { tab?: 'Active' | 'Upcoming' | 'Completed' } | undefined;
  Earnings: { focus?: 'weekly' | 'monthly'; highlight?: boolean } | undefined;
  WeeklyChart: {
    mode?: 'weekly' | 'monthly';

    weeklyData?: number[];
    weeklyLabels?: string[];
    maxYWeekly?: number;
    titleWeekly?: string;

    monthlyData?: number[];
    monthlyLabels?: string[];
    maxYMonthly?: number;
    titleMonthly?: string;
  } | undefined;
  Support: undefined;
  TechnicalHelp: undefined;
  JobIssues: undefined;
  PaymentIssues: undefined;
  AvailablePartners: { bookingId?: string } | undefined;
  PartnerAssigned: undefined;
  TrackPartner: undefined;
  RaiseTicket: undefined;
  TicketsList: undefined;
  AddNewService: { root?: 'home' | 'healthcare' | 'appliance' | 'automobile' | 'actingDrivers'; lockRoot?: boolean; editService?: any } | undefined;
  AddMedicineProduct: undefined;
  MedicineProducts: undefined;
  YourServices: undefined;
  YourEmployees: undefined;
  EmployeeDetails: undefined;
  EmployeeProfile: {
    employee: {
      id: string;
      name: string;
      role: string;
      phone: string;
      email?: string;
      status: 'active' | 'inactive';
      avatar?: string;
      photo?: string | null;
    };
  };
  AddNewEmployee: { editEmployeeId?: number } | undefined;
  ServiceSubmitted: {
    serviceName: string;
    submittedOn: string;
  };
  CompanyInfo: undefined;
  CompanyLocations: undefined;
  HospitalLocation: undefined;
  BankDetails: undefined;
  Security: undefined;
  Notifications: undefined;
  KYCDetails: undefined;
  ContactTeam: undefined;
  WalletWithdraw: undefined;
  TasksCompletedToday: undefined;
  Availability: undefined;
  CustomerFeedbacks: undefined;
  ActiveJobDetails: { bookingId: string } | undefined;
  ActingDriverBookingDetails: { bookingId: string } | undefined;
  DoctorAppointmentDetails: { appointmentId: string } | undefined;
  PatientDetails: { patientName: string; patientPhone?: string } | undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList { }
  }
}
