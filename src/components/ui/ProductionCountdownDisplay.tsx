import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Timer,
} from 'lucide-react';
import { ProductionEntry } from '../../types/models';
import {
  calculateDurationMinutes,
  formatDozensBn,
  formatDurationBn,
  formatTaka,
  getNowLocalDateTimeInput,
  toBengaliDigits,
} from '../../utils/formatters';

export const COUNTDOWN_PRESET_HOURS: { hours: number; labelBn: string }[] = [
  { hours: 2, labelBn: '২ ঘণ্টা' },
  { hours: 4, labelBn: '৪ ঘণ্টা' },
  { hours: 5, labelBn: '৫ ঘণ্টা' },
  { hours: 8, labelBn: '৮ ঘণ্টা' },
  { hours: 10, labelBn: '১০ ঘণ্টা' },
  { hours: 12, labelBn: '১২ ঘণ্টা' },
  { hours: 24, labelBn: '২৪ ঘণ্টা' },
];

export interface CountdownSnapshot {
  isActive: boolean;
  isOverdue: boolean;
  isNearDeadline: boolean;
  remainingMs: number;
  overdueMs: number;
  totalElapsedMs: number;
  targetDurationMs: number;
  targetDurationMinutes: number;
  progressPercent: number;
  deadlineAtIso: string;
  startedAtIso: string;
}

export function hasActiveCountdown(entry: ProductionEntry): boolean {
  if (!entry || entry.workStatus !== 'in_progress') return false;
  const mins = Number(entry.countdownDurationMinutes ?? 0);
  if (!mins || mins <= 0 || !entry.deadlineAt) return false;
  const deadlineTime = new Date(entry.deadlineAt).getTime();
  return Number.isFinite(deadlineTime) && deadlineTime > 0;
}

export function computeCountdownSnapshot(
  entry: ProductionEntry,
  nowMs: number = Date.now()
): CountdownSnapshot | null {
  if (!hasActiveCountdown(entry)) return null;

  const targetDurationMinutes = Math.round(
    Number(entry.countdownDurationMinutes ?? 0)
  );
  const targetDurationMs = targetDurationMinutes * 60 * 1000;
  const deadlineMs = new Date(entry.deadlineAt!).getTime();

  let startMs = deadlineMs - targetDurationMs;
  if (entry.countdownStartedAt) {
    const parsedStart = new Date(entry.countdownStartedAt).getTime();
    if (Number.isFinite(parsedStart) && parsedStart > 0) {
      startMs = parsedStart;
    }
  }

  const remainingMs = deadlineMs - nowMs;
  const isOverdue = remainingMs <= 0;
  const overdueMs = isOverdue ? Math.abs(remainingMs) : 0;
  const totalElapsedMs = Math.max(0, nowMs - startMs);
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((totalElapsedMs / Math.max(1, targetDurationMs)) * 100))
  );
  const isNearDeadline = !isOverdue && progressPercent >= 75;

  return {
    isActive: true,
    isOverdue,
    isNearDeadline,
    remainingMs: Math.max(0, remainingMs),
    overdueMs,
    totalElapsedMs,
    targetDurationMs,
    targetDurationMinutes,
    progressPercent,
    deadlineAtIso: new Date(deadlineMs).toISOString(),
    startedAtIso: new Date(startMs).toISOString(),
  };
}

/**
 * Formats a millisecond duration into Bengali hours, minutes, and optional seconds
 * e.g., "০৯ ঘণ্টা ৪৫ মিনিট ৩০ সেকেন্ড" or "১ দিন ০২ ঘণ্টা ১৫ মিনিট"
 */
export function formatCountdownClockBn(
  ms: number,
  includeSeconds = true
): string {
  const safeSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad2 = (n: number) => toBengaliDigits(String(n).padStart(2, '0'));

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${toBengaliDigits(days)} দিন`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${pad2(hours)} ঘণ্টা`);
  }
  parts.push(`${pad2(minutes)} মিনিট`);
  if (includeSeconds) {
    parts.push(`${pad2(seconds)} সেকেন্ড`);
  }

  return parts.join(' ');
}

