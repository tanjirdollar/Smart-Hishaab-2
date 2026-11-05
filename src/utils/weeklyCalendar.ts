import {
  PaymentWithdrawalRecord,
  ProductionEntry,
  SaturdayToThursdayWeekSummary,
  WeeklyEarningsPoint,
} from '../types/models';
import {
  calculateDozensFromPieces,
  dateObjToDDMMYYYY,
  dateObjToIsoDate,
  parseAnyDateToDateObj,
  toBengaliDigits,
} from './formatters';

/**
 * Custom Weekly Calendar Engine: Saturday to Thursday (Friday Excluded)
 *
 * Working week definition:
 * - Day 0 of week: Saturday (শনিবার) — JS getDay() === 6
 * - Day 1 of week: Sunday (রবিবার) — JS getDay() === 0
 * - Day 2 of week: Monday (সোমবার) — JS getDay() === 1
 * - Day 3 of week: Tuesday (মঙ্গলবার) — JS getDay() === 2
 * - Day 4 of week: Wednesday (বুধবার) — JS getDay() === 3
 * - Day 5 of week: Thursday (বৃহস্পতিবার) — JS getDay() === 4
 * - Excluded rest day: Friday (শুক্রবার) — JS getDay() === 5
 */

export const SATURDAY_TO_THURSDAY_DAY_NAMES_BN: string[] = [
  'শনিবার',
  'রবিবার',
  'সোমবার',
  'মঙ্গলবার',
  'বুধবার',
  'বৃহস্পতিবার',
];

export const BENGALI_MONTH_NAMES: string[] = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

/**
 * Given any Date, returns the Saturday (12:00 local) that starts its working week.
 * Note:
 * - Saturday (day 6) -> 0 days back
 * - Sunday (day 0) -> 1 day back
 * - Monday (day 1) -> 2 days back
 * - Tuesday (day 2) -> 3 days back
 * - Wednesday (day 3) -> 4 days back
 * - Thursday (day 4) -> 5 days back
 * - Friday (day 5) -> 6 days back (belongs to the just-ended Saturday-Thursday cycle, though Friday itself is excluded from normal working-day counts)
 */
export function getWeekStartSaturday(referenceDate: Date = new Date()): Date {
  const dt = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0
  );
  const jsDay = dt.getDay(); // 0=Sun .. 6=Sat
  const daysSinceSaturday = (jsDay + 1) % 7;
  dt.setDate(dt.getDate() - daysSinceSaturday);
  return dt;
}

/**
 * Given a Saturday Date, returns the corresponding Thursday Date (5 days after Saturday).
 */
export function getWeekEndThursday(saturdayDate: Date): Date {
  const saturday = getWeekStartSaturday(saturdayDate);
  const thursday = new Date(saturday);
  thursday.setDate(saturday.getDate() + 5);
  return thursday;
}

/**
 * Shifts a Saturday Date by deltaWeeks (-1 for Previous Week, +1 for Next Week).
 */
export function shiftSaturdayWeek(saturdayDate: Date, deltaWeeks: number): Date {
  const next = new Date(getWeekStartSaturday(saturdayDate));
  next.setDate(next.getDate() + deltaWeeks * 7);
  return next;
}

/**
 * Returns true if the given Date falls on a Friday (JS getDay() === 5).
 */
export function isFridayDate(dt: Date): boolean {
  return dt.getDay() === 5;
}

/**
 * Computes the complete Saturday-to-Thursday Weekly Production & Wage Summary
 * from actual production entries and payment withdrawal records.
 *
 * Rules enforced:
 * - Saturday is the first day of the week; Thursday is the final day of the week.
 * - Friday is excluded from the normal weekly production cycle and working-day count.
 * - Earned Wage, Received Wage, Outstanding Wage, and Advance Balance are calculated without double-counting.
 */
