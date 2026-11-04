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

/**
 * Normalizes Bengali digits to ASCII digits for search and input parsing.
 */
export function toAsciiDigits(value: string): string {
  return value.replace(/[০-৯]/g, (digit) => ENGLISH_DIGITS[digit] ?? digit);
}

/**
 * Formats Bangladeshi Taka (৳) using Bengali digits.
 * When database data is null/unloaded in Phase 1, displays "৳ ০.০০" or explicit placeholder without fake math.
 */
export function formatTaka(amount: number | null | undefined, showZeroWhenNull = true): string {
  if (amount === null || amount === undefined) {
    return showZeroWhenNull ? '৳ ০.০০' : 'ডাটাবেস সংযোগের অপেক্ষায়';
  }
  const formattedNumber = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `৳ ${toBengaliDigits(formattedNumber)}`;
}

/**
 * Formats an ISO date string (YYYY-MM-DD) or Date object into DD-MM-YYYY in Bengali digits.
 */
export function formatDateDDMMYYYY(input?: string | Date | null, useBengaliNumerals = true): string {
  if (!input) {
    return '—';
  }

  if (typeof input === 'string') {
    // Already DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(input)) {
      return useBengaliNumerals ? toBengaliDigits(input) : input;
    }
    // ISO YYYY-MM-DD
    const parts = input.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const ddMmYyyy = `${parts[2]}-${parts[1]}-${parts[0]}`;
      return useBengaliNumerals ? toBengaliDigits(ddMmYyyy) : ddMmYyyy;
    }
    return useBengaliNumerals ? toBengaliDigits(input) : input;
  }

  const day = String(input.getDate()).padStart(2, '0');
  const month = String(input.getMonth() + 1).padStart(2, '0');
  const year = String(input.getFullYear());
  const formatted = `${day}-${month}-${year}`;
  return useBengaliNumerals ? toBengaliDigits(formatted) : formatted;
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
  const normalized = toAsciiDigits(ddMmYyyy);
  const parts = normalized.split('-');
  if (parts.length !== 3 || parts[2].length !== 4) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/**
 * Returns today's date in DD-MM-YYYY format.
 */
export function getTodayDDMMYYYY(useBengaliNumerals = false): string {
  return formatDateDDMMYYYY(new Date(), useBengaliNumerals);
}
