import {
  DashboardSummaryMetrics,
  FundRecord,
  IncomeExpenseRecord,
  LoanRecord,
  MonthlyIncomeExpensePoint,
  PaymentWithdrawalRecord,
  ProductionEntry,
  WageLedgerRecord,
  WeeklyEarningsPoint,
} from '../types/models';

/**
 * Financial & Production Domain Service Layer
 *
 * Centralizes data structures and Supabase repository contracts outside presentation components.
 * In Phase 1 (Initial Foundation), no fake financial math or localStorage persistence is executed.
 * All structures are typed and ready to bind directly to Supabase PostgreSQL queries in Phase 2.
 */

export function getInitialDashboardMetrics(): DashboardSummaryMetrics {
  return {
    todayEarnedWages: null,
    weekEarnedWages: null,
    monthEarnedWages: null,
    totalOutstandingWages: null,
    totalWeeklyWithdrawals: null,
    totalPersonalExpenses: null,
    totalLoanReceivable: null,
    totalLoanPayable: null,
    totalFundBalance: null,
  };
}

export function getWeeklyChartTemplate(): WeeklyEarningsPoint[] {
  return [
    { dayLabel: 'শনিবার', dateLabel: '—', earnedAmount: null },
    { dayLabel: 'রবিবার', dateLabel: '—', earnedAmount: null },
    { dayLabel: 'সোমবার', dateLabel: '—', earnedAmount: null },
    { dayLabel: 'মঙ্গলবার', dateLabel: '—', earnedAmount: null },
    { dayLabel: 'বুধবার', dateLabel: '—', earnedAmount: null },
    { dayLabel: 'বৃহস্পতিবার', dateLabel: '—', earnedAmount: null },
    { dayLabel: 'শুক্রবার', dateLabel: '—', earnedAmount: null },
  ];
}

export function getMonthlyChartTemplate(): MonthlyIncomeExpensePoint[] {
  return [
    { monthLabel: 'জানুয়ারি', incomeAmount: null, expenseAmount: null },
    { monthLabel: 'ফেব্রুয়ারি', incomeAmount: null, expenseAmount: null },
    { monthLabel: 'মার্চ', incomeAmount: null, expenseAmount: null },
    { monthLabel: 'এপ্রিল', incomeAmount: null, expenseAmount: null },
    { monthLabel: 'মে', incomeAmount: null, expenseAmount: null },
    { monthLabel: 'জুন', incomeAmount: null, expenseAmount: null },
  ];
}

export interface SupabaseTableBlueprint {
  tableName: string;
  titleBn: string;
  purposeBn: string;
  columns: string[];
  rlsPolicyBn: string;
}