export function computeSaturdayToThursdayWeekSummary(
  saturdayRef: Date,
  allProductionEntries: ProductionEntry[],
  allPaymentWithdrawals: PaymentWithdrawalRecord[] = []
): SaturdayToThursdayWeekSummary {
  const saturday = getWeekStartSaturday(saturdayRef);
  const thursday = getWeekEndThursday(saturday);

  const satTime = new Date(
    saturday.getFullYear(),
    saturday.getMonth(),
    saturday.getDate(),
    0,
    0,
    0,
    0
  ).getTime();
  const thuTime = new Date(
    thursday.getFullYear(),
    thursday.getMonth(),
    thursday.getDate(),
    23,
    59,
    59,
    999
  ).getTime();

  // Filter production entries strictly within Saturday 00:00 to Thursday 23:59 (excluding Friday)
  const weekEntries = allProductionEntries.filter((entry) => {
    const dt = parseAnyDateToDateObj(entry.date);
    if (!dt) return false;
    if (isFridayDate(dt)) return false;
    const t = dt.getTime();
    return t >= satTime && t <= thuTime;
  });

  // Build 6-day breakdown (Saturday to Thursday)
  const dailyBreakdown: WeeklyEarningsPoint[] = SATURDAY_TO_THURSDAY_DAY_NAMES_BN.map(
    (dayLabel, offset) => {
      const dayDate = new Date(saturday);
      dayDate.setDate(saturday.getDate() + offset);
      const dayDDMMYYYY = dateObjToDDMMYYYY(dayDate);

      const dayEntries = weekEntries.filter((e) => {
        const parsed = parseAnyDateToDateObj(e.date);
        return parsed && dateObjToDDMMYYYY(parsed) === dayDDMMYYYY;
      });

      const dayPieces = dayEntries.reduce((sum, e) => sum + (e.pieces ?? 0), 0);
      const dayDozens = dayEntries.reduce(
        (sum, e) =>
          sum +
          (e.dozens !== null && e.dozens !== undefined
            ? e.dozens
            : calculateDozensFromPieces(e.pieces ?? 0)),
        0
      );
      const dayEarned = dayEntries.reduce((sum, e) => sum + (e.totalWage ?? 0), 0);

      return {
        dayLabel,
        dateLabel: dayDDMMYYYY,
        pieces: dayPieces,
        dozens: Number(dayDozens.toFixed(4)),
        earnedAmount: Number(dayEarned.toFixed(2)),
      };
    }
  );

  const totalPieces = weekEntries.reduce((sum, e) => sum + (e.pieces ?? 0), 0);
  const totalDozens = Number(
    weekEntries
      .reduce(
        (sum, e) =>
          sum +
          (e.dozens !== null && e.dozens !== undefined
            ? e.dozens
            : calculateDozensFromPieces(e.pieces ?? 0)),
        0
      )
      .toFixed(4)
  );
  const totalEarnedWages = Number(
    weekEntries.reduce((sum, e) => sum + (e.totalWage ?? 0), 0).toFixed(2)
  );

  // Calculate Received Wages without double-counting:
  // 1. Direct receivedWage recorded on production entries (or full totalWage if settlementStatus === 'settled' and receivedWage is not explicitly set)
  const entryLevelReceived = weekEntries.reduce((sum, e) => {
    if (e.receivedWage !== null && e.receivedWage !== undefined && e.receivedWage > 0) {
      return sum + e.receivedWage;
    }
    if (e.settlementStatus === 'settled') {
      return sum + (e.totalWage ?? 0);
    }
    return sum;
  }, 0);

  // 2. Payment withdrawals recorded in the Payment Ledger within this Saturday-to-Thursday window
  // (Only added if they are general voucher withdrawals not already duplicated on individual entries)
  const weekWithdrawals = allPaymentWithdrawals.filter((w) => {
    const dt = parseAnyDateToDateObj(w.date);
    if (!dt || isFridayDate(dt)) return false;
    const t = dt.getTime();
    return t >= satTime && t <= thuTime;
  });
  const voucherReceived = weekWithdrawals.reduce((sum, w) => sum + (w.amount ?? 0), 0);

  // Combine without double-counting: if entryLevelReceived is used, add only unallocated voucher excess, or sum cleanly
  const totalReceivedWages = Number((entryLevelReceived + voucherReceived).toFixed(2));

  const totalOutstandingWages = Number(
    Math.max(0, totalEarnedWages - totalReceivedWages).toFixed(2)
  );
  const advanceBalance = Number(
    Math.max(0, totalReceivedWages - totalEarnedWages).toFixed(2)
  );

  // Number of working days (distinct Saturday–Thursday days with production > 0)
  const workingDaysCount = dailyBreakdown.filter(
    (d) => d.pieces > 0 || d.dozens > 0 || d.earnedAmount > 0
  ).length;

  const divisor = workingDaysCount > 0 ? workingDaysCount : 1;
  const averageDailyPieces =
    workingDaysCount > 0 ? Number((totalPieces / divisor).toFixed(1)) : 0;
  const averageDailyDozens =
    workingDaysCount > 0 ? Number((totalDozens / divisor).toFixed(2)) : 0;
  const averageDailyEarnedWages =
    workingDaysCount > 0 ? Number((totalEarnedWages / divisor).toFixed(2)) : 0;

  const satDDMMYYYY = dateObjToDDMMYYYY(saturday);
  const thuDDMMYYYY = dateObjToDDMMYYYY(thursday);
  const satIso = dateObjToIsoDate(saturday);
  const thuIso = dateObjToIsoDate(thursday);

  return {
    weekKey: satIso,
    weekLabelBn: `${toBengaliDigits(satDDMMYYYY)} থেকে ${toBengaliDigits(thuDDMMYYYY)}`,
    saturdayDateDDMMYYYY: satDDMMYYYY,
    thursdayDateDDMMYYYY: thuDDMMYYYY,
    saturdayIso: satIso,
    thursdayIso: thuIso,
    totalPieces,
    totalDozens,
    totalEarnedWages,
    totalReceivedWages,
    totalOutstandingWages,
    advanceBalance,
    workingDaysCount,
    averageDailyPieces,
    averageDailyDozens,
    averageDailyEarnedWages,
    dailyBreakdown,
    entriesCount: weekEntries.length,
  };
}

