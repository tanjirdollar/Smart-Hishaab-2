import * as XLSX from 'xlsx';
import { GARMENT_SIZE_OPTIONS } from '../config/navigation';
import {
  FundRecord,
  IncomeExpenseRecord,
  LoanRecord,
  PaymentWithdrawalRecord,
  ProductionEntry,
  SettlementStatus,
  UploadedPhotoPreview,
  WageLedgerRecord,
  WorkStatus,
} from '../types/models';
import {
  calculateDozensFromPieces,
  calculateEarnedWageFromPiecesAndRate,
  normalizeToDDMMYYYY,
  toAsciiDigits,
  toBengaliDigits,
} from '../utils/formatters';
import { BENGALI_MONTH_NAMES } from '../utils/weeklyCalendar';
import { ApplicationRepositoryState } from './financialDomainService';

export interface RawSmartHisabBackupJson {
  income?: Record<string, unknown>[];
  expense?: Record<string, unknown>[];
  production?: Record<string, unknown>[];
  loan?: Record<string, unknown>[];
  fund?: Record<string, unknown>[];
  fund_transaction?: Record<string, unknown>[];
}

export interface FullBackupImportSummary {
  productionCount: number;
  withdrawalCount: number;
  expenseCount: number;
  incomeCount: number;
  loanCount: number;
  fundCount: number;
  fundTxCount: number;
}

function cleanNumber(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val === null || val === undefined) return 0;
  const str = toAsciiDigits(String(val))
    .replace(/[৳$,\s]/g, '')
    .trim();
  const num = Number(str);
  return Number.isFinite(num) ? num : 0;
}

function inferGarmentCategory(workName: string, note: string): string {
  const combined = `${workName} ${note}`;
  const tagMatch = note.match(/\[ট্যাগ:\s*([^\]]+)\]/);
  if (tagMatch && tagMatch[1]) {
    const tag = tagMatch[1].trim();
    if (tag.includes('কটি') || tag.includes('কর্টি')) return 'কটি';
    if (tag.includes('গোলগোলা') || tag.includes('গোলগলা') || tag.includes('গোল গলা')) {
      return 'গোলগোলা';
    }
    if (tag.includes('শার্ট')) return 'শার্ট';
    if (tag.includes('প্যান্ট')) return 'প্যান্ট';
  }

  if (/কটির\s*প্যান্ট/i.test(combined)) return 'প্যান্ট';
  if (/কটির\s*শার্ট/i.test(combined)) return 'শার্ট';
  if (/প্যান্ট|pant/i.test(combined)) return 'প্যান্ট';
  if (/গোলগোলা|গোলগলা|গোল\s*গলা|গোল\s*গোলা|gola|টি-শার্ট|body|বডি/i.test(combined)) {
    return 'গোলগোলা';
  }
  if (/শার্ট|shirt/i.test(combined)) return 'শার্ট';
  if (/কটি|কর্টি/i.test(combined)) return 'কটি';

  return 'প্যান্ট';
}

function extractSizesArray(rawSize: unknown): string[] {
  if (rawSize === null || rawSize === undefined) return [];
  const str = toAsciiDigits(String(rawSize)).trim();
  if (!str || str === '-') return [];
  const matches = str.match(/\d+/g) || [];
  const result: string[] = [];
  for (const m of matches) {
    const bn = toBengaliDigits(m);
    if (!result.includes(bn)) {
      result.push(bn);
    }
  }
  if (result.length === 0 && str) {
    const bnFallback = toBengaliDigits(str);
    if (GARMENT_SIZE_OPTIONS.includes(bnFallback)) {
      result.push(bnFallback);
    }
  }
  return result;
}

