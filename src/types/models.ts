export enum ModuleId {
  DASHBOARD = 'dashboard',
  PRODUCTION = 'production',
  WAGES = 'wages',
  PAYMENTS = 'payments',
  LOANS = 'loans',
  FUNDS = 'funds',
  INCOME_EXPENSE = 'income_expense',
  REPORTS = 'reports',
  DATA_MANAGEMENT = 'data_management',
  SETTINGS = 'settings',
}

export type ThemeMode = 'light' | 'dark';

export interface UploadedPhotoPreview {
  id: string;
  fileName: string;
  fileSize: number;
  previewUrl: string;
  mimeType: string;
}

export interface ProductionEntry {
  id: string;
  userId?: string;
  date: string; // DD-MM-YYYY
  garmentType: string;
  size: string;
  color: string;
  dozens: number | null;
  pieces: number | null;
  ratePerDozen: number | null;
  totalWage: number | null;
  shortDescription: string;
  photos: UploadedPhotoPreview[];
  createdAt?: string;
}

export interface ProductionFilterState {
  searchQuery: string;
  date: string; // DD-MM-YYYY
  garmentType: string;
  size: string;
  color: string;
}

export interface WageLedgerRecord {
  id: string;
  periodLabel: string;
  startDate: string; // DD-MM-YYYY
  endDate: string; // DD-MM-YYYY
  lineNumber: string;
  totalDozens: number | null;
  totalPieces: number | null;
  earnedWage: number | null;
  paidWage: number | null;
  outstandingWage: number | null;
  statusLabel: string;
}

export interface PaymentWithdrawalRecord {
  id: string;
  date: string; // DD-MM-YYYY
  voucherNo: string;
  paymentMethod: string;
  weekReference: string;
  amount: number | null;
  approvedBy: string;
  remarks: string;
}

export interface LoanRecord {
  id: string;
  loanDirection: 'receivable' | 'payable'; // পাওনা ঋণ | দেনা ঋণ
  counterpartyName: string;
  phone: string;
  issueDate: string; // DD-MM-YYYY
  dueDate: string; // DD-MM-YYYY
  principalAmount: number | null;
  settledAmount: number | null;
  remainingBalance: number | null;
  statusLabel: string;
  notes: string;
}

export interface FundRecord {
  id: string;
  fundName: string;
  fundType: string;
  openingDate: string; // DD-MM-YYYY
  monthlyContribution: number | null;
  targetAmount: number | null;
  currentBalance: number | null;
  institutionOrMethod: string;
  notes: string;
}

export interface IncomeExpenseRecord {
  id: string;
  date: string; // DD-MM-YYYY
  transactionType: 'income' | 'expense'; // আয় | ব্যয়
  category: string;
  paymentMethod: string;
  amount: number | null;
  description: string;
}

export interface WeeklyEarningsPoint {
  dayLabel: string;
  dateLabel: string; // DD-MM-YYYY
  earnedAmount: number | null;
}

export interface MonthlyIncomeExpensePoint {
  monthLabel: string;
  incomeAmount: number | null;
  expenseAmount: number | null;
}

export interface DashboardSummaryMetrics {
  todayEarnedWages: number | null;
  weekEarnedWages: number | null;
  monthEarnedWages: number | null;
  totalOutstandingWages: number | null;
  totalWeeklyWithdrawals: number | null;
  totalPersonalExpenses: number | null;
  totalLoanReceivable: number | null;
  totalLoanPayable: number | null;
  totalFundBalance: number | null;
}

export interface SupabaseConnectionState {
  isConfigured: boolean;
  projectUrl: string | null;
  authProvider: 'google';
  storageBucket: string;
  statusMessageBn: string;
}