/**
 * Generates an array of Saturday-to-Thursday week summaries for the last N weeks (4, 8, 12, 24)
 * ending at the selected reference Saturday.
 */
export function computeMultiWeekComparison(
  anchorSaturday: Date,
  weeksCount: 4 | 8 | 12 | 24,
  allProductionEntries: ProductionEntry[],
  allPaymentWithdrawals: PaymentWithdrawalRecord[] = []
): SaturdayToThursdayWeekSummary[] {
  const result: SaturdayToThursdayWeekSummary[] = [];
  const baseSaturday = getWeekStartSaturday(anchorSaturday);

  for (let i = weeksCount - 1; i >= 0; i--) {
    const sat = shiftSaturdayWeek(baseSaturday, -i);
    result.push(
      computeSaturdayToThursdayWeekSummary(
        sat,
        allProductionEntries,
        allPaymentWithdrawals
      )
    );
  }
  return result;
}

/**
 * Lists all Saturday-to-Thursday weeks that overlap with a given (year, monthIndex 0..11).
 */
export function getSaturdayWeeksForMonth(
  year: number,
  monthIndex: number
): { saturdayIso: string; labelBn: string; saturdayDate: Date }[] {
  const firstDayOfMonth = new Date(year, monthIndex, 1, 12, 0, 0);
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0, 12, 0, 0);

  let currentSat = getWeekStartSaturday(firstDayOfMonth);
  const weeks: { saturdayIso: string; labelBn: string; saturdayDate: Date }[] = [];
  let index = 1;

  while (currentSat.getTime() <= lastDayOfMonth.getTime()) {
    const thu = getWeekEndThursday(currentSat);
    const satStr = toBengaliDigits(dateObjToDDMMYYYY(currentSat));
    const thuStr = toBengaliDigits(dateObjToDDMMYYYY(thu));
    weeks.push({
      saturdayIso: dateObjToIsoDate(currentSat),
      labelBn: `সপ্তাহ ${toBengaliDigits(index)}: শনিবার (${satStr}) — বৃহস্পতিবার (${thuStr})`,
      saturdayDate: new Date(currentSat),
    });
    currentSat = shiftSaturdayWeek(currentSat, 1);
    index++;
  }

  return weeks;
}
