import React, { useEffect, useState } from 'react';
import { Clock, RotateCcw, X } from 'lucide-react';
import {
  ddMmYyyyToIsoInput,
  formatWorkTimestampBn,
  toBengaliDigits,
} from '../../utils/formatters';

export interface AnalogClockTimePickerProps {
  id: string;
  labelBn: string;
  valueDateTimeLocal: string; // YYYY-MM-DDTHH:mm or empty
  defaultDateDDMMYYYY?: string; // e.g. 05-11-2026
  onChangeDateTimeLocal: (nextValue: string) => void;
  placeholderBn?: string;
}

const CLOCK_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const CLOCK_FIVE_MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function parseDateTimeParts(
  valueDateTimeLocal: string,
  fallbackDateDDMMYYYY?: string
): {
  isoDate: string;
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
} {
  const fallbackIso =
    (fallbackDateDDMMYYYY ? ddMmYyyyToIsoInput(fallbackDateDDMMYYYY) : '') ||
    new Date().toISOString().slice(0, 10);

  if (valueDateTimeLocal && valueDateTimeLocal.includes('T')) {
    const [datePart, timePart] = valueDateTimeLocal.split('T');
    const [hStr, mStr] = (timePart || '').split(':');
    const h24 = Number(hStr);
    const min = Number(mStr);
    if (Number.isFinite(h24) && Number.isFinite(min)) {
      const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
      const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return {
        isoDate: datePart || fallbackIso,
        hour12,
        minute: Math.max(0, Math.min(59, min)),
        period,
      };
    }
  }

  const now = new Date();
  const h24 = now.getHours();
  return {
    isoDate: fallbackIso,
    hour12: h24 % 12 === 0 ? 12 : h24 % 12,
    minute: now.getMinutes(),
    period: h24 >= 12 ? 'PM' : 'AM',
  };
}

function buildDateTimeLocalString(
  isoDate: string,
  hour12: number,
  minute: number,
  period: 'AM' | 'PM'
): string {
  let h24 = hour12 % 12;
  if (period === 'PM') {
    h24 += 12;
  }
  const hh = String(h24).padStart(2, '0');
  const mm = String(Math.max(0, Math.min(59, minute))).padStart(2, '0');
  const cleanDate = isoDate || new Date().toISOString().slice(0, 10);
  return `${cleanDate}T${hh}:${mm}`;
}