function extractWorkTimingFromNote(
  note: string,
  isoDateStr: string
): {
  cleanNote: string;
  workStatus: WorkStatus;
  startWorkTime: string | null;
  endWorkTime: string | null;
} {
  const isRunning = /চলমান/.test(note);
  const workStatus: WorkStatus = isRunning ? 'in_progress' : 'completed';

  // Clean out technical tags like [ট্যাগ: ...] if desired, but keep meaningful Bangla notes
  const cleanNote = note
    .replace(/\[ট্যাগ:\s*[^\]]+\]/g, '')
    .replace(/^Done\s*/i, '')
    .trim();

  let startWorkTime: string | null = null;
  let endWorkTime: string | null = null;

  const timeBlockMatch = note.match(/\[শুরু\s*-\s*([^\]]+)\]/);
  if (timeBlockMatch && timeBlockMatch[1]) {
    // Provide a valid date-time string if time was recorded in the note
    const content = toAsciiDigits(timeBlockMatch[1]);
    const timeDigits = content.match(/(\d{1,2}):(\d{2})/g);
    if (timeDigits && timeDigits[0] && /^\d{4}-\d{2}-\d{2}$/.test(isoDateStr)) {
      const [h1, m1] = timeDigits[0].split(':').map(Number);
      const hh1 = String(h1 % 24).padStart(2, '0');
      const mm1 = String(m1 % 60).padStart(2, '0');
      startWorkTime = `${isoDateStr}T${hh1}:${mm1}`;

      if (timeDigits[1]) {
        const [h2, m2] = timeDigits[1].split(':').map(Number);
        const hh2 = String(Math.max(h1, h2) % 24).padStart(2, '0');
        const mm2 = String(m2 % 60).padStart(2, '0');
        endWorkTime = `${isoDateStr}T${hh2}:${mm2}`;
      }
    }
  }

  return {
    cleanNote: cleanNote || note.trim(),
    workStatus,
    startWorkTime,
    endWorkTime,
  };
}

/**
 * Converts a raw SmartHisab JSON backup object (or multi-sheet Excel data converted to this shape)
 * into the full ApplicationRepositoryState across all modules.
 */
