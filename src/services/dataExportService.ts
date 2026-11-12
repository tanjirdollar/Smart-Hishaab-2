import * as XLSX from 'xlsx';
import { ApplicationRepositoryState } from './financialDomainService';
import { ProductionEntry } from '../types/models';
import { formatTaka, toAsciiDigits } from '../utils/formatters';

function getTodayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports full application state as a clean Smart Hisab JSON backup file.
 */
export function exportStateToJsonBackup(repo: ApplicationRepositoryState): void {
  const dateStr = getTodayIsoDate();
  const filename = `SmartHisab_Backup_${dateStr}.json`;

  const backupData = {
    appName: 'Smart Hisab',
    version: '2.0',
    exportDate: dateStr,
    production: [
      // 1. Work entries
      ...repo.productionEntries.map((e) => ({
        ID: e.id,
        Date: e.date,
        'Work Name': e.itemName || e.garmentType,
        Type: 'Work',
        Pcs: e.pieces ?? 0,
        Dozen: e.dozens ?? 0,
        Rate: e.ratePerDozen ?? 0,
        Earned: e.totalWage ?? 0,
        Received: e.receivedWage ?? 0,
        Size: e.size || '',
        Color: e.color || '',
        Category: e.category || '',
        WorkStatus: e.workStatus,
        IsPending: e.settlementStatus === 'pending',
        StartTime: e.startWorkTime || '',
        EndTime: e.endWorkTime || '',
        DurationMinutes: e.workDurationMinutes || 0,
        Note: e.shortDescription || '',
        Image_URL: e.photos?.[0]?.previewUrl || e.photos?.[0]?.storagePath || '',
      })),
      // 2. Withdrawal entries
      ...repo.paymentWithdrawals.map((w) => ({
        ID: w.id,
        Date: w.date,
        'Work Name': w.remarks || w.weekReference || 'বিল উত্তোলন',
        Type: 'Withdrawal',
        Pcs: 0,
        Dozen: 0,
        Rate: 0,
        Earned: 0,
        Received: w.amount ?? 0,
        Amount: w.amount ?? 0,
        PaymentMethod: w.paymentMethod,
        WeekRef: w.weekReference,
        Note: w.remarks || '',
      })),
    ],
    expense: repo.incomeExpenseRecords
      .filter((tx) => tx.transactionType === 'expense')
      .map((tx) => ({
        ID: tx.id,
        Date: tx.date,
        Category: tx.category,
        Amount: tx.amount ?? 0,
        PaymentMethod: tx.paymentMethod,
        Note: tx.description,
      })),
    income: repo.incomeExpenseRecords
      .filter((tx) => tx.transactionType === 'income')
      .map((tx) => ({
        ID: tx.id,
        Date: tx.date,
        Category: tx.category,
        Amount: tx.amount ?? 0,
        PaymentMethod: tx.paymentMethod,
        Note: tx.description,
      })),
    loan: repo.loanRecords.map((l) => ({
      ID: l.id,
      Date: l.issueDate,
      Counterparty: l.counterpartyName,
      Direction: l.loanDirection,
      'Loan Taken': l.principalAmount ?? 0,
      'Loan Paid': l.settledAmount ?? 0,
      Remaining: l.remainingBalance ?? 0,
      Description: l.notes,
      Status: l.statusLabel,
    })),
    fund: repo.fundRecords.map((f) => ({
      ID: f.id,
      Date: f.openingDate,
      'Fund Name': f.fundName,
      'Target Budget': f.targetAmount ?? 0,
      'Current Balance': f.currentBalance ?? 0,
      FundType: f.fundType,
      Note: f.notes,
    })),
    withdrawals: repo.paymentWithdrawals.map((w) => ({
      ID: w.id,
      Date: w.date,
      Amount: w.amount ?? 0,
      PaymentMethod: w.paymentMethod,
      WeekReference: w.weekReference,
      Remarks: w.remarks,
    })),
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  triggerDownload(blob, filename);
}

/**
 * Exports full application data to a multi-sheet Microsoft Excel (.xlsx) workbook
 * for analysis in Excel, Google Sheets, or data tools.
 */
export function exportStateToExcelWorkbook(repo: ApplicationRepositoryState): void {
  const dateStr = getTodayIsoDate();
  const filename = `SmartHisab_Analysis_${dateStr}.xlsx`;
  const wb = XLSX.utils.book_new();

  // 1. Production Sheet
  const prodRows = repo.productionEntries.map((e, idx) => ({
    ক্রমিক: idx + 1,
    তারিখ: e.date,
    'আইটেমের নাম': e.itemName || e.garmentType,
    ক্যাটাগরি: e.category,
    সাইজ: e.size,
    রঙ: e.color,
    'পিস সংখ্যা': e.pieces ?? 0,
    'ডজন সংখ্যা': e.dozens ?? 0,
    'প্রতি ডজন দর (৳)': e.ratePerDozen ?? 0,
    'মোট অর্জিত মজুরি (৳)': e.totalWage ?? 0,
    'কাজের অবস্থা': e.workStatus === 'completed' ? 'কাজ সম্পন্ন' : 'কাজ চলছে',
    'রেট নিষ্পত্তি': e.settlementStatus === 'settled' ? 'নিষ্পত্তি হয়েছে' : 'রেট নিষ্পত্তি হয়নি',
    'শুরুর সময়': e.startWorkTime || '',
    'শেষের সময়': e.endWorkTime || '',
    'কাজের সময়কাল (মিনিট)': e.workDurationMinutes ?? '',
    মন্তব্য: e.shortDescription,
  }));
  const wsProd = XLSX.utils.json_to_sheet(prodRows);
  XLSX.utils.book_append_sheet(wb, wsProd, 'প্রোডাকশন_হিসাব');

  // 2. Bill Withdrawals Sheet
  const wdRows = repo.paymentWithdrawals.map((w, idx) => ({
    ক্রমিক: idx + 1,
    তারিখ: w.date,
    'উত্তোলিত টাকা (৳)': w.amount ?? 0,
    'পেমেন্ট মাধ্যম': w.paymentMethod,
    'কিস্তি / সপ্তাহ নং': w.weekReference,
    'ভাউচার নং': w.voucherNo,
    মন্তব্য: w.remarks,
  }));
  const wsWd = XLSX.utils.json_to_sheet(wdRows);
  XLSX.utils.book_append_sheet(wb, wsWd, 'কোম্পানি_বিল_উত্তোলন');

  // 3. Personal Income & Expenses Sheet
  const txRows = repo.incomeExpenseRecords.map((tx, idx) => ({
    ক্রমিক: idx + 1,
    তারিখ: tx.date,
    ধরন: tx.transactionType === 'expense' ? 'ব্যয় (খরচ)' : 'আয় (জমা)',
    খাত: tx.category,
    'টাকার পরিমাণ (৳)': tx.amount ?? 0,
    'পেমেন্ট মাধ্যম': tx.paymentMethod,
    বিবরণ: tx.description,
  }));
  const wsTx = XLSX.utils.json_to_sheet(txRows);
  XLSX.utils.book_append_sheet(wb, wsTx, 'ব্যক্তিগত_আয়_ব্যয়');

  // 4. Loans Sheet
  const loanRows = repo.loanRecords.map((l, idx) => ({
    ক্রমিক: idx + 1,
    তারিখ: l.issueDate,
    'ব্যক্তি / প্রতিষ্ঠান': l.counterpartyName,
    'লোনের ধরন': l.loanDirection === 'payable' ? 'দেনা (পরিশোধযোগ্য)' : 'পাওনা (আদায়যোগ্য)',
    'মূল লোন (৳)': l.principalAmount ?? 0,
    'পরিশোধিত টাকা (৳)': l.settledAmount ?? 0,
    'বর্তমান বাকি (৳)': l.remainingBalance ?? 0,
    স্ট্যাটাস: l.statusLabel,
    নোট: l.notes,
  }));
  const wsLoan = XLSX.utils.json_to_sheet(loanRows);
  XLSX.utils.book_append_sheet(wb, wsLoan, 'লোন_হিসাব');

  // 5. Funds Sheet
  const fundRows = repo.fundRecords.map((f, idx) => ({
    ক্রমিক: idx + 1,
    'ফান্ডের নাম': f.fundName,
    'ফান্ডের ধরন': f.fundType,
    'শুরুর তারিখ': f.openingDate,
    'বর্তমান ব্যালেন্স (৳)': f.currentBalance ?? 0,
    'লক্ষ্যমাত্রা (৳)': f.targetAmount ?? 0,
    বিবরণ: f.notes,
  }));
  const wsFund = XLSX.utils.json_to_sheet(fundRows);
  XLSX.utils.book_append_sheet(wb, wsFund, 'ফান্ড_সঞ্চয়');

  // Write and trigger download
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, filename);
}

/**
 * Exports production entries to CSV
 */
export function exportProductionEntriesToCsv(entries: ProductionEntry[]): void {
  const dateStr = getTodayIsoDate();
  const filename = `SmartHisab_Production_${dateStr}.csv`;

  const headers = [
    'Date',
    'Item Name',
    'Category',
    'Size',
    'Pieces',
    'Dozens',
    'Rate Per Dozen',
    'Total Wage (BDT)',
    'Work Status',
    'Settlement Status',
    'Start Time',
    'End Time',
    'Notes',
  ];

  const rows = entries.map((e) => [
    `"${e.date}"`,
    `"${(e.itemName || e.garmentType || '').replace(/"/g, '""')}"`,
    `"${e.category || ''}"`,
    `"${e.size || ''}"`,
    e.pieces ?? 0,
    e.dozens ?? 0,
    e.ratePerDozen ?? 0,
    e.totalWage ?? 0,
    `"${e.workStatus}"`,
    `"${e.settlementStatus}"`,
    `"${e.startWorkTime || ''}"`,
    `"${e.endWorkTime || ''}"`,
    `"${(e.shortDescription || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, filename);
}