export const AnalogClockTimePicker: React.FC<AnalogClockTimePickerProps> = ({
  id,
  labelBn,
  valueDateTimeLocal,
  defaultDateDDMMYYYY,
  onChangeDateTimeLocal,
  placeholderBn = 'ঘড়ির সময় নির্বাচন করুন',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [isoDate, setIsoDate] = useState<string>('');
  const [hour12, setHour12] = useState<number>(9);
  const [minute, setMinute] = useState<number>(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  useEffect(() => {
    if (isOpen) {
      const parts = parseDateTimeParts(valueDateTimeLocal, defaultDateDDMMYYYY);
      setIsoDate(parts.isoDate);
      setHour12(parts.hour12);
      setMinute(parts.minute);
      setPeriod(parts.period);
      setMode('hour');
    }
  }, [isOpen, valueDateTimeLocal, defaultDateDDMMYYYY]);

  const handleSelectHour = (h: number) => {
    setHour12(h);
    // Step 1 -> Step 2: Automatically switch to minute selection
    setTimeout(() => {
      setMode('minute');
    }, 180);
  };

  const handleSelectMinute = (m: number) => {
    setMinute(m);
  };

  const handleStepMinute = (delta: number) => {
    setMinute((prev) => (prev + delta + 60) % 60);
  };

  const handleConfirm = () => {
    const formatted = buildDateTimeLocalString(isoDate, hour12, minute, period);
    onChangeDateTimeLocal(formatted);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChangeDateTimeLocal('');
    setIsOpen(false);
  };

  // Calculate clock hand angle in degrees (0 deg = 12 o'clock)
  const handAngleDeg =
    mode === 'hour' ? (hour12 % 12) * 30 : minute * 6;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {labelBn}
      </label>

      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:border-teal-600 dark:hover:border-teal-500 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
      >
        <span
          className={`text-xs sm:text-sm font-mono truncate ${
            valueDateTimeLocal
              ? 'text-slate-900 dark:text-slate-100 font-semibold'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {valueDateTimeLocal
            ? formatWorkTimestampBn(valueDateTimeLocal)
            : placeholderBn}
        </span>
        <Clock className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={labelBn}
        >
          <div className="w-full max-w-[340px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Top Digital Header + AM/PM Toggle */}
            <div className="bg-teal-700 dark:bg-teal-800 text-white p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-teal-100">
                <span className="font-semibold">{labelBn}</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-teal-600/60 text-white cursor-pointer"
                  aria-label="বন্ধ করুন"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                {/* Digital Hour : Minute Display */}
                <div className="flex items-baseline gap-1 font-mono tabular-nums">
                  <button
                    type="button"
                    onClick={() => setMode('hour')}
                    className={`text-3xl font-bold px-2 py-1 rounded-xl transition-colors cursor-pointer ${
                      mode === 'hour'
                        ? 'bg-white/20 text-white'
                        : 'text-teal-200 hover:text-white'
                    }`}
                  >
                    {toBengaliDigits(String(hour12).padStart(2, '0'))}
                  </button>
                  <span className="text-2xl font-bold text-teal-200">:</span>
                  <button
                    type="button"
                    onClick={() => setMode('minute')}
                    className={`text-3xl font-bold px-2 py-1 rounded-xl transition-colors cursor-pointer ${
                      mode === 'minute'
                        ? 'bg-white/20 text-white'
                        : 'text-teal-200 hover:text-white'
                    }`}
                  >
                    {toBengaliDigits(String(minute).padStart(2, '0'))}
                  </button>
                </div>

                {/* AM / PM Selector */}
                <div className="flex flex-col gap-1 bg-teal-900/40 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPeriod('AM')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      period === 'AM'
                        ? 'bg-white text-teal-900'
                        : 'text-teal-100 hover:bg-white/10'
                    }`}
                  >
                    পূর্বাহ্ণ (AM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('PM')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      period === 'PM'
                        ? 'bg-white text-teal-900'
                        : 'text-teal-100 hover:bg-white/10'
                    }`}
                  >
                    অপরাহ্ণ (PM)
                  </button>
                </div>
              </div>

              {/* Step Indicator */}
              <div className="flex items-center justify-between text-[11px] text-teal-100 pt-1 border-t border-teal-600/60">
                <span>
                  {mode === 'hour'
                    ? 'ধাপ ১: ঘড়ির কাঁটায় ঘণ্টা (১–১২) নির্বাচন করুন'
                    : 'ধাপ ২: মিনিট (০০–৫৫) নির্বাচন করুন'}
                </span>
                <button
                  type="button"
                  onClick={() => setMode(mode === 'hour' ? 'minute' : 'hour')}
                  className="underline font-semibold cursor-pointer"
                >
                  {mode === 'hour' ? 'মিনিটে যান →' : '← ঘণ্টায় ফিরুন'}
                </button>
              </div>
            </div>

            {/* Circular Analog Clock Face */}
            <div className="p-4 flex flex-col items-center space-y-3 bg-slate-50/70 dark:bg-slate-950/50">
              <div className="relative w-56 h-56 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-inner select-none">
                {/* Rotating Clock Hand */}
                <div
                  className="absolute left-1/2 bottom-1/2 origin-bottom pointer-events-none transition-transform duration-200 ease-out"
                  style={{
                    width: '2px',
                    height: '78px',
                    marginLeft: '-1px',
                    transform: `rotate(${handAngleDeg}deg)`,
                  }}
                >
                  <div className="w-full h-full bg-teal-600 dark:bg-teal-500 rounded-full relative">
                    <div className="w-3 h-3 rounded-full bg-teal-600 dark:bg-teal-400 absolute -top-1.5 -left-[5px]" />
                  </div>
                </div>

                {/* Center Clock Pin */}
                <div className="w-3 h-3 rounded-full bg-teal-700 dark:bg-teal-400 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10" />

                {/* Clock Numbers around the Circle */}
                {mode === 'hour'
                  ? CLOCK_HOURS.map((h, idx) => {
                      const angleRad = ((idx * 30 - 90) * Math.PI) / 180;
                      const radius = 84;
                      const x = 112 + radius * Math.cos(angleRad);
                      const y = 112 + radius * Math.sin(angleRad);
                      const isSelected = hour12 === h;
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => handleSelectHour(h)}
                          style={{
                            left: `${x}px`,
                            top: `${y}px`,
                          }}
                          className={`w-9 h-9 -ml-4.5 -mt-4.5 absolute rounded-full text-xs sm:text-sm font-bold font-mono flex items-center justify-center transition-colors cursor-pointer z-20 ${
                            isSelected
                              ? 'bg-teal-700 text-white shadow-sm'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950/60'
                          }`}
                        >
                          {toBengaliDigits(h)}
                        </button>
                      );
                    })
                  : CLOCK_FIVE_MINUTES.map((m, idx) => {
                      const angleRad = ((idx * 30 - 90) * Math.PI) / 180;
                      const radius = 84;
                      const x = 112 + radius * Math.cos(angleRad);
                      const y = 112 + radius * Math.sin(angleRad);
                      const isSelected = minute === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleSelectMinute(m)}
                          style={{
                            left: `${x}px`,
                            top: `${y}px`,
                          }}
                          className={`w-9 h-9 -ml-4.5 -mt-4.5 absolute rounded-full text-xs font-bold font-mono flex items-center justify-center transition-colors cursor-pointer z-20 ${
                            isSelected
                              ? 'bg-teal-700 text-white shadow-sm'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950/60'
                          }`}
                        >
                          {toBengaliDigits(String(m).padStart(2, '0'))}
                        </button>
                      );
                    })}
              </div>

              {/* Fine Minute Adjusters & Date Selector */}
              <div className="w-full flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleStepMinute(-1)}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  -১ মিনিট
                </button>
                <input
                  type="date"
                  value={isoDate}
                  onChange={(e) => setIsoDate(e.target.value)}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-700 dark:text-slate-300"
                  aria-label="তারিখ"
                />
                <button
                  type="button"
                  onClick={() => handleStepMinute(1)}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  +১ মিনিট
                </button>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>মুছুন</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="min-h-[40px] px-4 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer"
                >
                  নিশ্চিত করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
