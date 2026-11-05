import React, { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  HandCoins,
  Layers,
  PiggyBank,
  Plus,
  Scissors,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  DashboardSummaryMetrics,
  IncomeExpenseRecord,
  ModuleId,
  MonthlyIncomeExpensePoint,
  PaymentWithdrawalRecord,
  ProductionEntry,
  WeeklyEarningsPoint,
} from '../types/models';
import {
  formatDateDDMMYYYY,
  formatDozensBn,
  formatTaka,
  toBengaliDigits,
} from '../utils/formatters';
import {
  computeMultiWeekComparison,
  getWeekEndThursday,
  getWeekStartSaturday,
} from '../utils/weeklyCalendar';
import { EmptyDataState } from '../components/ui/EmptyDataState';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/ui/SummaryCard';

export interface DashboardPageProps {
  metrics: DashboardSummaryMetrics;
  recentProduction: ProductionEntry[];
  paymentWithdrawals: PaymentWithdrawalRecord[];
  recentTransactions: IncomeExpenseRecord[];
  weeklySeries: WeeklyEarningsPoint[];
  monthlySeries: MonthlyIncomeExpensePoint[];
  onNavigate: (module: ModuleId) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  metrics,
  recentProduction,
  paymentWithdrawals,
  recentTransactions,
  weeklySeries,
  monthlySeries,
  onNavigate,
}) => {
  const currentSat = useMemo(() => getWeekStartSaturday(new Date()), []);
  const currentThu = useMemo(() => getWeekEndThursday(currentSat), [currentSat]);

  // 4-week trend for Dashboard Weekly Production Trend
  const fourWeekTrend = useMemo(
    () =>
      computeMultiWeekComparison(
        currentSat,
        4,
        recentProduction,
        paymentWithdrawals
      ),
    [currentSat, recentProduction, paymentWithdrawals]
  );

  // Pending wage entries (where settlementStatus === 'pending' and totalWage > 0)
  const pendingWageEntries = useMemo(
    () =>
      recentProduction.filter(
        (e) => e.settlementStatus === 'pending' && (e.totalWage ?? 0) > 0
      ),
    [recentProduction]
  );

  const maxDailyPieces = useMemo(
    () => Math.max(1, ...weeklySeries.map((d) => d.pieces)),
    [weeklySeries]
  );

  const maxTrendPieces = useMemo(
    () => Math.max(1, ...fourWeekTrend.map((w) => w.totalPieces)),
    [fourWeekTrend]
  );

  return (
    <div className="space-y-7 w-full max-w-full overflow-x-hidden">
      <PageHeader
        moduleIndexBn="০১. প্রধান মডিউল · ড্যাশবোর্ড"
        titleBn="স্মার্ট হিসাব — ড্যাশবোর্ড সারসংক্ষেপ"
        subtitleBn="শনিবার থেকে বৃহস্পতিবার সাপ্তাহিক ক্যালেন্ডার অনুযায়ী প্রোডাকশন, অর্জিত ও প্রাপ্ত মজুরি, বকেয়া পাওনা এবং ব্যক্তিগত অর্থ ব্যবস্থাপনার চিত্র"
        primaryActionLabelBn="নতুন প্রোডাকশন যোগ করুন"
        primaryActionIcon={<Plus className="w-4 h-4" />}
        onPrimaryAction={() => onNavigate(ModuleId.PRODUCTION)}
        secondaryActionLabelBn="Google Sheets / Excel ইমপোর্ট"
        secondaryActionIcon={<FileSpreadsheet className="w-4 h-4" />}
        onSecondaryAction={() => onNavigate(ModuleId.IMPORT_DATA)}
      />

      {/* Section 1: This Week's Highlight Cards (Saturday to Thursday) */}
      <section aria-labelledby="this-week-summary-heading" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h2
            id="this-week-summary-heading"
            className="text-base font-bold text-slate-900 dark:text-slate-100"
          >
            চলতি সপ্তাহের প্রোডাকশন ও মজুরি সারসংক্ষেপ (শনিবার — বৃহস্পতিবার)
          </h2>
          <button
            type="button"
            onClick={() => onNavigate(ModuleId.WEEKLY_REPORT)}
            className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>
              সপ্তাহ: {formatDateDDMMYYYY(currentSat, true)} হতে{' '}
              {formatDateDDMMYYYY(currentThu, true)} · পূর্ণাঙ্গ সাপ্তাহিক রিপোর্ট
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. This Week's Total Production */}
          <SummaryCard
            titleBn="এই সপ্তাহের মোট প্রোডাকশন"
            amount={null}
            customValueBn={`${toBengaliDigits(
              metrics.thisWeekTotalPieces
            )} পিস (${formatDozensBn(metrics.thisWeekTotalDozens)} ডজন)`}
            subtitleBn="শনিবার থেকে বৃহস্পতিবারের মোট সেলাই"
            icon={<Layers className="w-5 h-5" />}
            tone="accent"
          />

          {/* 2. This Week's Earned Wages */}
          <SummaryCard
            titleBn="এই সপ্তাহের অর্জিত মজুরি"
            amount={metrics.weekEarnedWages}
            subtitleBn="চলতি সপ্তাহের প্রোডাকশন হতে অর্জিত"
            icon={<CalendarRange className="w-5 h-5" />}
            tone="positive"
          />

          {/* 3. This Week's Received Wages */}
          <SummaryCard
            titleBn="এই সপ্তাহের প্রাপ্ত মজুরি"
            amount={metrics.thisWeekReceivedWages}
            subtitleBn={
              metrics.thisWeekAdvanceBalance > 0
                ? `অগ্রিম স্থিতি: ${formatTaka(metrics.thisWeekAdvanceBalance, true)}`
                : 'এই সপ্তাহে নগদ/বিকাশে প্রাপ্ত টাকা'
            }
            icon={<Banknote className="w-5 h-5" />}
            tone="accent"
          />

          {/* 4. This Week's Outstanding Wages */}
          <SummaryCard
            titleBn="এই সপ্তাহের বকেয়া মজুরি"
            amount={metrics.thisWeekOutstandingWages}
            subtitleBn="চলতি সপ্তাহের অপরিশোধিত পাওনা"
            icon={<ClipboardCheck className="w-5 h-5" />}
            tone="warning"
          />

          {/* 5. Working Days This Week */}
          <SummaryCard
            titleBn="এই সপ্তাহের কর্মদিবস"
            amount={null}
            customValueBn={`${toBengaliDigits(metrics.thisWeekWorkingDays)} / ৬ দিন`}
            subtitleBn="শুক্রবার ব্যতীত সক্রিয় কাজের দিন"
            icon={<Clock className="w-5 h-5" />}
            tone="default"
          />
        </div>
      </section>

      {/* Section 2: Overall Financial & Ledger Summary Cards */}
      <section aria-labelledby="overall-summary-heading" className="space-y-3">
        <h2
          id="overall-summary-heading"
          className="text-base font-bold text-slate-900 dark:text-slate-100"
        >
          সার্বিক মজুরি, ঋণ, ব্যয় ও ফান্ড সারসংক্ষেপ
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <SummaryCard
            titleBn="আজকের অর্জিত মজুরি"
            amount={metrics.todayEarnedWages}
            subtitleBn="আজকের সেলাইকৃত প্রোডাকশন হতে অর্জিত"
            icon={<CalendarCheck className="w-5 h-5" />}
            tone="accent"
          />

          <SummaryCard
            titleBn="এই মাসের অর্জিত মজুরি"
            amount={metrics.monthEarnedWages}
            subtitleBn="চলতি মাসের মোট অর্জিত মজুরি"
            icon={<CalendarDays className="w-5 h-5" />}
            tone="positive"
          />

          <SummaryCard
            titleBn="গার্মেন্টস থেকে মোট পাওনা মজুরি"
            amount={metrics.totalOutstandingWages}
            subtitleBn="সকল মেয়াদের মোট অপরিশোধিত বকেয়া"
            icon={<ClipboardCheck className="w-5 h-5" />}
            tone="warning"
          />

          <SummaryCard
            titleBn="মোট ব্যক্তিগত ব্যয়"
            amount={metrics.totalPersonalExpenses}
            subtitleBn="দৈনন্দিন ও পারিবারিক মোট খরচ"
            icon={<ArrowUpRight className="w-5 h-5" />}
            tone="danger"
          />

          <SummaryCard
            titleBn="মোট পাওনা ঋণ (Receivable)"
            amount={metrics.totalLoanReceivable}
            subtitleBn="অন্যের কাছে প্রদত্ত ফেরতযোগ্য ঋণ"
            icon={<ArrowDownLeft className="w-5 h-5" />}
            tone="positive"
          />

          <SummaryCard
            titleBn="মোট দেনা ঋণ (Payable)"
            amount={metrics.totalLoanPayable}
            subtitleBn="পরিশোধযোগ্য গৃহীত ঋণের স্থিতি"
            icon={<HandCoins className="w-5 h-5" />}
            tone="warning"
          />

          <SummaryCard
            titleBn="মোট ফান্ড ব্যালেন্স"
            amount={metrics.totalFundBalance}
            subtitleBn="সঞ্চয়, ডিপিএস ও জরুরি তহবিলের স্থিতি"
            icon={<PiggyBank className="w-5 h-5" />}
            tone="accent"
          />

          <SummaryCard
            titleBn="সাপ্তাহিক মোট উত্তোলন"
            amount={metrics.totalWeeklyWithdrawals}
            subtitleBn="চলতি সপ্তাহে উত্তোলিত মজুরি"
            icon={<Wallet className="w-5 h-5" />}
            tone="default"
          />
        </div>
      </section>

      {/* Section 3: Daily Production Chart (Sat-Thu) & Weekly Production Trend */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Production Chart (Saturday to Thursday, 6 Days) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  দৈনিক প্রোডাকশন ও আয়ের চার্ট (শনিবার — বৃহস্পতিবার)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  চলতি সপ্তাহের ৬টি কর্মদিবসের পিস ও অর্জিত মজুরি (শুক্রবার বাদে)
                </p>
              </div>
              <BarChart3 className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
            </div>

            <div className="mt-4 grid grid-cols-6 gap-1.5 sm:gap-2 items-end h-44 pt-4 px-1 border-b border-slate-200 dark:border-slate-800">
              {weeklySeries.map((day) => {
                const barHeightPercent =
                  day.pieces > 0
                    ? Math.min(100, Math.max(16, Math.round((day.pieces / maxDailyPieces) * 100)))
                    : 8;
                return (
                  <div
                    key={day.dayLabel}
                    className="flex flex-col items-center justify-end h-full gap-1.5 min-w-0"
                  >
                    <span className="text-[10px] sm:text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400 truncate max-w-full">
                      ৳{toBengaliDigits(Math.round(day.earnedAmount))}
                    </span>
                    <div className="w-full max-w-[30px] bg-slate-100 dark:bg-slate-800 rounded-t-lg h-28 flex items-end overflow-hidden">
                      <div
                        style={{ height: `${barHeightPercent}%` }}
                        className={`w-full rounded-t-lg transition-all ${
                          day.pieces > 0
                            ? 'bg-teal-600 dark:bg-teal-500'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 grid grid-cols-6 gap-1 text-center">
              {weeklySeries.map((day) => (
                <div key={day.dayLabel} className="min-w-0">
                  <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {day.dayLabel}
                  </span>
                  <span className="block text-[10px] font-mono text-slate-500 truncate">
                    {toBengaliDigits(day.pieces)} পিস
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>ক্যালেন্ডার: শনিবার থেকে বৃহস্পতিবার</span>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.WEEKLY_REPORT)}
              className="text-teal-700 dark:text-teal-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>সাপ্তাহিক রিপোর্ট</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Weekly Production Trend (Last 4 Saturday-to-Thursday Weeks) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col justify-between overflow-hidden">
          <div>
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  সাপ্তাহিক প্রোডাকশন ট্রেন্ড (শেষ ৪ সপ্তাহ)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  শনিবার–বৃহস্পতিবার সপ্তাহভিত্তিক মোট পিস, ডজন ও অর্জিত মজুরির তুলনা
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
            </div>

            <div className="mt-4 space-y-3">
              {fourWeekTrend.map((wk, idx) => {
                const pct = Math.max(
                  6,
                  Math.round((wk.totalPieces / maxTrendPieces) * 100)
                );
                return (
                  <div key={wk.weekKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-mono text-slate-600 dark:text-slate-400 truncate">
                        সপ্তাহ {toBengaliDigits(idx + 1)}: শনি{' '}
                        {toBengaliDigits(wk.saturdayDateDDMMYYYY.slice(0, 5))} — বৃহঃ{' '}
                        {toBengaliDigits(wk.thursdayDateDDMMYYYY.slice(0, 5))}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                        {toBengaliDigits(wk.totalPieces)} পিস ({formatDozensBn(wk.totalDozens)} ডজন) ·{' '}
                        {formatTaka(wk.totalEarnedWages, true)}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all ${
                          wk.totalPieces > 0
                            ? 'bg-teal-600 dark:bg-teal-500'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>৪, ৮, ১২ ও ২৪ সপ্তাহের তুলনা উপলব্ধ</span>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.WEEKLY_REPORT)}
              className="text-teal-700 dark:text-teal-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>বহু-সপ্তাহের তুলনা দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Section 4: Recent Production Entries & Pending Wages */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Production Entries */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                সাম্প্রতিক প্রোডাকশন এন্ট্রি
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                সর্বশেষ সেলাইকৃত পোশাকের তালিকা (DD-MM-YYYY)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.PRODUCTION)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <span>সব দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentProduction.length === 0 ? (
            <EmptyDataState
              titleBn="কোনো সাম্প্রতিক প্রোডাকশন এন্ট্রি নেই"
              descriptionBn="প্রোডাকশন হিসাব পাতায় নতুন এন্ট্রি যুক্ত করলে অথবা Google Sheets / Excel থেকে ডেটা ইমপোর্ট করলে এখানে প্রদর্শিত হবে।"
              tableNameHint="production_entries"
              actionLabelBn="প্রোডাকশন হিসাব পাতায় যান"
              onActionClick={() => onNavigate(ModuleId.PRODUCTION)}
              icon={<Scissors className="w-6 h-6" />}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentProduction.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {entry.itemName || entry.garmentType}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      <span>{formatDateDDMMYYYY(entry.date, true)}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>
                        {entry.workStatus === 'completed'
                          ? 'কাজ সম্পন্ন'
                          : 'কাজ চলছে'}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span
                        className={
                          entry.settlementStatus === 'settled'
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-amber-700 dark:text-amber-400 font-semibold'
                        }
                      >
                        {entry.settlementStatus === 'settled'
                          ? 'নিষ্পত্তি হয়েছে'
                          : 'রেট নিষ্পত্তি হয়নি'}
                      </span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                      {formatTaka(entry.totalWage, true)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {toBengaliDigits(entry.pieces ?? 0)} পিস ·{' '}
                      {formatDozensBn(entry.dozens)} ডজন
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unsettled Rate Entries List (রেট নিষ্পত্তি হয়নি) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                রেট নিষ্পত্তি হয়নি (অপেক্ষমাণ প্রোডাকশন)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                যেসব প্রোডাকশন এন্ট্রির রেট নিষ্পত্তি এখনও সম্পন্ন হয়নি
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.PRODUCTION)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer shrink-0"
            >
              <span>সব দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingWageEntries.length === 0 && recentTransactions.length === 0 ? (
            <EmptyDataState
              titleBn="রেট নিষ্পত্তি বাকি থাকা কোনো এন্ট্রি নেই"
              descriptionBn="যেসব প্রোডাকশন এন্ট্রির রেট এখনও নিষ্পত্তি হয়নি, সেগুলোর তালিকা এখানে অগ্রাধিকার ভিত্তিতে দেখা যাবে।"
              tableNameHint="production_entries (settlement_status = 'pending')"
              actionLabelBn="প্রোডাকশন খতিয়ান দেখুন"
              onActionClick={() => onNavigate(ModuleId.PRODUCTION)}
              icon={<Wallet className="w-6 h-6" />}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingWageEntries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 bg-amber-50/30 dark:bg-amber-950/20"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {entry.itemName || entry.garmentType}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      <span>{formatDateDDMMYYYY(entry.date, true)}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-amber-700 dark:text-amber-400 font-semibold">
                        রেট নিষ্পত্তি হয়নি
                      </span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300 font-mono tabular-nums">
                      {formatTaka(entry.pendingWage ?? entry.totalWage, true)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {toBengaliDigits(entry.pieces ?? 0)} পিস
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
