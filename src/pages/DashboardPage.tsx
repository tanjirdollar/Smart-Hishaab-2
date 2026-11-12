import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  Banknote,
  Calendar,
  CreditCard,
  HandCoins,
  PiggyBank,
  Plus,
  Scissors,
  TrendingUp,
} from 'lucide-react';
import {
  QuickEntrySectionType,
  QuickMultiSectionEntryModal,
} from '../components/ui/QuickMultiSectionEntryModal';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  DashboardSummaryMetrics,
  FundRecord,
  IncomeExpenseRecord,
  LoanRecord,
  ModuleId,
  MonthlyIncomeExpensePoint,
  PaymentWithdrawalRecord,
  ProductionEntry,
  WeeklyEarningsPoint,
} from '../types/models';
import {
  formatCurrencyBDT,
  formatNumberBn,
  parseAnyDateToDateObj,
} from '../utils/formatters';
import {
  computeMultiWeekComparison,
  computeSaturdayToThursdayWeekSummary,
  getWeekStartSaturday,
} from '../utils/weeklyCalendar';

interface DashboardPageProps {
  metrics: DashboardSummaryMetrics;
  recentProduction: ProductionEntry[];
  paymentWithdrawals: PaymentWithdrawalRecord[];
  recentTransactions: IncomeExpenseRecord[];
  funds: FundRecord[];
  loans: LoanRecord[];
  weeklySeries: WeeklyEarningsPoint[];
  monthlySeries: MonthlyIncomeExpensePoint[];
  onNavigate: (module: ModuleId) => void;
  onSaveProduction: (
    entry: ProductionEntry
  ) => Promise<{ persistedToCloud: boolean; errorBn: string | null }>;
  onSaveWithdrawal: (record: PaymentWithdrawalRecord) => void;
  onSaveFund: (fund: FundRecord) => void;
  onSaveLoan: (loan: LoanRecord) => void;
  onSaveTransaction: (tx: IncomeExpenseRecord) => void;
}

type ChartGranularity = 'daily' | 'weekly';