export function parseSmartHisabBackupData(raw: RawSmartHisabBackupJson): {
  state: ApplicationRepositoryState;
  summary: FullBackupImportSummary;
} {
  const productionEntries: ProductionEntry[] = [];
  const paymentWithdrawals: PaymentWithdrawalRecord[] = [];
  const incomeExpenseRecords: IncomeExpenseRecord[] = [];
  const loanRecords: LoanRecord[] = [];
  const fundRecords: FundRecord[] = [];

  // 1. Parse "production" array (contains both "Work" and "Withdrawal" entries)
  const rawProdList = Array.isArray(raw.production) ? raw.production : [];
  rawProdList.forEach((row, idx) => {
    const rawType = String(row.Type || row.type || 'Work').trim();
    const rawDateStr = String(row.Date || row.date || '').trim();
    const dateDDMMYYYY = normalizeToDDMMYYYY(rawDateStr) || rawDateStr;
    const rawId = String(row.ID || row.id || `prod-bkp-${idx + 1}`).trim();
    const workName = String(
      row['Work Name'] || row.Work_Name || row.itemName || ''
    ).trim();
    const rawNote =
      row.Note !== undefined && row.Note !== null ? String(row.Note).trim() : '';

    if (
      rawType.toLowerCase() === 'withdrawal' ||
      /উত্তোলন/.test(workName) ||
      (cleanNumber(row.Received) > 0 && cleanNumber(row.Pcs) === 0)
    ) {
      const receivedAmount = cleanNumber(row.Received || row.Amount);
      if (receivedAmount > 0) {
        paymentWithdrawals.push({
          id: rawId,
          date: dateDDMMYYYY,
          voucherNo: rawId,
          paymentMethod: 'নগদ ক্যাশ (Cash)',
          weekReference: rawNote
            ? `কিস্তি / সপ্তাহ নং ${toBengaliDigits(rawNote)}`
            : 'সাপ্তাহিক মজুরি উত্তোলন',
          amount: receivedAmount,
          approvedBy: 'গার্মেন্টস কর্তৃপক্ষ',
          remarks: workName || 'কোম্পানি থেকে মজুরি উত্তোলন',
        });
      }
      return;
    }

    const pieces = Math.round(cleanNumber(row.Pcs ?? row.pieces));
    const dozensInput = cleanNumber(row.Dozen ?? row.dozens);
    const dozens = Number(
      (pieces > 0 ? calculateDozensFromPieces(pieces) : dozensInput).toFixed(2)
    );
    const ratePerDozen = Number(cleanNumber(row.Rate ?? row.ratePerDozen).toFixed(2));
    const earnedInput = cleanNumber(row.Earned ?? row.totalWage);
    const totalWage = Number(
      (earnedInput > 0
        ? earnedInput
        : calculateEarnedWageFromPiecesAndRate(pieces, ratePerDozen)
      ).toFixed(2)
    );

    const isPending =
      row.IsPending === true ||
      String(row.IsPending).toLowerCase() === 'true' ||
      /pending/i.test(String(row.Status || ''));

    const settlementStatus: SettlementStatus = isPending ? 'pending' : 'settled';
    const category = inferGarmentCategory(workName, rawNote);
    const sizes = extractSizesArray(row.Size ?? row.size);
    const rawColor = String(row.Color ?? row.color ?? '').trim();
    const colors =
      rawColor && rawColor !== '-'
        ? rawColor
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
        : [];

    const { cleanNote, workStatus, startWorkTime, endWorkTime } =
      extractWorkTimingFromNote(rawNote, rawDateStr);

    const photos: UploadedPhotoPreview[] = [];
    const base64Img = String(row.Image_Base64 || '').trim();
    const imgUrl = String(row.Image_URL || '').trim();
    if (base64Img && base64Img.startsWith('data:image')) {
      photos.push({
        id: `photo-${rawId}`,
        fileName: `${workName || 'পোশাক'}.jpg`,
        fileSize: base64Img.length,
        previewUrl: base64Img,
        mimeType: 'image/jpeg',
        storagePath: base64Img,
      });
    } else if (imgUrl && imgUrl.startsWith('http')) {
      photos.push({
        id: `photo-${rawId}`,
        fileName: `${workName || 'পোশাক'}.jpg`,
        fileSize: 0,
        previewUrl: imgUrl,
        mimeType: 'image/jpeg',
        storagePath: imgUrl,
      });
    }

    productionEntries.push({
      id: rawId,
      date: dateDDMMYYYY,
      itemName: workName || category,
      category,
      garmentType: `${workName || category} (${category})`,
      size: sizes.join(', '),
      sizes,
      color: colors.join(', '),
      colors,
      pieces,
      dozens,
      ratePerDozen,
      totalWage,
      receivedWage: settlementStatus === 'settled' ? totalWage : 0,
      pendingWage: settlementStatus === 'settled' ? 0 : totalWage,
      workStatus,
      settlementStatus,
      startWorkTime,
      endWorkTime,
      workDurationMinutes: null,
      shortDescription: cleanNote,
      photos,
    });
  });

  // Sort productionEntries and paymentWithdrawals newest first
  const sortByDateDesc = <T extends { date: string }>(arr: T[]): T[] => {
    return arr.slice().sort((a, b) => {
      const [dA, mA, yA] = toAsciiDigits(a.date).split('-').map(Number);
      const [dB, mB, yB] = toAsciiDigits(b.date).split('-').map(Number);
      const tA = new Date(yA || 2026, (mA || 1) - 1, dA || 1).getTime();
      const tB = new Date(yB || 2026, (mB || 1) - 1, dB || 1).getTime();
      return tB - tA;
    });
  };

  const sortedProduction = sortByDateDesc(productionEntries);
  const sortedWithdrawals = sortByDateDesc(paymentWithdrawals);

  // 2. Build Monthly Wage Ledger Records from Production & Withdrawals
  const monthlyMap = new Map<
    string,
    {
      year: number;
      month: number;
      pieces: number;
      dozens: number;
      earned: number;
      paid: number;
      startDate: string;
      endDate: string;
    }
  >();

  sortedProduction.forEach((p) => {
    const [d, m, y] = toAsciiDigits(p.date).split('-').map(Number);
    if (!y || !m) return;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const existing = monthlyMap.get(key) || {
      year: y,
      month: m,
      pieces: 0,
      dozens: 0,
      earned: 0,
      paid: 0,
      startDate: `01-${String(m).padStart(2, '0')}-${y}`,
      endDate: `${new Date(y, m, 0).getDate()}-${String(m).padStart(2, '0')}-${y}`,
    };
    existing.pieces += p.pieces ?? 0;
    existing.dozens = Number(
      (existing.dozens + (p.dozens ?? 0)).toFixed(2)
    );
    existing.earned = Number(
      (existing.earned + (p.totalWage ?? 0)).toFixed(2)
    );
    monthlyMap.set(key, existing);
  });

  sortedWithdrawals.forEach((w) => {
    const [d, m, y] = toAsciiDigits(w.date).split('-').map(Number);
    if (!y || !m) return;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const existing = monthlyMap.get(key) || {
      year: y,
      month: m,
      pieces: 0,
      dozens: 0,
      earned: 0,
      paid: 0,
      startDate: `01-${String(m).padStart(2, '0')}-${y}`,
      endDate: `${new Date(y, m, 0).getDate()}-${String(m).padStart(2, '0')}-${y}`,
    };
    existing.paid = Number((existing.paid + (w.amount ?? 0)).toFixed(2));
    monthlyMap.set(key, existing);
  });

  const wageRecords: WageLedgerRecord[] = Array.from(monthlyMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, item]) => {
      const monthNameBn =
        BENGALI_MONTH_NAMES[(item.month - 1) % 12] || 'মাস';
      const outstanding = Number(
        Math.max(0, item.earned - item.paid).toFixed(2)
      );
      return {
        id: `wage-${key}`,
        periodLabel: `${monthNameBn} ${toBengaliDigits(item.year)}`,
        startDate: item.startDate,
        endDate: item.endDate,
        lineNumber: 'মূল প্রোডাকশন লাইন',
        totalDozens: item.dozens,
        totalPieces: item.pieces,
        earnedWage: item.earned,
        paidWage: item.paid,
        outstandingWage: outstanding,
        statusLabel:
          outstanding <= 0
            ? 'নিষ্পত্তি হয়েছে'
            : item.paid > 0
            ? 'আংশিক নিষ্পত্তি'
            : 'রেট নিষ্পত্তি হয়নি',
      };
    });

  // 3. Parse "expense" & "income" arrays
  const rawExpenses = Array.isArray(raw.expense) ? raw.expense : [];
  rawExpenses.forEach((row, idx) => {
    const rawDateStr = String(row.Date || row.date || '').trim();
    const dateDDMMYYYY = normalizeToDDMMYYYY(rawDateStr) || rawDateStr;
    const amount = cleanNumber(row.Amount ?? row.amount);
    if (amount <= 0) return;
    const category = String(row.Category || row.category || 'পরিবার').trim();
    const rawNote =
      row.Note !== undefined && row.Note !== null ? String(row.Note).trim() : '';
    const description =
      /^\d+$/.test(rawNote)
        ? `${category} খরচ (কিস্তি/সপ্তাহ #${toBengaliDigits(rawNote)})`
        : rawNote || `${category} বাবদ খরচ`;

    incomeExpenseRecords.push({
      id: String(row.ID || `exp-${idx + 1}`),
      date: dateDDMMYYYY,
      transactionType: 'expense',
      category,
      paymentMethod: 'নগদ ক্যাশ (Cash)',
      amount,
      description,
    });
  });

  const rawIncomes = Array.isArray(raw.income) ? raw.income : [];
  rawIncomes.forEach((row, idx) => {
    const rawDateStr = String(row.Date || row.date || '').trim();
    const dateDDMMYYYY = normalizeToDDMMYYYY(rawDateStr) || rawDateStr;
    const amount = cleanNumber(row.Amount ?? row.amount);
    if (amount <= 0) return;
    const category = String(row.Category || row.category || 'অন্যান্য আয়').trim();
    const rawNote =
      row.Note !== undefined && row.Note !== null ? String(row.Note).trim() : '';

    incomeExpenseRecords.push({
      id: String(row.ID || `inc-${idx + 1}`),
      date: dateDDMMYYYY,
      transactionType: 'income',
      category,
      paymentMethod: 'নগদ ক্যাশ (Cash)',
      amount,
      description: rawNote || category,
    });
  });

  const sortedIncomeExpense = sortByDateDesc(incomeExpenseRecords);

  // 4. Parse "loan" array (Group by loan account / bKash Loan & preserve installment breakdown)
  const rawLoans = Array.isArray(raw.loan) ? raw.loan : [];
  if (rawLoans.length > 0) {
    let totalTaken = 0;
    let totalPaid = 0;
    let firstDate = '24-08-2026';
    let lastDate = '10-10-2026';
    const installmentNotes: string[] = [];

    rawLoans.forEach((row) => {
      const dt = normalizeToDDMMYYYY(String(row.Date || '')) || String(row.Date || '');
      const taken = cleanNumber(row['Loan Taken'] ?? row.Loan_Taken ?? row.principalAmount);
      const paid = cleanNumber(row['Loan Paid'] ?? row.Loan_Paid ?? row.settledAmount);
      const desc = String(row.Description || 'বিকাশ লোন').trim();

      if (taken > 0) {
        totalTaken += taken;
        firstDate = dt || firstDate;
      }
      if (paid > 0) {
        totalPaid += paid;
        lastDate = dt || lastDate;
        installmentNotes.push(`${toBengaliDigits(dt)}: ৳${toBengaliDigits(paid)} (${desc})`);
      }
    });

    if (totalTaken > 0 || totalPaid > 0) {
      const remaining = Math.max(0, Number((totalTaken - totalPaid).toFixed(2)));
      loanRecords.push({
        id: 'loan-bkash-summary',
        loanDirection: 'payable',
        counterpartyName: 'বিকাশ লোন (bKash Loan)',
        phone: 'বিকাশ অ্যাপ',
        issueDate: firstDate,
        dueDate: lastDate,
        principalAmount: totalTaken,
        settledAmount: totalPaid,
        remainingBalance: remaining,
        statusLabel: remaining <= 0 ? 'পরিশোধিত' : 'চলমান কিস্তি',
        notes: `মোট পরিশোধিত কিস্তি (${toBengaliDigits(
          installmentNotes.length
        )} টি): ${installmentNotes.join(' · ')}`,
      });
    }
  }

  // 5. Parse "fund" and "fund_transaction"
  const rawFunds = Array.isArray(raw.fund) ? raw.fund : [];
  const rawFundTxs = Array.isArray(raw.fund_transaction) ? raw.fund_transaction : [];

  const fundTxByFundId = new Map<
    string,
    {
      totalIn: number;
      totalOut: number;
      details: string[];
    }
  >();

  rawFundTxs.forEach((tx) => {
    const fundId = String(tx['Fund ID'] || tx.Fund_ID || '').trim();
    const txType = String(tx.Type || '').trim().toLowerCase();
    const amount = cleanNumber(tx.Amount);
    const catNote = String(tx['Category/Note'] || tx.Note || '').trim();
    const dt = normalizeToDDMMYYYY(String(tx.Date || '')) || String(tx.Date || '');

    const bucket = fundTxByFundId.get(fundId) || {
      totalIn: 0,
      totalOut: 0,
      details: [],
    };

    if (txType === 'in') {
      bucket.totalIn += amount;
      bucket.details.push(
        `জমা (${toBengaliDigits(dt)}): ৳${toBengaliDigits(amount)}${
          catNote ? ` [${catNote}]` : ''
        }`
      );
    } else {
      bucket.totalOut += amount;
      bucket.details.push(
        `খরচ (${toBengaliDigits(dt)}): ৳${toBengaliDigits(amount)}${
          catNote ? ` [${catNote}]` : ''
        }`
      );
    }
    fundTxByFundId.set(fundId, bucket);
  });

  const matchedFundIds = new Set<string>();

  rawFunds.forEach((f, idx) => {
    const fId = String(f.ID || `fund-${idx + 1}`).trim();
    matchedFundIds.add(fId);
    const fName = String(f['Fund Name'] || f.Fund_Name || 'তহবিল').trim();
    const openDate =
      normalizeToDDMMYYYY(String(f.Date || '')) || String(f.Date || '07-09-2026');
    const target = cleanNumber(f['Target Budget'] ?? f.Target_Budget);
    const status = String(f.Status || 'Active').trim();

    const txSummary = fundTxByFundId.get(fId) || {
      totalIn: 0,
      totalOut: 0,
      details: [],
    };
    const currentBalance = Number(
      (txSummary.totalIn - txSummary.totalOut).toFixed(2)
    );

    fundRecords.push({
      id: fId,
      fundName: fName,
      fundType: status === 'Completed' ? 'সম্পন্ন তহবিল' : 'চলমান চিকিৎসা ও জরুরি ফান্ড',
      openingDate: openDate,
      monthlyContribution: txSummary.totalIn,
      targetAmount: target > 0 ? target : txSummary.totalIn,
      currentBalance: Math.max(0, currentBalance),
      institutionOrMethod: `মোট জমা: ৳${toBengaliDigits(
        txSummary.totalIn
      )} · মোট খরচ: ৳${toBengaliDigits(txSummary.totalOut)}`,
      notes: txSummary.details.join(' | '),
    });
  });

  // Also include any orphan fund_transaction groups (such as TRX-5843)
  fundTxByFundId.forEach((txSummary, fundId) => {
    if (!matchedFundIds.has(fundId)) {
      const currentBalance = Math.max(
        0,
        Number((txSummary.totalIn - txSummary.totalOut).toFixed(2))
      );
      fundRecords.push({
        id: fundId || `fund-extra-${Date.now()}`,
        fundName: `অতিরিক্ত ফান্ড লেনদেন (${fundId})`,
        fundType: 'জরুরি যাতায়াত ও ফান্ড খরচ',
        openingDate: '21-10-2026',
        monthlyContribution: txSummary.totalIn,
        targetAmount: txSummary.totalOut,
        currentBalance,
        institutionOrMethod: `মোট জমা: ৳${toBengaliDigits(
          txSummary.totalIn
        )} · মোট খরচ: ৳${toBengaliDigits(txSummary.totalOut)}`,
        notes: txSummary.details.join(' | '),
      });
    }
  });

  return {
    state: {
      productionEntries: sortedProduction,
      wageRecords,
      paymentWithdrawals: sortedWithdrawals,
      loanRecords,
      fundRecords,
      incomeExpenseRecords: sortedIncomeExpense,
    },
    summary: {
      productionCount: sortedProduction.length,
      withdrawalCount: sortedWithdrawals.length,
      expenseCount: rawExpenses.length,
      incomeCount: rawIncomes.length,
      loanCount: rawLoans.length,
      fundCount: fundRecords.length,
      fundTxCount: rawFundTxs.length,
    },
  };
}