export const SUPABASE_SCHEMA_BLUEPRINTS: SupabaseTableBlueprint[] = [
  {
    tableName: 'production_entries',
    titleBn: 'প্রোডাকশন হিসাব টেবিল',
    purposeBn: 'দৈনিক সেলাইকৃত পোশাকের ধরন, সাইজ, রঙ, ডজন, পিস, দর ও ছবির লিংক সংরক্ষণ',
    columns: [
      'id (uuid, PK)',
      'user_id (uuid, FK -> auth.users)',
      'entry_date (date)',
      'garment_type (text)',
      'size (text)',
      'color (text)',
      'dozens (numeric)',
      'pieces (integer)',
      'rate_per_dozen (numeric)',
      'total_wage (numeric)',
      'short_description (text)',
      'photo_urls (text[])',
      'created_at (timestamptz)',
    ],
    rlsPolicyBn: 'শুধুমাত্র লগইনকৃত অপারেটর নিজের প্রোডাকশন তথ্য দেখতে ও পরিবর্তন করতে পারবেন (auth.uid() = user_id)',
  },
  {
    tableName: 'wage_periods',
    titleBn: 'মজুরি ও পাওনা খতিয়ান টেবিল',
    purposeBn: 'সাপ্তাহিক বা মাসিক অর্জিত মজুরি এবং গার্মেন্টস থেকে বকেয়া পাওনার হিসাব',
    columns: [
      'id (uuid, PK)',
      'user_id (uuid, FK)',
      'period_label (text)',
      'start_date (date)',
      'end_date (date)',
      'earned_wage (numeric)',
      'paid_wage (numeric)',
      'outstanding_wage (numeric)',
      'status (text)',
    ],
    rlsPolicyBn: 'অপারেটর ভিত্তিক Row Level Security (RLS) সুরক্ষিত',
  },
  {
    tableName: 'payment_withdrawals',
    titleBn: 'টাকা উত্তোলন টেবিল',
    purposeBn: 'গার্মেন্টস থেকে সাপ্তাহিক বা আংশিক মজুরি উত্তোলনের ভাউচার ও মাধ্যম',
    columns: [
      'id (uuid, PK)',
      'user_id (uuid, FK)',
      'withdrawal_date (date)',
      'voucher_no (text)',
      'payment_method (text)',
      'amount (numeric)',
      'remarks (text)',
    ],
    rlsPolicyBn: 'অপারেটর ভিত্তিক Row Level Security (RLS) সুরক্ষিত',
  },
  {
    tableName: 'loan_records',
    titleBn: 'ঋণের হিসাব টেবিল',
    purposeBn: 'পাওনা ঋণ এবং দেনা ঋণের ব্যক্তি, তারিখ, আসল ও পরিশোধের স্থিতি',
    columns: [
      'id (uuid, PK)',
      'user_id (uuid, FK)',
      'loan_direction (text)',
      'counterparty_name (text)',
      'phone (text)',
      'issue_date (date)',
      'due_date (date)',
      'principal_amount (numeric)',
      'settled_amount (numeric)',
      'remaining_balance (numeric)',
    ],
    rlsPolicyBn: 'অপারেটর ভিত্তিক Row Level Security (RLS) সুরক্ষিত',
  },
  {
    tableName: 'fund_accounts',
    titleBn: 'ফান্ড ম্যানেজমেন্ট টেবিল',
    purposeBn: 'ডিপিএস, জরুরি তহবিল ও ভবিষ্যৎ সঞ্চয় ফান্ডের লক্ষ্যমাত্রা এবং বর্তমান স্থিতি',
    columns: [
      'id (uuid, PK)',
      'user_id (uuid, FK)',
      'fund_name (text)',
      'fund_type (text)',
      'target_amount (numeric)',
      'current_balance (numeric)',
      'updated_at (timestamptz)',
    ],
    rlsPolicyBn: 'অপারেটর ভিত্তিক Row Level Security (RLS) সুরক্ষিত',
  },
  {
    tableName: 'income_expense_transactions',
    titleBn: 'ব্যক্তিগত আয়-ব্যয় টেবিল',
    purposeBn: 'দৈনন্দিন পারিবারিক ও ব্যক্তিগত আয় এবং খরচের খাতওয়ারি লেনদেন',
    columns: [
      'id (uuid, PK)',
      'user_id (uuid, FK)',
      'transaction_date (date)',
      'transaction_type (text)',
      'category (text)',
      'payment_method (text)',
      'amount (numeric)',
      'description (text)',
    ],
    rlsPolicyBn: 'অপারেটর ভিত্তিক Row Level Security (RLS) সুরক্ষিত',
  },
];

export interface ApplicationRepositoryState {
  productionEntries: ProductionEntry[];
  wageRecords: WageLedgerRecord[];
  paymentWithdrawals: PaymentWithdrawalRecord[];
  loanRecords: LoanRecord[];
  fundRecords: FundRecord[];
  incomeExpenseRecords: IncomeExpenseRecord[];
}

export function getInitialRepositoryState(): ApplicationRepositoryState {
  return {
    productionEntries: [],
    wageRecords: [],
    paymentWithdrawals: [],
    loanRecords: [],
    fundRecords: [],
    incomeExpenseRecords: [],
  };
}
