import * as XLSX from 'xlsx';
import { ApplicationRepositoryState } from './financialDomainService';
import { ProductionEntry } from '../types/models';
import { formatTaka, toAsciiDigits } from '../utils/formatters';

const LAST_BACKUP_TIMESTAMP_KEY = 'smart_hisab_last_backup_at_v1';

export function recordLastBackupTimestamp(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_BACKUP_TIMESTAMP_KEY, new Date().toISOString());
    window.dispatchEvent(new CustomEvent('smart-hisab-backup-recorded'));
  } catch {
    // ignore storage errors
  }
}

export function getLastBackupInfo(): {
  iso: string | null;
  daysAgo: number | null;
  labelBn: string;
  needsBackupReminder: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      iso: null,
      daysAgo: null,
      labelBn: 'এখনও ব্যাকআপ নেওয়া হয়নি',
      needsBackupReminder: true,
    };
  }
  try {
    const raw = localStorage.getItem(LAST_BACKUP_TIMESTAMP_KEY);
    if (!raw) {
      return {
        iso: null,
        daysAgo: null,
        labelBn: 'এখনও কোনো অফলাইন ব্যাকআপ নেওয়া হয়নি',
        needsBackupReminder: true,
      };
    }
    const ts = new Date(raw).getTime();
    if (Number.isNaN(ts)) {
      return {
        iso: null,
        daysAgo: null,
        labelBn: 'এখনও কোনো অফলাইন ব্যাকআপ নেওয়া হয়নি',
        needsBackupReminder: true,
      };
    }
    const diffDays = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    const formattedDate = new Intl.DateTimeFormat('bn-BD', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));

    return {
      iso: raw,
      daysAgo: diffDays,
      labelBn: `সর্বশেষ ব্যাকআপ: ${formattedDate}`,
      needsBackupReminder: diffDays >= 7,
    };
  } catch {
    return {
      iso: null,
      daysAgo: null,
      labelBn: 'এখনও ব্যাকআপ নেওয়া হয়নি',
      needsBackupReminder: true,
    };
  }
}

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

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildJsonBackupBlob(repo: ApplicationRepositoryState): {
  blob: Blob;
  filename: string;
} {
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
        CountdownDurationMinutes: e.countdownDurationMinutes ?? null,
        CountdownStartedAt: e.countdownStartedAt || '',
        DeadlineAt: e.deadlineAt || '',
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
  return { blob, filename };
}

/**
 * Exports full application state as a clean Smart Hisab JSON backup file.
 */
export function exportStateToJsonBackup(repo: ApplicationRepositoryState): void {
  const { blob, filename } = buildJsonBackupBlob(repo);
  triggerDownload(blob, filename);
  recordLastBackupTimestamp();
}

/**
 * Shares the JSON backup directly via the mobile OS share sheet (Google Drive, WhatsApp, Telegram, Gmail).
 * Falls back cleanly to normal file download if Web Share with files is unavailable.
 */
export async function shareJsonBackupFile(
  repo: ApplicationRepositoryState
): Promise<{ shared: boolean; messageBn: string }> {
  const { blob, filename } = buildJsonBackupBlob(repo);
  try {
    const file = new File([blob], filename, { type: 'application/json' });
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        title: 'স্মার্ট হিসাব (Smart Hisab) পূর্ণাঙ্গ ব্যাকআপ',
        text: `স্মার্ট হিসাব ব্যাকআপ ফাইল (${getTodayIsoDate()}) — নিরাপদে Google Drive বা নিজের WhatsApp/Gmail-এ সংরক্ষণ করুন।`,
        files: [file],
      });
      recordLastBackupTimestamp();
      return {
        shared: true,
        messageBn: 'ব্যাকআপ ফাইল শেয়ার সম্পন্ন হয়েছে!',
      };
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { shared: false, messageBn: 'শেয়ার বাতিল করা হয়েছে।' };
    }
  }

  triggerDownload(blob, filename);
  recordLastBackupTimestamp();
  return {
    shared: false,
    messageBn:
      'ব্যাকআপ ফাইল ডাউনলোড হয়েছে! এখন ফোনের Downloads ফোল্ডার থেকে ফাইলটি Google Drive-এ আপলোড করে রাখুন।',
  };
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
  recordLastBackupTimestamp();
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
  recordLastBackupTimestamp();
}

/**
 * Exports a self-contained offline-readable HTML report that opens in any browser
 * without internet, Excel, or access to the web app.
 */