/**
 * Converts a multi-sheet Excel Workbook (such as `Ay bay.xlsx` with tabs
 * `Production`, `Expense`, `Income`, `Loan`, `Fund`, `Fund_Transaction`)
 * into `RawSmartHisabBackupJson`.
 */
export function convertExcelWorkbookToBackupJson(
  workbook: XLSX.WorkBook
): RawSmartHisabBackupJson {
  const result: RawSmartHisabBackupJson = {
    income: [],
    expense: [],
    production: [],
    loan: [],
    fund: [],
    fund_transaction: [],
  };

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      raw: false,
      defval: '',
    });
    if (!rows || rows.length === 0) continue;

    const cleanTab = sheetName.trim().toLowerCase();
    const firstRowKeys = Object.keys(rows[0] || {})
      .map((k) => k.toLowerCase())
      .join(' ');

    if (
      cleanTab.includes('fund_transaction') ||
      cleanTab.includes('fund transaction') ||
      firstRowKeys.includes('fund id')
    ) {
      result.fund_transaction = [...(result.fund_transaction || []), ...rows];
    } else if (
      cleanTab === 'fund' ||
      cleanTab === 'funds' ||
      cleanTab.includes('ফান্ড') ||
      firstRowKeys.includes('fund name') ||
      firstRowKeys.includes('target budget')
    ) {
      result.fund = [...(result.fund || []), ...rows];
    } else if (
      cleanTab.includes('loan') ||
      cleanTab.includes('ঋণ') ||
      firstRowKeys.includes('loan taken') ||
      firstRowKeys.includes('loan paid')
    ) {
      result.loan = [...(result.loan || []), ...rows];
    } else if (
      cleanTab.includes('production') ||
      cleanTab.includes('প্রোডাকশন') ||
      firstRowKeys.includes('work name') ||
      firstRowKeys.includes('dozen') ||
      firstRowKeys.includes('pcs')
    ) {
      result.production = [...(result.production || []), ...rows];
    } else if (
      cleanTab.includes('expense') ||
      cleanTab.includes('ব্যয়') ||
      cleanTab.includes('খরচ')
    ) {
      result.expense = [...(result.expense || []), ...rows];
    } else if (cleanTab.includes('income') || cleanTab.includes('আয়')) {
      result.income = [...(result.income || []), ...rows];
    }
  }

  return result;
}

/**
 * Fetches the user's attached backup file `/assets/aistudio/SmartHisab_Backup_2026-11-06_c15212d6.json`
 * and parses it into the complete ApplicationRepositoryState.
 */
export async function fetchAndParseAttachedUserBackup(): Promise<{
  state: ApplicationRepositoryState;
  summary: FullBackupImportSummary;
} | null> {
  try {
    const response = await fetch(
      '/assets/aistudio/SmartHisab_Backup_2026-11-06_c15212d6.json'
    );
    if (!response.ok) return null;
    const rawJson = (await response.json()) as RawSmartHisabBackupJson;
    return parseSmartHisabBackupData(rawJson);
  } catch {
    return null;
  }
}
