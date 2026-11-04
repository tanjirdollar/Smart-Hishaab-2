import React from 'react';
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
  HandCoins,
  PiggyBank,
  Plus,
  Scissors,
  Wallet,
} from 'lucide-react';
import {
  DashboardSummaryMetrics,
  IncomeExpenseRecord,
  ModuleId,
  MonthlyIncomeExpensePoint,
  ProductionEntry,
  WeeklyEarningsPoint,
} from '../types/models';
import { formatDateDDMMYYYY, formatTaka, toBengaliDigits } from '../utils/formatters';
import { EmptyDataState } from '../components/ui/EmptyDataState';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/ui/SummaryCard';

export interface DashboardPageProps {
  metrics: DashboardSummaryMetrics;
  recentProduction: ProductionEntry[];
  recentTransactions: IncomeExpenseRecord[];
  weeklySeries: WeeklyEarningsPoint[];
  monthlySeries: MonthlyIncomeExpensePoint[];
  onNavigate: (module: ModuleId) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  metrics,
  recentProduction,
  recentTransactions,
  weeklySeries,
  monthlySeries,
  onNavigate,
}) => {
  return (
    <div className="space-y-8">
      <PageHeader
        moduleIndexBn="০১. প্রধান মডিউল · ড্যাশবোর্ড"
        titleBn="স্মার্ট হিসাব — ড্যাশবোর্ড সারসংক্ষেপ"
        subtitleBn="গার্মেন্টস সুইং মেশিন অপারেটরের দৈনিক প্রোডাকশন মজুরি, পাওনা, ঋণ এবং ব্যক্তিগত তহবিলের সমন্বিত চিত্র"
        primaryActionLabelBn="নতুন প্রোডাকশন যোগ করুন"
        primaryActionIcon={<Plus className="w-4 h-4" />}
        onPrimaryAction={() => onNavigate(ModuleId.PRODUCTION)}
        secondaryActionLabelBn="আয়-ব্যয় এন্ট্রি"
        secondaryActionIcon={<Wallet className="w-4 h-4" />}
        onSecondaryAction={() => onNavigate(ModuleId.INCOME_EXPENSE)}
      />

      {/* 9 Summary Cards Grid */}
      <section aria-labelledby="dashboard-summary-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="dashboard-summary-heading"
            className="text-base font-bold text-slate-900 dark:text-slate-100"
          >
            প্রোডাকশন ও আর্থিক সারসংক্ষেপ কার্ডসমূহ
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            মুদ্রা: বাংলাদেশী টাকা (৳) · সুপাবেস ডাটাবেস রেডি
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Today's earned wages */}
          <SummaryCard
            titleBn="আজকের অর্জিত মজুরি"
            amount={metrics.todayEarnedWages}
            subtitleBn="আজকের সেলাইকৃত প্রোডাকশন হতে অর্জিত"
            dbColumnHint="production_entries"
            icon={<CalendarCheck className="w-5 h-5" />}
            tone="accent"
          />

          {/* 2. This week's earned wages */}
          <SummaryCard
            titleBn="এই সপ্তাহের অর্জিত মজুরি"
            amount={metrics.weekEarnedWages}
            subtitleBn="চলতি সপ্তাহের মোট প্রোডাকশন মজুরি"
            dbColumnHint="weekly_sum"
            icon={<CalendarRange className="w-5 h-5" />}
            tone="positive"
          />

          {/* 3. This month's earned wages */}
          <SummaryCard
            titleBn="এই মাসের অর্জিত মজুরি"
            amount={metrics.monthEarnedWages}
            subtitleBn="চলতি মাসের মোট অর্জিত মজুরি"
            dbColumnHint="monthly_sum"
            icon={<CalendarDays className="w-5 h-5" />}
            tone="positive"
          />

          {/* 4. Total outstanding wages from the garment company */}
          <SummaryCard
            titleBn="গার্মেন্টস থেকে মোট পাওনা মজুরি"
            amount={metrics.totalOutstandingWages}
            subtitleBn="কোম্পানির নিকট বকেয়া অপরিশোধিত মজুরি"
            dbColumnHint="wage_periods"
            icon={<ClipboardCheck className="w-5 h-5" />}
            tone="warning"
          />

          {/* 5. Total weekly withdrawals */}
          <SummaryCard
            titleBn="সাপ্তাহিক মোট উত্তোলন"
            amount={metrics.totalWeeklyWithdrawals}
            subtitleBn="গার্মেন্টস থেকে উত্তোলিত মজুরি"
            dbColumnHint="payment_withdrawals"
            icon={<Banknote className="w-5 h-5" />}
            tone="default"
          />

          {/* 6. Total personal expenses */}
          <SummaryCard
            titleBn="মোট ব্যক্তিগত ব্যয়"
            amount={metrics.totalPersonalExpenses}
            subtitleBn="দৈনন্দিন ও পারিবারিক মোট খরচ"
            dbColumnHint="income_expense"
            icon={<ArrowUpRight className="w-5 h-5" />}
            tone="danger"
          />

          {/* 7. Total loan receivable */}
          <SummaryCard
            titleBn="মোট পাওনা ঋণ"
            amount={metrics.totalLoanReceivable}
            subtitleBn="অন্যের কাছে প্রদত্ত ফেরতযোগ্য ঋণ"
            dbColumnHint="loan_receivable"
            icon={<ArrowDownLeft className="w-5 h-5" />}
            tone="positive"
          />

          {/* 8. Total loan payable */}
          <SummaryCard
            titleBn="মোট দেনা ঋণ"
            amount={metrics.totalLoanPayable}
            subtitleBn="পরিশোধযোগ্য গৃহীত ঋণের স্থিতি"
            dbColumnHint="loan_payable"
            icon={<HandCoins className="w-5 h-5" />}
            tone="warning"
          />

          {/* 9. Total fund balance */}
          <SummaryCard
            titleBn="মোট ফান্ড ব্যালেন্স"
            amount={metrics.totalFundBalance}
            subtitleBn="সঞ্চয়, ডিপিএস ও জরুরি তহবিলের স্থিতি"
            dbColumnHint="fund_accounts"
            icon={<PiggyBank className="w-5 h-5" />}
            tone="accent"
          />
        </div>
      </section>

      {/* Charts Section: Weekly Earnings Chart & Monthly Income/Expense Chart */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Earnings Chart Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  সাপ্তাহিক আয়ের চার্ট
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  শনিবার থেকে শুক্রবার পর্যন্ত দৈনিক প্রোডাকশন মজুরির তুলনামূলক চিত্র
                </p>
              </div>
              <BarChart3 className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
            </div>

            {/* Structured Chart Canvas Ready for Real Database Series */}
            <div className="mt-5 grid grid-cols-7 gap-2 items-end h-44 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
              {weeklySeries.map((day) => {
                const barHeightPercent =
                  day.earnedAmount && day.earnedAmount > 0
                    ? Math.min(100, Math.max(15, Math.round(day.earnedAmount / 20)))
                    : 10;
                return (
                  <div
                    key={day.dayLabel}
                    className="flex flex-col items-center justify-end h-full gap-2"
                  >
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {day.earnedAmount !== null
                        ? `৳${toBengaliDigits(day.earnedAmount)}`
                        : '৳০'}
                    </span>
                    <div className="w-full max-w-[32px] bg-slate-100 dark:bg-slate-800 rounded-t-lg h-28 flex items-end overflow-hidden">
                      <div
                        style={{ height: `${barHeightPercent}%` }}
                        className={`w-full rounded-t-lg transition-all ${
                          day.earnedAmount !== null && day.earnedAmount > 0
                            ? 'bg-teal-600 dark:bg-teal-500'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2 text-center">
              {weeklySeries.map((day) => (
                <span
                  key={day.dayLabel}
                  className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate"
                >
                  {day.dayLabel}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>উৎস: সুপাবেস `production_entries` টেবিল</span>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.REPORTS)}
              className="text-teal-700 dark:text-teal-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>বিস্তারিত রিপোর্ট</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Monthly Income & Expense Chart Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  মাসিক আয় ও ব্যয়ের চার্ট
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  মাসভিত্তিক মোট মজুরি আয় বনাম ব্যক্তিগত খরচের তুলনা
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-teal-600 inline-block" />
                  আয়
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
                  ব্যয়
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-6 gap-3 items-end h-44 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
              {monthlySeries.map((item) => {
                const incHeight =
                  item.incomeAmount && item.incomeAmount > 0 ? 65 : 10;
                const expHeight =
                  item.expenseAmount && item.expenseAmount > 0 ? 45 : 10;
                return (
                  <div
                    key={item.monthLabel}
                    className="flex flex-col items-center justify-end h-full gap-2"
                  >
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      ৳০
                    </span>
                    <div className="w-full flex items-end justify-center gap-1.5 h-28">
                      <div className="w-3.5 bg-slate-100 dark:bg-slate-800 rounded-t-md h-full flex items-end">
                        <div
                          style={{ height: `${incHeight}%` }}
                          className="w-full rounded-t-md bg-slate-300 dark:bg-slate-700"
                        />
                      </div>
                      <div className="w-3.5 bg-slate-100 dark:bg-slate-800 rounded-t-md h-full flex items-end">
                        <div
                          style={{ height: `${expHeight}%` }}
                          className="w-full rounded-t-md bg-slate-300 dark:bg-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 grid grid-cols-6 gap-2 text-center">
              {monthlySeries.map((item) => (
                <span
                  key={item.monthLabel}
                  className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate"
                >
                  {item.monthLabel}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>উৎস: সুপাবেস `income_expense_transactions` টেবিল</span>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.INCOME_EXPENSE)}
              className="text-teal-700 dark:text-teal-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>আয়-ব্যয় খতিয়ান</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Recent Production Entries & Recent Financial Transactions */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Production Entries */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
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
              className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>সব দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentProduction.length === 0 ? (
            <EmptyDataState
              titleBn="কোনো সাম্প্রতিক প্রোডাকশন এন্ট্রি নেই"
              descriptionBn="সুপাবেস ডাটাবেস সংযুক্ত হলে বা প্রোডাকশন হিসাব পাতায় নতুন এন্ট্রি যুক্ত করলে এখানে সাম্প্রতিক সেলাইয়ের তালিকা প্রদর্শিত হবে।"
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
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {entry.garmentType}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>তারিখ: {formatDateDDMMYYYY(entry.date, true)}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>সাইজ: {entry.size}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>রঙ: {entry.color}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                      {formatTaka(entry.totalWage, true)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {toBengaliDigits(entry.dozens ?? 0)} ডজন ·{' '}
                      {toBengaliDigits(entry.pieces ?? 0)} পিস
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Financial Transactions */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                সাম্প্রতিক আর্থিক লেনদেন
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                সর্বশেষ মজুরি উত্তোলন এবং ব্যক্তিগত আয়-ব্যয় (DD-MM-YYYY)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.INCOME_EXPENSE)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>সব দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <EmptyDataState
              titleBn="কোনো সাম্প্রতিক আর্থিক লেনদেন নেই"
              descriptionBn="সুপাবেস ডাটাবেসের সাথে সংযুক্ত হওয়ার পর আপনার সর্বশেষ টাকা উত্তোলন, আয় ও ব্যক্তিগত খরচের তালিকা এখানে প্রদর্শিত হবে।"
              tableNameHint="income_expense_transactions"
              actionLabelBn="আয়-ব্যয় পাতায় যান"
              onActionClick={() => onNavigate(ModuleId.INCOME_EXPENSE)}
              icon={<Wallet className="w-6 h-6" />}
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {tx.category}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{formatDateDDMMYYYY(tx.date, true)}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>{tx.transactionType === 'income' ? 'আয়' : 'ব্যয়'}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>{tx.paymentMethod}</span>
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums shrink-0">
                    {formatTaka(tx.amount, true)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
