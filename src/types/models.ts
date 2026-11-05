export enum ModuleId {
  DASHBOARD = 'dashboard',
  PRODUCTION = 'production',
  WEEKLY_REPORT = 'weekly_report',
  IMPORT_DATA = 'import_data',
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

export type WorkStatus = 'in_progress' | 'completed';
export type SettlementStatus = 'pending' | 'settled';

export interface UploadedPhotoPreview {
  id: string;
  fileName: string;
  fileSize: number;
  previewUrl: string;
  mimeType: string;
  storagePath?: string;
}

export interface ProductionEntry {
  id: string;
  userId?: string;
  date: string; // DD-MM-YYYY
  itemName: string; // আইটেমের নাম
  category: string; // ক্যাটাগরি
  garmentType: string; // Backward compatible display label
  size: string; // Comma-separated sizes e.g. "M, L"
  sizes: string[]; // Array of selected sizes
  color: string; // Comma-separated colors
  colors: string[]; // Array of selected colors
  dozens: number | null; // Precise Pieces / 12
  pieces: number | null; // Quantity in Pieces
  ratePerDozen: number | null; // Historical rate per dozen stored on entry
  totalWage: number | null; // Earned Wage = Dozens * Rate per Dozen
  receivedWage: number | null; // Actual money received against this entry
  pendingWage: number | null; // Outstanding wage for this entry
  workStatus: WorkStatus; // Independent: 'in_progress' | 'completed'
  settlementStatus: SettlementStatus; // Independent: 'pending' | 'settled'
  startWorkTime: string | null; // ISO or YYYY-MM-DDTHH:mm
  endWorkTime: string | null; // ISO or YYYY-MM-DDTHH:mm
  workDurationMinutes: number | null; // Duration in minutes
  shortDescription: string; // Notes / সংক্ষিপ্ত বিবরণ
  photos: UploadedPhotoPreview[];
  importBatchId?: string;
  createdAt?: string;
}

export interface ProductionFilterState {
  searchQuery: string;
  dateFrom: string; // DD-MM-YYYY
  dateTo: string; // DD-MM-YYYY
  itemName: string;
  category: string;
  size: string;
  color: string;
  workStatus: 'ALL' | WorkStatus;
  settlementStatus: 'ALL' | SettlementStatus;
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
  loanDirection: 'receivable' | 'payable';
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
  transactionType: 'income' | 'expense';
  category: string;
  paymentMethod: string;
  amount: number | null;
  description: string;
}

export interface WeeklyEarningsPoint {
  dayLabel: string;
  dateLabel: string; // DD-MM-YYYY
  pieces: number;
  dozens: number;
  earnedAmount: number;
}

export interface MonthlyIncomeExpensePoint {
  monthLabel: string;
  incomeAmount: number;
  expenseAmount: number;
}

export interface SaturdayToThursdayWeekSummary {
  weekKey: string; // YYYY-MM-DD of Saturday
  weekLabelBn: string;
  saturdayDateDDMMYYYY: string;
  thursdayDateDDMMYYYY: string;
  saturdayIso: string;
  thursdayIso: string;
  totalPieces: number;
  totalDozens: number;
  totalEarnedWages: number;
  totalReceivedWages: number;
  totalOutstandingWages: number;
  advanceBalance: number;
  workingDaysCount: number; // Out of 6 (Saturday to Thursday, Friday excluded)
  averageDailyPieces: number;
  averageDailyDozens: number;
  averageDailyEarnedWages: number;
  dailyBreakdown: WeeklyEarningsPoint[];
  entriesCount: number;
}

export interface DashboardSummaryMetrics {
  todayEarnedWages: number;
  weekEarnedWages: number;
  monthEarnedWages: number;
  totalOutstandingWages: number;
  totalWeeklyWithdrawals: number;
  totalPersonalExpenses: number;
  totalLoanReceivable: number;
  totalLoanPayable: number;
  totalFundBalance: number;
  // New weekly summary card metrics (Saturday to Thursday)
  thisWeekTotalPieces: number;
  thisWeekTotalDozens: number;
  thisWeekReceivedWages: number;
  thisWeekOutstandingWages: number;
  thisWeekAdvanceBalance: number;
  thisWeekWorkingDays: number;
}

export interface SupabaseConnectionState {
  isConfigured: boolean;
  projectUrl: string | null;
  authProvider: 'google';
  storageBucket: string;
  statusMessageBn: string;
}

export type ImportFieldKey =
  | 'date'
  | 'itemName'
  | 'category'
  | 'size'
  | 'color'
  | 'pieces'
  | 'dozens'
  | 'ratePerDozen'
  | 'totalWage'
  | 'receivedWage'
  | 'pendingWage'
  | 'startWorkTime'
  | 'endWorkTime'
  | 'workStatus'
  | 'settlementStatus'
  | 'shortDescription';

export interface ValidatedImportRow {
  rowIndex: number;
  rawRow: Record<string, string>;
  entry: ProductionEntry;
  errorsBn: string[];
  warningsBn: string[];
  isDuplicate: boolean;
  hasCalculationMismatch: boolean;
  skipRow: boolean;
}
