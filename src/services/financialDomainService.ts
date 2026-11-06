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
import {
  dateObjToDDMMYYYY,
  parseAnyDateToDateObj,
} from '../utils/formatters';
import {
  BENGALI_MONTH_NAMES,
  computeSaturdayToThursdayWeekSummary,
} from '../utils/weeklyCalendar';

/**
 * Financial & Production Domain Service Layer
 *
 * Centralizes accounting calculations and Saturday-to-Thursday weekly reporting
 * from actual records (never hardcoded in presentation components).
 */

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

/**
 * Computes all Dashboard metrics accurately from actual repository records,
 * enforcing the Saturday-to-Thursday working week and distinguishing:
 * 1. Earned Wage
 * 2. Received Wage
 * 3. Outstanding Wage
 * 4. Advance Balance
 */
export function computeDashboardMetrics(
  repo: ApplicationRepositoryState,
  now: Date = new Date()
): DashboardSummaryMetrics {
  const todayStr = dateObjToDDMMYYYY(now);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Today's earned wages
  const todayEarnedWages = Number(
    repo.productionEntries
      .filter((e) => {
        const dt = parseAnyDateToDateObj(e.date);
        return dt && dateObjToDDMMYYYY(dt) === todayStr;
      })
      .reduce((sum, e) => sum + (e.totalWage ?? 0), 0)
      .toFixed(2)
  );

  // Current Saturday-to-Thursday week summary
  const currentWeekSummary = computeSaturdayToThursdayWeekSummary(
    now,
    repo.productionEntries,
    repo.paymentWithdrawals
  );

  // This month's earned wages
  const monthEarnedWages = Number(
    repo.productionEntries
      .filter((e) => {
        const dt = parseAnyDateToDateObj(e.date);
        return (
          dt &&
          dt.getFullYear() === currentYear &&
          dt.getMonth() === currentMonth
        );
      })
      .reduce((sum, e) => sum + (e.totalWage ?? 0), 0)
      .toFixed(2)
  );

  // Total Earned vs Withdrawn across all production entries & company payment withdrawals
  const allProdEarned = repo.productionEntries.reduce(
    (sum, e) => sum + (e.totalWage ?? 0),
    0
  );
  const allProdPieces = repo.productionEntries.reduce(
    (sum, e) => sum + (e.pieces ?? 0),
    0
  );
  const allProdDozens = Number((allProdPieces / 12).toFixed(2));
  const allProdExplicitReceived = repo.productionEntries.reduce(
    (sum, e) => sum + (e.receivedWage ?? 0),
    0
  );

  const totalWithdrawals = repo.paymentWithdrawals.reduce(
    (sum, w) => sum + (w.amount ?? 0),
    0
  );

  // Use paymentWithdrawals as the primary source of money withdrawn from the company;
  // fall back to explicit receivedWage on entries only if no paymentWithdrawals exist.
  const effectiveTotalWithdrawn =
    totalWithdrawals > 0 ? totalWithdrawals : allProdExplicitReceived;

  // Strictly compute net company receivable as: Total Production Earned - Total Withdrawn
  // (Never add wageRecords.outstandingWage on top of productionEntries, as wageRecords are weekly summaries of the same production!)
  const totalOutstandingWages = Number(
    Math.max(0, allProdEarned - effectiveTotalWithdrawn).toFixed(2)
  );

  const totalPersonalExpenses = Number(
    repo.incomeExpenseRecords
      .filter((tx) => tx.transactionType === 'expense')
      .reduce((sum, tx) => sum + (tx.amount ?? 0), 0)
      .toFixed(2)
  );

  const totalLoanReceivable = Number(
    repo.loanRecords
      .filter((l) => l.loanDirection === 'receivable')
      .reduce((sum, l) => sum + (l.remainingBalance ?? l.principalAmount ?? 0), 0)
      .toFixed(2)
  );

  const totalLoanPayable = Number(
    repo.loanRecords
      .filter((l) => l.loanDirection === 'payable')
      .reduce((sum, l) => sum + (l.remainingBalance ?? l.principalAmount ?? 0), 0)
      .toFixed(2)
  );

  const totalFundBalance = Number(
    repo.fundRecords
      .reduce((sum, f) => sum + (f.currentBalance ?? 0), 0)
      .toFixed(2)
  );

  return {
    todayEarnedWages,
    weekEarnedWages: currentWeekSummary.totalEarnedWages,
    monthEarnedWages,
    totalOutstandingWages,
    totalWeeklyWithdrawals: currentWeekSummary.totalReceivedWages,
    totalPersonalExpenses,
    totalLoanReceivable,
    totalLoanPayable,
    totalFundBalance,
    totalAllTimeEarnedWages: Number(allProdEarned.toFixed(2)),
    totalAllTimeWithdrawals: Number(effectiveTotalWithdrawn.toFixed(2)),
    totalAllTimePieces: allProdPieces,
    totalAllTimeDozens: allProdDozens,
    thisWeekTotalPieces: currentWeekSummary.totalPieces,
    thisWeekTotalDozens: currentWeekSummary.totalDozens,
    thisWeekReceivedWages: currentWeekSummary.totalReceivedWages,
    thisWeekOutstandingWages: currentWeekSummary.totalOutstandingWages,
    thisWeekAdvanceBalance: currentWeekSummary.advanceBalance,
    thisWeekWorkingDays: currentWeekSummary.workingDaysCount,
  };
}