export const DashboardPage: React.FC<DashboardPageProps> = ({
  metrics,
  recentProduction,
  paymentWithdrawals,
  funds,
  loans,
  weeklySeries,
  onNavigate,
  onSaveProduction,
  onSaveWithdrawal,
  onSaveFund,
  onSaveLoan,
  onSaveTransaction,
}) => {
  const [chartMode, setChartMode] = useState<ChartGranularity>('daily');
  const [quickModalOpen, setQuickModalOpen] = useState<boolean>(false);
  const [quickModalSection, setQuickModalSection] =
    useState<QuickEntrySectionType>('withdrawal');

  const openQuickEntry = (section: QuickEntrySectionType) => {
    setQuickModalSection(section);
    setQuickModalOpen(true);
  };

  const currentSaturday = useMemo(() => getWeekStartSaturday(new Date()), []);

  const currentWeek = useMemo(
    () =>
      computeSaturdayToThursdayWeekSummary(
        currentSaturday,
        recentProduction,
        paymentWithdrawals
      ),
    [currentSaturday, recentProduction, paymentWithdrawals]
  );

  const recentWeeksChartData = useMemo(() => {
    const weeks = computeMultiWeekComparison(
      currentSaturday,
      4,
      recentProduction,
      paymentWithdrawals
    );
    return weeks.map((w) => ({
      label: w.saturdayDateDDMMYYYY.slice(0, 5),
      earnedAmount: w.totalEarnedWages,
      receivedAmount: w.totalReceivedWages,
      pieces: w.totalPieces,
    }));
  }, [currentSaturday, recentProduction, paymentWithdrawals]);

  const maxDailyEarned = useMemo(
    () => Math.max(1, ...weeklySeries.map((d) => d.earnedAmount)),
    [weeklySeries]
  );

  const maxWeeklyEarned = useMemo(
    () =>
      Math.max(
        1,
        ...recentWeeksChartData.map((w) =>
          Math.max(w.earnedAmount, w.receivedAmount)
        )
      ),
    [recentWeeksChartData]
  );

  const recentCombinedStream = useMemo(() => {
    type CombinedItem =
      | { kind: 'production'; entry: ProductionEntry; timestamp: number }
      | { kind: 'withdrawal'; record: PaymentWithdrawalRecord; timestamp: number };

    const prods: CombinedItem[] = (recentProduction || []).map((entry) => {
      const dt = parseAnyDateToDateObj(entry.date);
      return {
        kind: 'production',
        entry,
        timestamp: dt ? dt.getTime() : 0,
      };
    });

    const withdrawals: CombinedItem[] = (paymentWithdrawals || []).map((record) => {
      const dt = parseAnyDateToDateObj(record.date);
      return {
        kind: 'withdrawal',
        record,
        timestamp: dt ? dt.getTime() : 0,
      };
    });

    return [...prods, ...withdrawals]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6);
  }, [recentProduction, paymentWithdrawals]);

  return (
    <div className="space-y-4">
      {/* Section-Based Quick Entry Selector Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            নতুন এন্ট্রি যোগ করুন (সেকশন নির্বাচন করুন)
          </span>
          <button
            type="button"
            onClick={() => openQuickEntry('withdrawal')}
            className="text-[11px] font-bold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
          >
            সকল অপশন →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => openQuickEntry('withdrawal')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 border border-emerald-200/80 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">বিল উত্তোলন</span>
          </button>

          <button
            type="button"
            onClick={() => openQuickEntry('fund')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 hover:bg-teal-100/80 dark:hover:bg-teal-900/50 border border-teal-200/80 dark:border-teal-800/70 text-teal-900 dark:text-teal-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <PiggyBank className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="truncate">ফান্ড খরচ / জমা</span>
          </button>

          <button
            type="button"
            onClick={() => openQuickEntry('loan')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/50 border border-amber-200/80 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <HandCoins className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">লোন পরিশোধ</span>
          </button>

          <button
            type="button"
            onClick={() => openQuickEntry('expense')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/50 border border-rose-200/80 dark:border-rose-800/70 text-rose-900 dark:text-rose-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="truncate">ব্যক্তিগত ব্যয় / আয়</span>
          </button>

          <button
            type="button"
            onClick={() => openQuickEntry('production')}
            className="col-span-2 sm:col-span-1 flex items-center justify-center sm:justify-start gap-2 px-3 py-2 rounded-xl bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-600 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Scissors className="w-4 h-4 shrink-0" />
            <span className="truncate">+ প্রোডাকশন কাজ</span>
          </button>
        </div>
      </div>

      {/* Main Two Unified Cards: 1) This Week's Production, 2) Overall Wage & Company Receivable */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: চলতি সপ্তাহের প্রোডাকশন (একটি কার্ডে সাজানো, কর্মদিবস বাদ দেওয়া হয়েছে) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  চলতি সপ্তাহের প্রোডাকশন
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  শনিবার {currentWeek.saturdayDateDDMMYYYY} — বৃহস্পতিবার{' '}
                  {currentWeek.thursdayDateDDMMYYYY}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.WEEKLY_REPORT)}
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
            >
              সাপ্তাহিক রিপোর্ট <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                মোট প্রোডাকশন
              </p>
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {formatNumberBn(metrics.thisWeekTotalPieces)} পিস
              </p>
              <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                {formatNumberBn(metrics.thisWeekTotalDozens)} ডজন
              </p>
            </div>

            <div className="p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/50">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                অর্জিত মজুরি
              </p>
              <p className="text-base sm:text-lg font-bold text-teal-700 dark:text-teal-300 mt-0.5">
                {formatCurrencyBDT(metrics.weekEarnedWages)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                আজ: {formatCurrencyBDT(metrics.todayEarnedWages)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                প্রাপ্ত মজুরি (উত্তোলন)
              </p>
              <p className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {formatCurrencyBDT(metrics.thisWeekReceivedWages)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                এই সপ্তাহে গৃহীত
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                সাপ্তাহিক বকেয়া
              </p>
              <p className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                {formatCurrencyBDT(metrics.thisWeekOutstandingWages)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {metrics.thisWeekAdvanceBalance > 0
                  ? `অগ্রিম: ${formatCurrencyBDT(metrics.thisWeekAdvanceBalance)}`
                  : 'চলতি সপ্তাহের বাকি'}
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: সার্বিক মজুরি ও কোম্পানি হিসাব (মোট কাজ, মোট উত্তোলন, মোট পাওনা ও এই মাসের অর্জিত মজুরি) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  সার্বিক মজুরি ও কোম্পানি হিসাব
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  সর্বমোট প্রোডাকশন, উত্তোলন এবং কোম্পানির কাছে পাওনা
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.PAYMENTS)}
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
            >
              উত্তোলন তালিকা <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                সর্বমোট কাজের মজুরি
              </p>
              <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {formatCurrencyBDT(metrics.totalAllTimeEarnedWages)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatNumberBn(metrics.totalAllTimePieces)} পিস (
                {formatNumberBn(metrics.totalAllTimeDozens)} ডজন)
              </p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                সর্বমোট উত্তোলন
              </p>
              <p className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {formatCurrencyBDT(metrics.totalAllTimeWithdrawals)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                মোট {formatNumberBn(paymentWithdrawals.length)}টি কিস্তিতে গৃহীত
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/70">
              <p className="text-[11px] font-semibold text-amber-900 dark:text-amber-300">
                কোম্পানি থেকে মোট পাওনা
              </p>
              <p className="text-base sm:text-lg font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                {formatCurrencyBDT(metrics.totalOutstandingWages)}
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-400/80">
                কাজের মজুরি − মোট উত্তোলন
              </p>
            </div>

            <div className="p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/50">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                এই মাসের অর্জিত মজুরি
              </p>
              <p className="text-base sm:text-lg font-bold text-teal-700 dark:text-teal-300 mt-0.5">
                {formatCurrencyBDT(metrics.monthEarnedWages)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                চলতি মাসের প্রোডাকশন
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Compact Single Strip for Funds, Loans & Personal Expenses */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 divide-x divide-slate-200 dark:divide-slate-800">
          <div
            onClick={() => onNavigate(ModuleId.FUNDS)}
            className="pr-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 cursor-pointer group"
          >
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-teal-600">
                ফান্ড ব্যালেন্স
              </p>
              <p className="text-sm sm:text-base font-bold text-teal-700 dark:text-teal-300">
                {formatCurrencyBDT(metrics.totalFundBalance)}
              </p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline">
              {formatNumberBn(funds.length)}টি ফান্ড →
            </span>
          </div>

          <div
            onClick={() => onNavigate(ModuleId.LOANS)}
            className="px-2 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1 cursor-pointer group"
          >
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-amber-600">
                লোন বাকি (দেনা)
              </p>
              <p className="text-sm sm:text-base font-bold text-amber-700 dark:text-amber-300">
                {formatCurrencyBDT(metrics.totalLoanPayable)}
              </p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline">
              কিস্তি / লোন →
            </span>
          </div>

          <div
            onClick={() => onNavigate(ModuleId.INCOME_EXPENSE)}
            className="pl-2 sm:pl-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1 cursor-pointer group"
          >
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-rose-600">
                মোট ব্যক্তিগত ব্যয়
              </p>
              <p className="text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400">
                {formatCurrencyBDT(metrics.totalPersonalExpenses)}
              </p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline">
              আয় ও ব্যয় →
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Compact Recent Production & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Recent Production List */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                সাম্প্রতিক প্রোডাকশন ও বিল উত্তোলন
              </h2>
              <button
                type="button"
                onClick={() => onNavigate(ModuleId.PRODUCTION)}
                className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                সব দেখুন ({formatNumberBn(recentProduction.length + paymentWithdrawals.length)})
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentCombinedStream.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                কোনো সাম্প্রতিক হিসাব এন্ট্রি নেই।
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentCombinedStream.map((item) => {
                  if (item.kind === 'withdrawal') {
                    const w = item.record;
                    return (
                      <div
                        key={w.id}
                        className="py-2.5 flex items-center justify-between gap-2.5 bg-emerald-50/40 dark:bg-emerald-950/20 px-2 rounded-xl my-1"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <ArrowDownRight className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                                বিল উত্তোলন
                              </span>
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {w.voucherNo ? `ভাউচার: ${w.voucherNo}` : 'কোম্পানি উত্তোলন'}
                              </p>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {w.date} · {w.paymentMethod || 'নগদ'} {w.remarks ? `· ${w.remarks}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400">
                            -{formatCurrencyBDT(w.amount ?? 0)}
                          </p>
                          <StatusBadge label="উত্তোলন সম্পন্ন" variant="success" />
                        </div>
                      </div>
                    );
                  }

                  const entry = item.entry;
                  const thumb = entry.photos?.[0]?.previewUrl;
                  return (
                    <div
                      key={entry.id}
                      className="py-2.5 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={entry.itemName}
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                            <Scissors className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {entry.itemName || entry.garmentType}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {entry.date} · {formatNumberBn(entry.pieces)} পিস (
                            {formatNumberBn(entry.dozens)} ডজন)
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-teal-700 dark:text-teal-300 font-mono">
                          {formatCurrencyBDT(entry.totalWage)}
                        </p>
                        <StatusBadge
                          label={
                            entry.settlementStatus === 'settled'
                              ? 'নিষ্পত্তি হয়েছে'
                              : 'রেট নিষ্পত্তি হয়নি'
                          }
                          variant={
                            entry.settlementStatus === 'settled'
                              ? 'success'
                              : 'warning'
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Weekly / Daily Chart */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              মজুরি চার্ট ({chartMode === 'daily' ? 'চলতি সপ্তাহ' : 'সাপ্তাহিক তুলনা'})
            </h2>
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setChartMode('daily')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer ${
                  chartMode === 'daily'
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                দৈনিক
              </button>
              <button
                type="button"
                onClick={() => setChartMode('weekly')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer ${
                  chartMode === 'weekly'
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                সাপ্তাহিক
              </button>
            </div>
          </div>

          {chartMode === 'daily' ? (
            <div className="space-y-2.5 pt-1">
              {weeklySeries.map((day) => {
                const pct = Math.max(
                  4,
                  Math.round((day.earnedAmount / maxDailyEarned) * 100)
                );
                return (
                  <div key={day.dayLabel} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {day.dayLabel}{' '}
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({day.dateLabel.slice(0, 5)})
                        </span>
                      </span>
                      <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
                        {formatCurrencyBDT(day.earnedAmount)}{' '}
                        <span className="text-[10px] font-normal text-slate-500">
                          ({formatNumberBn(day.pieces)} পিস)
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${
                          day.earnedAmount > 0
                            ? 'bg-teal-600 dark:bg-teal-500'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {recentWeeksChartData.map((wk, idx) => {
                const earnedPct = Math.max(
                  4,
                  Math.round((wk.earnedAmount / maxWeeklyEarned) * 100)
                );
                const recPct = Math.max(
                  4,
                  Math.round((wk.receivedAmount / maxWeeklyEarned) * 100)
                );
                return (
                  <div key={`${wk.label}-${idx}`} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        সপ্তাহ ({wk.label})
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                        কাজ: {formatCurrencyBDT(wk.earnedAmount)} · উত্তোলন:{' '}
                        {formatCurrencyBDT(wk.receivedAmount)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${earnedPct}%` }}
                          className="h-full rounded-full bg-teal-600"
                        />
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${recPct}%` }}
                          className="h-full rounded-full bg-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Multi-Section Entry Modal */}
      <QuickMultiSectionEntryModal
        isOpen={quickModalOpen}
        initialSection={quickModalSection}
        onClose={() => setQuickModalOpen(false)}
        funds={funds}
        loans={loans}
        onSaveProduction={onSaveProduction}
        onSaveWithdrawal={onSaveWithdrawal}
        onSaveFund={onSaveFund}
        onSaveLoan={onSaveLoan}
        onSaveTransaction={onSaveTransaction}
      />
    </div>
  );
};
