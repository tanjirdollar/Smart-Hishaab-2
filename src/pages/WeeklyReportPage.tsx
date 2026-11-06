import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CalendarCheck,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Scissors,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  PaymentWithdrawalRecord,
  ProductionEntry,
} from '../types/models';
import {
  formatDozensBn,
  formatTaka,
  parseAnyDateToDateObj,
  toBengaliDigits,
} from '../utils/formatters';
import {
  BENGALI_MONTH_NAMES,
  computeMultiWeekComparison,
  computeSaturdayToThursdayWeekSummary,
  getSaturdayWeeksForMonth,
  getWeekStartSaturday,
  shiftSaturdayWeek,
} from '../utils/weeklyCalendar';
import { EmptyDataState } from '../components/ui/EmptyDataState';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/ui/SummaryCard';

export interface WeeklyReportPageProps {
  productionEntries: ProductionEntry[];
  paymentWithdrawals: PaymentWithdrawalRecord[];
}

export const WeeklyReportPage: React.FC<WeeklyReportPageProps> = ({
  productionEntries,
  paymentWithdrawals,
}) => {
  const today = useMemo(() => new Date(), []);
  const [selectedSaturday, setSelectedSaturday] = useState<Date>(() =>
    getWeekStartSaturday(today)
  );
  const [selectedYear, setSelectedYear] = useState<number>(() => today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => today.getMonth());
  const [comparisonWeeksCount, setComparisonWeeksCount] = useState<4 | 8 | 12 | 24>(4);

  // Selected week summary (Saturday to Thursday, Friday excluded)
  const currentWeekSummary = useMemo(
    () =>
      computeSaturdayToThursdayWeekSummary(
        selectedSaturday,
        productionEntries,
        paymentWithdrawals
      ),
    [selectedSaturday, productionEntries, paymentWithdrawals]
  );

  // Weeks in selected month for the "Select Week / Select Month" dropdowns
  const weeksInSelectedMonth = useMemo(
    () => getSaturdayWeeksForMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  // Multi-week comparison series (4, 8, 12, or 24 weeks)
  const comparisonSeries = useMemo(
    () =>
      computeMultiWeekComparison(
        selectedSaturday,
        comparisonWeeksCount,
        productionEntries,
        paymentWithdrawals
      ),
    [selectedSaturday, comparisonWeeksCount, productionEntries, paymentWithdrawals]
  );

  const handlePreviousWeek = () => {
    const prev = shiftSaturdayWeek(selectedSaturday, -1);
    setSelectedSaturday(prev);
    setSelectedYear(prev.getFullYear());
    setSelectedMonth(prev.getMonth());
  };

  const handleNextWeek = () => {
    const next = shiftSaturdayWeek(selectedSaturday, 1);
    setSelectedSaturday(next);
    setSelectedYear(next.getFullYear());
    setSelectedMonth(next.getMonth());
  };

  const handleCurrentWeek = () => {
    const curr = getWeekStartSaturday(new Date());
    setSelectedSaturday(curr);
    setSelectedYear(curr.getFullYear());
    setSelectedMonth(curr.getMonth());
  };

  const handleMonthChange = (newMonthIndex: number) => {
    setSelectedMonth(newMonthIndex);
    const weeks = getSaturdayWeeksForMonth(selectedYear, newMonthIndex);
    if (weeks.length > 0) {
      setSelectedSaturday(weeks[0].saturdayDate);
    }
  };

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
    const weeks = getSaturdayWeeksForMonth(newYear, selectedMonth);
    if (weeks.length > 0) {
      setSelectedSaturday(weeks[0].saturdayDate);
    }
  };

  const handleJumpToAnyDateWeek = (isoDate: string) => {
    const dt = parseAnyDateToDateObj(isoDate);
    if (!dt) return;
    const sat = getWeekStartSaturday(dt);
    setSelectedSaturday(sat);
    setSelectedYear(sat.getFullYear());
    setSelectedMonth(sat.getMonth());
  };

  const maxComparisonPieces = useMemo(
    () => Math.max(1, ...comparisonSeries.map((w) => w.totalPieces)),
    [comparisonSeries]
  );

  const maxComparisonWage = useMemo(
    () =>
      Math.max(
        1,
        ...comparisonSeries.map((w) =>
          Math.max(w.totalEarnedWages, w.totalReceivedWages)
        )
      ),
    [comparisonSeries]
  );

  // SVG Trend polyline coordinates for Weekly Production Trend Chart
  const trendSvgPoints = useMemo(() => {
    if (comparisonSeries.length === 0) return '';
    const width = 600;
    const height = 140;
    const padX = 24;
    const padY = 18;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    return comparisonSeries
      .map((w, idx) => {
        const x =
          comparisonSeries.length === 1
            ? width / 2
            : padX + (idx / (comparisonSeries.length - 1)) * usableW;
        const ratio = w.totalPieces / maxComparisonPieces;
        const y = padY + usableH - ratio * usableH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [comparisonSeries, maxComparisonPieces]);

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <PageHeader
        titleBn="সাপ্তাহিক প্রোডাকশন রিপোর্ট"
        actions={
          <button
            type="button"
            onClick={handleCurrentWeek}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4" />
            চলতি সপ্তাহে ফিরুন
          </button>
        }
      />

      {/* Weekly Report Navigation & Unified Summary Card */}
      <section
        aria-label="সাপ্তাহিক রিপোর্ট নেভিগেশন ও সারসংক্ষেপ"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4 shadow-2xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
              নির্বাচিত সপ্তাহ (শনিবার — বৃহস্পতিবার)
            </p>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              শনিবার ({toBengaliDigits(currentWeekSummary.saturdayDateDDMMYYYY)}) — বৃহস্পতিবার (
              {toBengaliDigits(currentWeekSummary.thursdayDateDDMMYYYY)})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handlePreviousWeek}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              পূর্ববর্তী
            </button>
            <button
              type="button"
              onClick={handleCurrentWeek}
              className="px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer"
            >
              চলতি সপ্তাহ
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              পরবর্তী
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Compact Week Filter Controls */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              বছর
            </label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100"
            >
              {[2023, 2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>
                  {toBengaliDigits(yr)} সাল
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              মাস
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100"
            >
              {BENGALI_MONTH_NAMES.map((mName, idx) => (
                <option key={mName} value={idx}>
                  {mName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              সপ্তাহ (শনি-বৃহঃ)
            </label>
            <select
              value={currentWeekSummary.saturdayIso}
              onChange={(e) => {
                const found = weeksInSelectedMonth.find(
                  (w) => w.saturdayIso === e.target.value
                );
                if (found) setSelectedSaturday(found.saturdayDate);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100"
            >
              {weeksInSelectedMonth.map((wk) => (
                <option key={wk.saturdayIso} value={wk.saturdayIso}>
                  {wk.labelBn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              যেকোনো তারিখে যান
            </label>
            <input
              type="date"
              value={currentWeekSummary.saturdayIso}
              onChange={(e) => handleJumpToAnyDateWeek(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Single Unified Weekly Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500">
              মোট প্রোডাকশন
            </p>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {toBengaliDigits(currentWeekSummary.totalPieces)} পিস
            </p>
            <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
              {formatDozensBn(currentWeekSummary.totalDozens)} ডজন
            </p>
          </div>

          <div className="p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/50">
            <p className="text-[11px] font-medium text-slate-500">
              অর্জিত মজুরি
            </p>
            <p className="text-base font-bold text-teal-700 dark:text-teal-300 mt-0.5">
              {formatTaka(currentWeekSummary.totalEarnedWages, true)}
            </p>
            <p className="text-[11px] text-slate-500">
              মোট {toBengaliDigits(currentWeekSummary.entriesCount)}টি এন্ট্রি
            </p>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50">
            <p className="text-[11px] font-medium text-slate-500">
              প্রাপ্ত মজুরি (উত্তোলন)
            </p>
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {formatTaka(currentWeekSummary.totalReceivedWages, true)}
            </p>
            <p className="text-[11px] text-slate-500">এই সপ্তাহে গৃহীত</p>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50">
            <p className="text-[11px] font-medium text-slate-500">
              সাপ্তাহিক বকেয়া
            </p>
            <p className="text-base font-bold text-amber-700 dark:text-amber-300 mt-0.5">
              {formatTaka(currentWeekSummary.totalOutstandingWages, true)}
            </p>
            <p className="text-[11px] text-slate-500">
              গড়/দিন: {formatTaka(currentWeekSummary.averageDailyEarnedWages, true)}
            </p>
          </div>
        </div>
      </section>

      {/* Daily Breakdown for Selected Saturday-to-Thursday Week */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              নির্বাচিত সপ্তাহের দিনভিত্তিক হিসাব (শনিবার থেকে বৃহস্পতিবার)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              শুক্রবার সাধারণ সাপ্তাহিক উৎপাদন চক্রের বাইরে রাখা হয়েছে
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {currentWeekSummary.dailyBreakdown.map((day) => (
            <div
              key={day.dayLabel}
              className={`rounded-xl border p-3.5 space-y-1.5 ${
                day.pieces > 0
                  ? 'border-teal-200 dark:border-teal-800/80 bg-teal-50/40 dark:bg-teal-950/25'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {day.dayLabel}
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {toBengaliDigits(day.dateLabel)}
                </span>
              </div>
              <p className="text-base font-bold font-mono tabular-nums text-teal-800 dark:text-teal-300">
                {formatTaka(day.earnedAmount, true)}
              </p>
              <p className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                {toBengaliDigits(day.pieces)} পিস · {formatDozensBn(day.dozens)} ডজন
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly Comparison Section (Last 4, 8, 12, and 24 Weeks) */}
      <section
        aria-labelledby="weekly-comparison-heading"
        className="space-y-6 pt-2"
      >
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2
              id="weekly-comparison-heading"
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              সাপ্তাহিক তুলনা (Weekly Comparison — ৪, ৮, ১২ ও ২৪ সপ্তাহ)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ডাটাবেসে সংরক্ষিত প্রকৃত প্রোডাকশন তথ্যের ভিত্তিতে বহু-সপ্তাহের তুলনামূলক চার্ট ও খতিয়ান
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
            {([4, 8, 12, 24] as const).map((cnt) => (
              <button
                key={cnt}
                type="button"
                onClick={() => setComparisonWeeksCount(cnt)}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  comparisonWeeksCount === cnt
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                শেষ {toBengaliDigits(cnt)} সপ্তাহ
              </button>
            ))}
          </div>
        </div>

        {/* 3 Visual Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Weekly Production Comparison Chart (Pieces & Dozens) */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4 overflow-hidden">
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                ১. সাপ্তাহিক প্রোডাকশন তুলনা চার্ট (পিস ও ডজন)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                শেষ {toBengaliDigits(comparisonWeeksCount)} সপ্তাহের সেলাইকৃত পিস ও ডজনের তুলনা
              </p>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {comparisonSeries.map((wk, idx) => {
                const widthPct = Math.max(
                  4,
                  Math.round((wk.totalPieces / maxComparisonPieces) * 100)
                );
                return (
                  <div key={wk.weekKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-mono text-slate-600 dark:text-slate-400 truncate">
                        সপ্তাহ {toBengaliDigits(idx + 1)} ({toBengaliDigits(wk.saturdayDateDDMMYYYY.slice(0, 5))}–
                        {toBengaliDigits(wk.thursdayDateDDMMYYYY.slice(0, 5))})
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                        {toBengaliDigits(wk.totalPieces)} পিস ({formatDozensBn(wk.totalDozens)} ডজন)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${widthPct}%` }}
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

          {/* Chart 2: Weekly Earned Wage Comparison Chart */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4 overflow-hidden">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  ২. সাপ্তাহিক অর্জিত মজুরি তুলনা চার্ট
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  অর্জিত মজুরি বনাম প্রাপ্ত মজুরি (৳)
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                  অর্জিত
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" />
                  প্রাপ্ত
                </span>
              </div>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {comparisonSeries.map((wk, idx) => {
                const earnedPct = Math.max(
                  4,
                  Math.round((wk.totalEarnedWages / maxComparisonWage) * 100)
                );
                const recPct = Math.max(
                  4,
                  Math.round((wk.totalReceivedWages / maxComparisonWage) * 100)
                );
                return (
                  <div key={wk.weekKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-mono text-slate-600 dark:text-slate-400 truncate">
                        সপ্তাহ {toBengaliDigits(idx + 1)} ({toBengaliDigits(wk.saturdayDateDDMMYYYY.slice(0, 5))})
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                        অর্জিত: {formatTaka(wk.totalEarnedWages, true)} · প্রাপ্ত:{' '}
                        {formatTaka(wk.totalReceivedWages, true)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${earnedPct}%` }}
                          className={`h-full rounded-full ${
                            wk.totalEarnedWages > 0
                              ? 'bg-emerald-600 dark:bg-emerald-500'
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        />
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${recPct}%` }}
                          className={`h-full rounded-full ${
                            wk.totalReceivedWages > 0
                              ? 'bg-sky-500 dark:bg-sky-400'
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Chart 3: Weekly Production Trend Chart (Responsive SVG Line Chart) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4 overflow-hidden">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                ৩. সাপ্তাহিক প্রোডাকশন ট্রেন্ড চার্ট (Weekly Production Trend)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                সময়ের সাথে সাপ্তাহিক উৎপাদনের ধারাবাহিক প্রবণতা (শনিবার–বৃহস্পতিবার)
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
          </div>

          <div className="w-full overflow-hidden">
            <svg
              viewBox="0 0 600 140"
              className="w-full h-36 sm:h-44 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800"
              preserveAspectRatio="none"
            >
              <line
                x1="24"
                y1="122"
                x2="576"
                y2="122"
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="1"
              />
              <line
                x1="24"
                y1="70"
                x2="576"
                y2="70"
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              {trendSvgPoints && (
                <polyline
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={trendSvgPoints}
                />
              )}
            </svg>
          </div>
        </div>

        {/* Multi-Week Comparison Table (Responsive Cards on Mobile + Table on Desktop) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              বহু-সপ্তাহের বিস্তারিত তুলনা সারণি (শনিবার থেকে বৃহস্পতিবার)
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              শেষ {toBengaliDigits(comparisonWeeksCount)} সপ্তাহ
            </span>
          </div>

          {productionEntries.length === 0 ? (
            <EmptyDataState
              titleBn="এখনও কোনো প্রোডাকশন এন্ট্রি সংরক্ষিত নেই"
              descriptionBn="প্রোডাকশন হিসাব পাতায় অথবা ডেটা ইমপোর্ট পাতায় এন্ট্রি যুক্ত করলে স্বয়ংক্রিয়ভাবে শনিবার-বৃহস্পতিবার ক্যালেন্ডার অনুযায়ী সাপ্তাহিক তুলনা তৈরি হবে।"
              tableNameHint="production_entries"
            />
          ) : (
            <>
              {/* Mobile Cards (< md) */}
              <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800 p-3 space-y-2.5">
                {comparisonSeries
                  .slice()
                  .reverse()
                  .map((wk, idx) => (
                    <div
                      key={wk.weekKey}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2 bg-slate-50/40 dark:bg-slate-950/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                          সপ্তাহ #{toBengaliDigits(comparisonSeries.length - idx)}
                        </span>
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          শনি {toBengaliDigits(wk.saturdayDateDDMMYYYY)} — বৃহঃ{' '}
                          {toBengaliDigits(wk.thursdayDateDDMMYYYY)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800">
                        <div>
                          <span className="text-slate-500 block">মোট প্রোডাকশন:</span>
                          <span className="font-mono font-bold">
                            {toBengaliDigits(wk.totalPieces)} পিস ({formatDozensBn(wk.totalDozens)}{' '}
                            ডজন)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 block">অর্জিত মজুরি:</span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {formatTaka(wk.totalEarnedWages, true)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">প্রাপ্ত মজুরি:</span>
                          <span className="font-mono font-semibold">
                            {formatTaka(wk.totalReceivedWages, true)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 block">বকেয়া মজুরি:</span>
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                            {formatTaka(wk.totalOutstandingWages, true)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <th className="py-3.5 px-4 whitespace-nowrap">সপ্তাহ নং</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">
                        সপ্তাহের তারিখ (শনিবার — বৃহস্পতিবার)
                      </th>
                      <th className="py-3.5 px-4 text-right whitespace-nowrap">মোট পিস</th>
                      <th className="py-3.5 px-4 text-right whitespace-nowrap">মোট ডজন</th>
                      <th className="py-3.5 px-4 text-right whitespace-nowrap">
                        মোট অর্জিত মজুরি (৳)
                      </th>
                      <th className="py-3.5 px-4 text-right whitespace-nowrap">
                        মোট প্রাপ্ত মজুরি (৳)
                      </th>
                      <th className="py-3.5 px-4 text-right whitespace-nowrap">
                        বকেয়া মজুরি (৳)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {comparisonSeries
                      .slice()
                      .reverse()
                      .map((wk, idx) => (
                        <tr
                          key={wk.weekKey}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            সপ্তাহ #{toBengaliDigits(comparisonSeries.length - idx)}
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            শনি {toBengaliDigits(wk.saturdayDateDDMMYYYY)} হতে বৃহঃ{' '}
                            {toBengaliDigits(wk.thursdayDateDDMMYYYY)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold">
                            {toBengaliDigits(wk.totalPieces)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {formatDozensBn(wk.totalDozens)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                            {formatTaka(wk.totalEarnedWages, true)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-sky-700 dark:text-sky-400">
                            {formatTaka(wk.totalReceivedWages, true)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-amber-700 dark:text-amber-400">
                            {formatTaka(wk.totalOutstandingWages, true)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