export interface ProductionCountdownBadgeProps {
  entry: ProductionEntry;
  compact?: boolean;
  onQuickCompleteWork?: (entry: ProductionEntry) => void;
}

/**
 * Self-contained live ticking countdown & overdue tracker badge for Production Entry Cards and Table Rows.
 * Only renders when `entry.workStatus === 'in_progress'` and a countdown timer is set.
 */
export const ProductionCountdownBadge: React.FC<
  ProductionCountdownBadgeProps
> = ({ entry, compact = false, onQuickCompleteWork }) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const active = hasActiveCountdown(entry);

  useEffect(() => {
    if (!active) return;
    setNowMs(Date.now());
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timerId);
    };
  }, [active, entry.deadlineAt, entry.countdownDurationMinutes, entry.workStatus]);

  if (!active) return null;

  const snap = computeCountdownSnapshot(entry, nowMs);
  if (!snap) return null;

  const targetBn = formatDurationBn(snap.targetDurationMinutes);
  const totalRunningBn = formatCountdownClockBn(snap.totalElapsedMs, false);

  if (snap.isOverdue) {
    const overdueDetailedBn = formatCountdownClockBn(snap.overdueMs, true);
    return (
      <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/60 p-2.5 space-y-1.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
            <span>নির্ধারিত সময় অতিক্রান্ত! (লক্ষ্য: {targetBn})</span>
          </div>
          {onQuickCompleteWork && (
            <button
              type="button"
              onClick={() => onQuickCompleteWork(entry)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>কাজ সম্পন্ন করুন</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-mono text-rose-900 dark:text-rose-100">
          <span>
            মোট চলমান সময়:{' '}
            <strong className="font-bold">{totalRunningBn}</strong>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold">
            +{overdueDetailedBn} অতিরিক্ত
          </span>
        </div>

        {!compact && (
          <div className="w-full h-1.5 rounded-full bg-rose-200 dark:bg-rose-900 overflow-hidden">
            <div className="h-full w-full bg-rose-600 dark:bg-rose-500" />
          </div>
        )}
      </div>
    );
  }

  const remainingDetailedBn = formatCountdownClockBn(snap.remainingMs, true);
  const borderBgClass = snap.isNearDeadline
    ? 'border-amber-300 dark:border-amber-800 bg-amber-50/85 dark:bg-amber-950/45 text-amber-950 dark:text-amber-100'
    : 'border-teal-300 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-950/45 text-teal-950 dark:text-teal-100';

  const progressFillClass = snap.isNearDeadline
    ? 'bg-amber-500 dark:bg-amber-400'
    : 'bg-teal-600 dark:bg-teal-400';

  return (
    <div className={`rounded-xl border p-2.5 space-y-1.5 text-xs ${borderBgClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-bold">
          <Timer
            className={`w-4 h-4 shrink-0 ${
              snap.isNearDeadline
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-teal-700 dark:text-teal-300'
            }`}
          />
          <span>বাকি সময়: {remainingDetailedBn}</span>
        </div>

        {onQuickCompleteWork && (
          <button
            type="button"
            onClick={() => onQuickCompleteWork(entry)}
            className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>সম্পন্ন</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] opacity-90">
        <span>
          লক্ষ্যমাত্রা: <strong>{targetBn}</strong> · মোট চলমান:{' '}
          <strong>{totalRunningBn}</strong>
        </span>
        <span className="font-mono font-bold">
          {toBengaliDigits(snap.progressPercent)}% সম্পন্ন
        </span>
      </div>

      {!compact && (
        <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${progressFillClass}`}
            style={{ width: `${snap.progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};

export interface DashboardActiveCountdownBannerProps {
  productionEntries: ProductionEntry[];
  onNavigateToProduction: () => void;
  onSaveProduction: (
    entry: ProductionEntry
  ) => Promise<{ persistedToCloud: boolean; errorBn: string | null }>;
}

/**
 * Prominent live countdown & overdue work banner displayed on the Dashboard
 * whenever one or more ongoing production tasks have an active countdown timer.
 */
export const DashboardActiveCountdownBanner: React.FC<
  DashboardActiveCountdownBannerProps
> = ({ productionEntries, onNavigateToProduction, onSaveProduction }) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Filter and sort active countdown tasks: overdue tasks first, then nearest deadline first
  const activeTimerEntries = useMemo(() => {
    return (productionEntries || [])
      .filter(hasActiveCountdown)
      .slice()
      .sort((a, b) => {
        const dA = new Date(a.deadlineAt!).getTime();
        const dB = new Date(b.deadlineAt!).getTime();
        return dA - dB;
      });
  }, [productionEntries]);

  useEffect(() => {
    if (activeTimerEntries.length === 0) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [activeTimerEntries.length]);

  useEffect(() => {
    if (selectedIndex >= activeTimerEntries.length) {
      setSelectedIndex(0);
    }
  }, [activeTimerEntries.length, selectedIndex]);

  if (activeTimerEntries.length === 0) return null;

  const currentEntry =
    activeTimerEntries[selectedIndex] || activeTimerEntries[0];
  const snap = computeCountdownSnapshot(currentEntry, nowMs);
  if (!snap) return null;

  const handleMarkCompleted = async (entry: ProductionEntry) => {
    if (completingId) return;
    setCompletingId(entry.id);
    try {
      const nowLocal = getNowLocalDateTimeInput();
      const startRef =
        entry.startWorkTime || entry.countdownStartedAt || nowLocal;
      const dur = calculateDurationMinutes(startRef, nowLocal);
      await onSaveProduction({
        ...entry,
        workStatus: 'completed',
        startWorkTime: startRef,
        endWorkTime: nowLocal,
        workDurationMinutes: dur !== null && dur >= 0 ? dur : snap.targetDurationMinutes,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setCompletingId(null);
    }
  };

  const targetBn = formatDurationBn(snap.targetDurationMinutes);
  const totalRunningBn = formatCountdownClockBn(snap.totalElapsedMs, false);
  const remainingBn = formatCountdownClockBn(snap.remainingMs, true);
  const overdueBn = formatCountdownClockBn(snap.overdueMs, true);

  const overdueCount = activeTimerEntries.filter((e) => {
    const s = computeCountdownSnapshot(e, nowMs);
    return s?.isOverdue;
  }).length;

  const containerStyle = snap.isOverdue
    ? 'border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/50'
    : snap.isNearDeadline
    ? 'border-amber-300 dark:border-amber-800 bg-amber-50/85 dark:bg-amber-950/40'
    : 'border-teal-300 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-950/40';

  return (
    <div
      className={`rounded-2xl border-2 p-3.5 sm:p-4 space-y-3 shadow-2xs transition-colors ${containerStyle}`}
    >
      {/* Header Row: Title, Count, and Cycle Controls if multiple timers */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70 dark:border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white ${
              snap.isOverdue
                ? 'bg-rose-600 animate-pulse'
                : snap.isNearDeadline
                ? 'bg-amber-600'
                : 'bg-teal-700'
            }`}
          >
            {snap.isOverdue ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Timer className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {snap.isOverdue
                  ? 'নির্ধারিত সময় অতিক্রান্ত! (চলমান প্রোডাকশন কাজ)'
                  : 'চলমান কাজের লাইভ কাউন্টডাউন টাইমার'}
              </h2>
              {activeTimerEntries.length > 1 && (
                <span className="px-2 py-0.5 rounded-md bg-slate-900/10 dark:bg-white/10 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  মোট {toBengaliDigits(activeTimerEntries.length)}টি চলমান কাজ
                  {overdueCount > 0
                    ? ` (${toBengaliDigits(overdueCount)}টি সময় অতিক্রান্ত)`
                    : ''}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
              লক্ষ্যমাত্রা: <strong>{targetBn}</strong> · মোট চলমান সময়:{' '}
              <strong>{totalRunningBn}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {activeTimerEntries.length > 1 && (
            <div className="inline-flex items-center gap-1 mr-1">
              <button
                type="button"
                onClick={() =>
                  setSelectedIndex((prev) =>
                    prev === 0 ? activeTimerEntries.length - 1 : prev - 1
                  )
                }
                className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                title="পূর্ববর্তী চলমান কাজ"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-bold px-1 text-slate-700 dark:text-slate-300">
                {toBengaliDigits(selectedIndex + 1)}/
                {toBengaliDigits(activeTimerEntries.length)}
              </span>
              <button
                type="button"
                onClick={() =>
                  setSelectedIndex((prev) =>
                    prev === activeTimerEntries.length - 1 ? 0 : prev + 1
                  )
                }
                className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                title="পরবর্তী চলমান কাজ"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onNavigateToProduction}
            className="text-xs font-bold text-teal-800 dark:text-teal-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>প্রোডাকশন খাতা</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content: Task Info + Live Ticking Clock + Quick Complete Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {currentEntry.itemName || currentEntry.garmentType}
            </span>
            {currentEntry.category && (
              <span className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {currentEntry.category}
              </span>
            )}
            {currentEntry.size && (
              <span className="text-xs text-slate-600 dark:text-slate-400">
                সাইজ: {currentEntry.size}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">
            পরিমাণ:{' '}
            <strong>{toBengaliDigits(currentEntry.pieces ?? 0)} পিস</strong> (
            {formatDozensBn(currentEntry.dozens)} ডজন) · অর্জিত মজুরি:{' '}
            <strong className="text-teal-700 dark:text-teal-300">
              {formatTaka(currentEntry.totalWage, true)}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
          {snap.isOverdue ? (
            <div className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-mono font-bold shadow-xs">
              <div className="text-[10px] uppercase tracking-wide opacity-90 font-sans">
                সময় অতিক্রান্ত (অতিরিক্ত সময়)
              </div>
              <div className="text-sm sm:text-base">+{overdueBn}</div>
            </div>
          ) : (
            <div
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold shadow-xs ${
                snap.isNearDeadline
                  ? 'bg-amber-600 text-white'
                  : 'bg-teal-700 text-white'
              }`}
            >
              <div className="text-[10px] opacity-90 font-sans">
                কাউন্টডাউন বাকি সময়
              </div>
              <div className="text-sm sm:text-base">{remainingBn}</div>
            </div>
          )}

          <button
            type="button"
            disabled={completingId === currentEntry.id}
            onClick={() => void handleMarkCompleted(currentEntry)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {completingId === currentEntry.id
                ? 'সংরক্ষণ হচ্ছে...'
                : 'কাজ সম্পন্ন'}
            </span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="w-full h-2 rounded-full bg-white/80 dark:bg-slate-900/80 overflow-hidden border border-slate-200/60 dark:border-slate-800">
          <div
            className={`h-full transition-all duration-500 ${
              snap.isOverdue
                ? 'bg-rose-600 w-full'
                : snap.isNearDeadline
                ? 'bg-amber-500'
                : 'bg-teal-600'
            }`}
            style={{
              width: `${snap.isOverdue ? 100 : snap.progressPercent}%`,
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {snap.isOverdue
              ? `নির্ধারিত ${targetBn} পার হয়ে মোট ${totalRunningBn} ধরে কাজটি চলমান রয়েছে`
              : `লক্ষ্যমাত্রার ${toBengaliDigits(snap.progressPercent)}% সময় অতিবাহিত হয়েছে`}
          </span>
          <span className="font-mono font-semibold">
            {snap.isOverdue ? 'সময় অতিক্রান্ত!' : `${remainingBn} বাকি`}
          </span>
        </div>
      </div>
    </div>
  );
};