export function exportOfflineReadableHtmlReport(
  repo: ApplicationRepositoryState
): void {
  const dateStr = getTodayIsoDate();
  const filename = `SmartHisab_Offline_Report_${dateStr}.html`;

  const totalEarned = repo.productionEntries.reduce(
    (sum, e) => sum + Number(e.totalWage ?? 0),
    0
  );
  const totalWithdrawn = repo.paymentWithdrawals.reduce(
    (sum, w) => sum + Number(w.amount ?? 0),
    0
  );
  const totalDue = Math.max(0, totalEarned - totalWithdrawn);
  const totalPieces = repo.productionEntries.reduce(
    (sum, e) => sum + Number(e.pieces ?? 0),
    0
  );

  const prodRowsHtml = repo.productionEntries
    .map(
      (e, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(e.date)}</td>
        <td><strong>${escapeHtml(e.itemName || e.garmentType)}</strong><br/><small>${escapeHtml(e.category)} ${e.size ? '· সাইজ: ' + escapeHtml(e.size) : ''}</small></td>
        <td>${escapeHtml(e.pieces ?? 0)} পিস (${escapeHtml(Number(e.dozens ?? 0).toFixed(2))} ডজন)</td>
        <td>${escapeHtml(formatTaka(e.ratePerDozen ?? 0))}</td>
        <td><strong>${escapeHtml(formatTaka(e.totalWage ?? 0))}</strong></td>
        <td>${e.settlementStatus === 'settled' ? 'নিষ্পত্তি হয়েছে' : 'বাকি / নিষ্পত্তি হয়নি'}</td>
      </tr>`
    )
    .join('');

  const wdRowsHtml = repo.paymentWithdrawals
    .map(
      (w, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(w.date)}</td>
        <td><strong>${escapeHtml(formatTaka(w.amount ?? 0))}</strong></td>
        <td>${escapeHtml(w.paymentMethod)}</td>
        <td>${escapeHtml(w.remarks || w.weekReference)}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>স্মার্ট হিসাব — অফলাইন পূর্ণাঙ্গ রিপোর্ট (${escapeHtml(dateStr)})</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #f8fafc; color: #0f172a; }
    .container { max-width: 980px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
    h1 { margin: 0 0 4px; color: #0f766e; font-size: 22px; }
    .sub { color: #64748b; font-size: 13px; margin-bottom: 18px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .card { background: #f1f5f9; border-radius: 12px; padding: 12px 14px; }
    .card span { display: block; font-size: 12px; color: #475569; }
    .card strong { font-size: 18px; color: #0f172a; }
    h2 { font-size: 16px; margin: 24px 0 10px; border-bottom: 2px solid #0f766e; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f0fdfa; color: #115e59; }
    small { color: #64748b; }
    @media print { body { background: #fff; padding: 0; } .container { border: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>স্মার্ট হিসাব (Smart Hisab) — অফলাইন ব্যাকআপ রিপোর্ট</h1>
    <div class="sub">রিপোর্ট তৈরির তারিখ: ${escapeHtml(dateStr)} · ইন্টারনেট বা অ্যাপ ছাড়াই যেকোনো ব্রাউজারে পড়ার ও প্রিন্ট করার উপযোগী</div>
    <div class="cards">
      <div class="card"><span>মোট প্রোডাকশন</span><strong>${escapeHtml(repo.productionEntries.length)} টি (${escapeHtml(totalPieces)} পিস)</strong></div>
      <div class="card"><span>মোট অর্জিত মজুরি</span><strong>${escapeHtml(formatTaka(totalEarned))}</strong></div>
      <div class="card"><span>মোট বিল উত্তোলন</span><strong>${escapeHtml(formatTaka(totalWithdrawn))}</strong></div>
      <div class="card"><span>কোম্পানির কাছে পাওনা</span><strong>${escapeHtml(formatTaka(totalDue))}</strong></div>
    </div>

    <h2>১. প্রোডাকশন খতিয়ান (${escapeHtml(repo.productionEntries.length)} টি)</h2>
    <table>
      <thead>
        <tr><th>#</th><th>তারিখ</th><th>আইটেম</th><th>পরিমাণ</th><th>দর/ডজন</th><th>মোট মজুরি</th><th>অবস্থা</th></tr>
      </thead>
      <tbody>${prodRowsHtml || '<tr><td colspan="7">কোনো এন্ট্রি নেই</td></tr>'}</tbody>
    </table>

    <h2>২. কোম্পানি বিল উত্তোলন (${escapeHtml(repo.paymentWithdrawals.length)} টি)</h2>
    <table>
      <thead>
        <tr><th>#</th><th>তারিখ</th><th>টাকা</th><th>মাধ্যম</th><th>মন্তব্য</th></tr>
      </thead>
      <tbody>${wdRowsHtml || '<tr><td colspan="5">কোনো উত্তোলন নেই</td></tr>'}</tbody>
    </table>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, filename);
  recordLastBackupTimestamp();
}
