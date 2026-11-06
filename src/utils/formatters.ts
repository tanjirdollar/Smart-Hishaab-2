const BENGALI_DIGITS: Record<string, string> = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

const ENGLISH_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

/**
 * Converts English numerals in a string or number to Bengali digits.
 */
export function toBengaliDigits(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value).replace(/[0-9]/g, (digit) => BENGALI_DIGITS[digit] ?? digit);
}

export const formatNumberBn = toBengaliDigits;

/**
 * Normalizes Bengali digits to ASCII digits for search and input parsing.
 */
export function toAsciiDigits(value: string): string {
  return String(value ?? '').replace(/[০-৯]/g, (digit) => ENGLISH_DIGITS[digit] ?? digit);
}

/**
 * Formats Bangladeshi Taka (৳) using Bengali digits with 2 decimal precision.
 */
export function formatTaka(amount: number | null | undefined, showZeroWhenNull = true): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return showZeroWhenNull ? '৳ ০.০০' : '—';
  }
  const formattedNumber = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `৳ ${toBengaliDigits(formattedNumber)}`;
}

export const formatCurrencyBDT = formatTaka;

/**
 * Formats Dozens value cleanly in Bengali digits (up to 2 decimal places).
 */
export function formatDozensBn(dozens: number | null | undefined): string {
  if (dozens === null || dozens === undefined || !Number.isFinite(dozens)) {
    return '০.০০';
  }
  const formatted = dozens.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return toBengaliDigits(formatted);
}

/**
 * Precise calculation: Dozens = Pieces / 12
 */
export function calculateDozensFromPieces(pieces: number): number {
  if (!Number.isFinite(pieces) || pieces < 0) return 0;
  return Number((pieces / 12).toFixed(4));
}

/**
 * Precise calculation: Earned Wage = (Pieces / 12) * Rate per Dozen
 */
export function calculateEarnedWageFromPiecesAndRate(
  pieces: number,
  ratePerDozen: number
): number {
  if (!Number.isFinite(pieces) || !Number.isFinite(ratePerDozen) || pieces < 0 || ratePerDozen < 0) {
    return 0;
  }
  const exactDozens = pieces / 12;
  return Number((exactDozens * ratePerDozen).toFixed(2));
}

/**
 * Parses DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, or Date into a valid Date object (at 12:00 local).
 */
export function parseAnyDateToDateObj(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : new Date(input.getFullYear(), input.getMonth(), input.getDate(), 12, 0, 0);
  }

  const raw = toAsciiDigits(String(input).trim());
  if (!raw) return null;

  // Match DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const dt = new Date(year, month - 1, day, 12, 0, 0);
    if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
      return dt;
    }
    return null;
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    const dt = new Date(year, month - 1, day, 12, 0, 0);
    if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
      return dt;
    }
    return null;
  }

  // Excel serial number (e.g., 45000 - 48000)
  if (/^\d{5}$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 30000 && serial < 70000) {
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      return new Date(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate(), 12, 0, 0);
    }
  }

  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) {
    return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate(), 12, 0, 0);
  }
  return null;
}

/**
 * Formats Date object into ASCII DD-MM-YYYY
 */
export function dateObjToDDMMYYYY(dt: Date): string {
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = String(dt.getFullYear());
  return `${day}-${month}-${year}`;
}

/**
 * Formats Date object into ASCII YYYY-MM-DD
 */
export function dateObjToIsoDate(dt: Date): string {
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = String(dt.getFullYear());
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes any supported date string to ASCII DD-MM-YYYY, or returns null if invalid.
 */
export function normalizeToDDMMYYYY(input: string | Date | null | undefined): string | null {
  const dt = parseAnyDateToDateObj(input);
  if (!dt) return null;
  return dateObjToDDMMYYYY(dt);
}

/**
 * Formats an ISO date string (YYYY-MM-DD), DD-MM-YYYY, or Date object into DD-MM-YYYY in Bengali digits.
 */
export function formatDateDDMMYYYY(input?: string | Date | null, useBengaliNumerals = true): string {
  if (!input) {
    return '—';
  }
  const dt = parseAnyDateToDateObj(input);
  if (dt) {
    const formatted = dateObjToDDMMYYYY(dt);
    return useBengaliNumerals ? toBengaliDigits(formatted) : formatted;
  }

  const raw = String(input);
  return useBengaliNumerals ? toBengaliDigits(raw) : raw;
}

/**
 * Converts HTML <input type="date"> value (YYYY-MM-DD) to DD-MM-YYYY ASCII string.
 */
export function isoInputToDDMMYYYY(isoValue: string): string {
  if (!isoValue) return '';
  const parts = isoValue.split('-');
  if (parts.length !== 3) return isoValue;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/**
 * Converts DD-MM-YYYY ASCII string to HTML <input type="date"> value (YYYY-MM-DD).
 */
export function ddMmYyyyToIsoInput(ddMmYyyy: string): string {
  if (!ddMmYyyy) return '';
  const dt = parseAnyDateToDateObj(ddMmYyyy);
  if (!dt) return '';
  return dateObjToIsoDate(dt);
}

/**
 * Returns today's date in DD-MM-YYYY format.
 */
export function getTodayDDMMYYYY(useBengaliNumerals = false): string {
  return formatDateDDMMYYYY(new Date(), useBengaliNumerals);
}

/**
 * Returns current local date-time formatted as YYYY-MM-DDTHH:mm for datetime-local inputs.
 */
export function getNowLocalDateTimeInput(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Converts any ISO/timestamp string to YYYY-MM-DDTHH:mm for <input type="datetime-local">.
 */
export function toDateTimeLocalInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const clean = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(clean)) {
    return clean;
  }
  const dt = new Date(clean);
  if (Number.isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Calculates working duration in minutes between startWorkTime and endWorkTime.
 * Returns null if either is empty, or a negative number if endWorkTime < startWorkTime.
 */
export function calculateDurationMinutes(
  startWorkTime: string | null | undefined,
  endWorkTime: string | null | undefined
): number | null {
  if (!startWorkTime || !endWorkTime) return null;
  const startDt = new Date(startWorkTime);
  const endDt = new Date(endWorkTime);
  if (Number.isNaN(startDt.getTime()) || Number.isNaN(endDt.getTime())) return null;
  return Math.round((endDt.getTime() - startDt.getTime()) / 60000);
}

/**
 * Formats duration in minutes into readable Bengali string (e.g., "২ ঘণ্টা ১৫ মিনিট").
 */
export function formatDurationBn(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return '—';
  }
  if (minutes < 0) {
    return 'অবৈধ সময়ক্রম';
  }
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) {
    return `${toBengaliDigits(mins)} মিনিট`;
  }
  if (mins === 0) {
    return `${toBengaliDigits(hrs)} ঘণ্টা`;
  }
  return `${toBengaliDigits(hrs)} ঘণ্টা ${toBengaliDigits(mins)} মিনিট`;
}

/**
 * Formats a start/end timestamp into Bengali DD-MM-YYYY · HH:mm.
 */
export function formatWorkTimestampBn(timestamp: string | null | undefined): string {
  if (!timestamp) return '—';
  const dt = new Date(timestamp);
  if (Number.isNaN(dt.getTime())) return toBengaliDigits(timestamp);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return toBengaliDigits(`${dd}-${mm}-${yyyy} · ${hh}:${min}`);
}