/**
 * Computes current week's Saturday-to-Thursday daily series from actual entries.
 */
export function computeCurrentWeekSeries(
  repo: ApplicationRepositoryState,
  now: Date = new Date()
): WeeklyEarningsPoint[] {
  return computeSaturdayToThursdayWeekSummary(
    now,
    repo.productionEntries,
    repo.paymentWithdrawals
  ).dailyBreakdown;
}

/**
 * Computes last 6 months income & expense series from actual records.
 */
export function computeMonthlyIncomeExpenseSeries(
  repo: ApplicationRepositoryState,
  now: Date = new Date()
): MonthlyIncomeExpensePoint[] {
  const points: MonthlyIncomeExpensePoint[] = [];

  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = dt.getMonth();
    const y = dt.getFullYear();

    const prodEarnedInMonth = repo.productionEntries
      .filter((e) => {
        const parsed = parseAnyDateToDateObj(e.date);
        return parsed && parsed.getFullYear() === y && parsed.getMonth() === m;
      })
      .reduce((sum, e) => sum + (e.totalWage ?? 0), 0);

    const txIncomeInMonth = repo.incomeExpenseRecords
      .filter((tx) => {
        const parsed = parseAnyDateToDateObj(tx.date);
        return (
          tx.transactionType === 'income' &&
          parsed &&
          parsed.getFullYear() === y &&
          parsed.getMonth() === m
        );
      })
      .reduce((sum, tx) => sum + (tx.amount ?? 0), 0);

    const txExpenseInMonth = repo.incomeExpenseRecords
      .filter((tx) => {
        const parsed = parseAnyDateToDateObj(tx.date);
        return (
          tx.transactionType === 'expense' &&
          parsed &&
          parsed.getFullYear() === y &&
          parsed.getMonth() === m
        );
      })
      .reduce((sum, tx) => sum + (tx.amount ?? 0), 0);

    points.push({
      monthLabel: BENGALI_MONTH_NAMES[m],
      incomeAmount: Number((prodEarnedInMonth + txIncomeInMonth).toFixed(2)),
      expenseAmount: Number(txExpenseInMonth.toFixed(2)),
    });
  }

  return points;
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
    titleBn: 'প্রোডাকশন হিসাব টেবিল (উন্নত সংস্করণ)',
    purposeBn:
      'আইটেমের নাম, ক্যাটাগরি, সাইজ, রঙ, পিস, ডজন, ঐতিহাসিক দর, কাজের শুরু/শেষ সময় এবং স্বাধীন পরিশোধ স্ট্যাটাস সংরক্ষণ',
    columns: [
      'id (uuid, PK)',
      'user_id (uuid, FK -> auth.users)',
      'entry_date (date)',
      'item_name (text)',
      'category (text)',
      'sizes (text[])',
      'colors (text[])',
      'pieces (integer)',
      'dozens (numeric)',
      'rate_per_dozen (numeric)',
      'total_wage (numeric)',
      'received_wage (numeric)',
      'pending_wage (numeric)',
      'work_status (in_progress | completed)',
      'settlement_status (pending | settled)',
      'start_work_time (timestamptz)',
      'end_work_time (timestamptz)',
      'work_duration_minutes (integer)',
      'short_description (text)',
      'photo_urls (text[])',
      'import_batch_id (text)',
    ],
    rlsPolicyBn:
      'শুধুমাত্র লগইনকৃত অপারেটর নিজের প্রোডাকশন তথ্য দেখতে ও পরিবর্তন করতে পারবেন (auth.uid() = user_id)',
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
