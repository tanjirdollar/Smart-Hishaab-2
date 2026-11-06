import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Layers,
  Link2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import {
  convertExcelWorkbookToBackupJson,
  fetchAndParseAttachedUserBackup,
  FullBackupImportSummary,
  parseSmartHisabBackupData,
  RawSmartHisabBackupJson,
} from '../services/backupImportService';
import { ApplicationRepositoryState } from '../services/financialDomainService';
import {
  ImportFieldKey,
  ModuleId,
  ProductionEntry,
  SettlementStatus,
  ValidatedImportRow,
  WorkStatus,
} from '../types/models';
import {
  calculateDozensFromPieces,
  calculateDurationMinutes,
  calculateEarnedWageFromPiecesAndRate,
  formatDateDDMMYYYY,
  formatDozensBn,
  formatTaka,
  normalizeToDDMMYYYY,
  toAsciiDigits,
  toBengaliDigits,
} from '../utils/formatters';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/ui/SummaryCard';

export interface ImportDataPageProps {
  existingEntries: ProductionEntry[];
  onBatchImportEntries: (
    entries: ProductionEntry[],
    batchId: string
  ) => Promise<{
    importedCount: number;
    persistedToCloud: boolean;
    errorBn: string | null;
  }>;
  onRollbackImportBatch: (batchId: string) => Promise<{ errorBn: string | null }>;
  onImportFullRepositoryState?: (
    state: ApplicationRepositoryState
  ) => Promise<{ persistedToCloud: boolean; errorBn: string | null }>;
  onNavigate: (module: ModuleId) => void;
}

interface ParsedWorksheetTab {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
}

interface FieldMappingMeta {
  key: ImportFieldKey;
  labelBn: string;
  required?: boolean;
  aliases: string[];
}

const IMPORT_FIELD_DEFINITIONS: FieldMappingMeta[] = [
  {
    key: 'date',
    labelBn: '১. প্রোডাকশন তারিখ (Production Date)',
    required: true,
    aliases: ['date', 'production date', 'entry_date', 'তারিখ', 'প্রোডাকশন তারিখ'],
  },
  {
    key: 'itemName',
    labelBn: '২. আইটেমের নাম (Item Name)',
    required: true,
    aliases: [
      'work name',
      'work_name',
      'item name',
      'item',
      'item_name',
      'garment',
      'garment type',
      'style',
      'আইটেম',
      'আইটেমের নাম',
      'কাজের নাম',
      'পোশাকের ধরন',
      'পোশাক',
    ],
  },
  {
    key: 'category',
    labelBn: '৩. ক্যাটাগরি (Category)',
    aliases: ['category', 'type', 'department', 'ক্যাটাগরি', 'ধরন'],
  },
  {
    key: 'size',
    labelBn: '৪. সাইজ (Size)',
    aliases: ['size', 'sizes', 'সাইজ', 'মাপ'],
  },
  {
    key: 'color',
    labelBn: '৫. রঙ (Color)',
    aliases: ['color', 'colour', 'colors', 'রঙ', 'কালার'],
  },
  {
    key: 'pieces',
    labelBn: '৬. পিস সংখ্যা (Quantity in Pieces)',
    aliases: ['pieces', 'qty', 'quantity', 'pcs', 'piece', 'পিস', 'পিস সংখ্যা', 'পরিমাণ'],
  },
  {
    key: 'dozens',
    labelBn: '৭. ডজন সংখ্যা (Quantity in Dozens)',
    aliases: ['dozens', 'dozen', 'dzn', 'ডজন', 'ডজন সংখ্যা'],
  },
  {
    key: 'ratePerDozen',
    labelBn: '৮. প্রতি ডজনের দর (Rate per Dozen)',
    aliases: ['rate', 'rate per dozen', 'rate_per_dozen', 'price', 'দর', 'প্রতি ডজনের দর'],
  },
  {
    key: 'totalWage',
    labelBn: '৯. অর্জিত মজুরি (Earned Wage)',
    aliases: [
      'earned',
      'earned wage',
      'total wage',
      'total_wage',
      'wage',
      'amount',
      'মোট মজুরি',
      'অর্জিত মজুরি',
      'মজুরি',
    ],
  },
  {
    key: 'startWorkTime',
    labelBn: '১০. কাজ শুরুর সময় (Start Work Time)',
    aliases: ['start work time', 'start_work_time', 'start time', 'কাজ শুরুর সময়', 'শুরু'],
  },
  {
    key: 'endWorkTime',
    labelBn: '১১. কাজ শেষের সময় (End Work Time)',
    aliases: ['end work time', 'end_work_time', 'end time', 'কাজ শেষের সময়', 'শেষ'],
  },
  {
    key: 'workStatus',
    labelBn: '১২. কাজের অবস্থা (Work Status)',
    aliases: ['work status', 'work_status', 'status', 'কাজের অবস্থা'],
  },
  {
    key: 'settlementStatus',
    labelBn: '১৩. রেট নিষ্পত্তি স্ট্যাটাস (Rate Settlement Status)',
    aliases: [
      'settlement status',
      'settlement_status',
      'rate settlement',
      'payment status',
      'রেট নিষ্পত্তি স্ট্যাটাস',
      'রেট নিষ্পত্তি',
      'পরিশোধ স্ট্যাটাস',
    ],
  },
  {
    key: 'shortDescription',
    labelBn: '১৪. নোট / সংক্ষিপ্ত বিবরণ (Notes)',
    aliases: ['notes', 'note', 'description', 'short_description', 'remarks', 'নোট', 'বিবরণ', 'মন্তব্য'],
  },
];

interface ImportBatchResult {
  batchId: string;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  persistedToCloud: boolean;
  errorDetailsBn: string[];
}

export const ImportDataPage: React.FC<ImportDataPageProps> = ({
  existingEntries,
  onBatchImportEntries,
  onRollbackImportBatch,
  onImportFullRepositoryState,
  onNavigate,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [googleSheetUrl, setGoogleSheetUrl] = useState<string>('');
  const [isLoadingSheet, setIsLoadingSheet] = useState<boolean>(false);
  const [parseErrorBn, setParseErrorBn] = useState<string | null>(null);

  const [availableSheets, setAvailableSheets] = useState<ParsedWorksheetTab[]>([]);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [showAllPreviewRows, setShowAllPreviewRows] = useState<boolean>(false);
  const [detectedFullBackup, setDetectedFullBackup] = useState<{
    state: ApplicationRepositoryState;
    summary: FullBackupImportSummary;
  } | null>(null);
  const [isImportingFullBackup, setIsImportingFullBackup] = useState<boolean>(false);
  const [fullBackupSuccessBanner, setFullBackupSuccessBanner] = useState<{
    summary: FullBackupImportSummary;
    persistedToCloud: boolean;
  } | null>(null);

  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<ImportFieldKey, string>>(
    () => ({
      date: '',
      itemName: '',
      category: '',
      size: '',
      color: '',
      pieces: '',
      dozens: '',
      ratePerDozen: '',
      totalWage: '',
      receivedWage: '',
      pendingWage: '',
      startWorkTime: '',
      endWorkTime: '',
      workStatus: '',
      settlementStatus: '',
      shortDescription: '',
    })
  );

  const [validatedRows, setValidatedRows] = useState<ValidatedImportRow[]>([]);
  const [autoRecalculateWages, setAutoRecalculateWages] = useState<boolean>(true);
  const [confirmedByOperator, setConfirmedByOperator] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<ImportBatchResult | null>(null);
  const [rollbackNoticeBn, setRollbackNoticeBn] = useState<string | null>(null);

  // Auto-detect column mapping when headers load
  const autoMapHeaders = (headers: string[], firstRowSample?: Record<string, string>) => {
    const nextMap: Record<ImportFieldKey, string> = {
      date: '',
      itemName: '',
      category: '',
      size: '',
      color: '',
      pieces: '',
      dozens: '',
      ratePerDozen: '',
      totalWage: '',
      receivedWage: '',
      pendingWage: '',
      startWorkTime: '',
      endWorkTime: '',
      workStatus: '',
      settlementStatus: '',
      shortDescription: '',
    };

    IMPORT_FIELD_DEFINITIONS.forEach((fieldDef) => {
      const matched = headers.find((h) => {
        const cleanH = h.trim().toLowerCase();
        return fieldDef.aliases.some(
          (alias) => cleanH === alias.toLowerCase() || cleanH.includes(alias.toLowerCase())
        );
      });
      if (matched) {
        nextMap[fieldDef.key] = matched;
      }
    });

    // If headers were auto-generated (কলাম_1, কলাম_2, ...) try inferring date and item columns from first row values
    if (firstRowSample && !nextMap.date) {
      for (const h of headers) {
        const sampleVal = (firstRowSample[h] || '').trim();
        if (!nextMap.date && normalizeToDDMMYYYY(sampleVal)) {
          nextMap.date = h;
        } else if (
          !nextMap.itemName &&
          sampleVal &&
          isNaN(Number(toAsciiDigits(sampleVal))) &&
          !normalizeToDDMMYYYY(sampleVal)
        ) {
          nextMap.itemName = h;
        }
      }
    }

    setColumnMapping(nextMap);
  };

  const extractSingleSheetTab = (
    ws: XLSX.WorkSheet,
    sheetName: string
  ): ParsedWorksheetTab | null => {
    const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: false,
      defval: '',
    });
    const cleanedRows = (rawMatrix || [])
      .map((row) =>
        Array.isArray(row) ? row.map((c) => String(c ?? '').trim()) : []
      )
      .filter((row) => row.some((cell) => cell !== ''));

    if (cleanedRows.length === 0) return null;

    let headerRowIndex = 0;
    while (
      headerRowIndex < cleanedRows.length - 1 &&
      cleanedRows[headerRowIndex].filter((c) => c !== '').length <= 1 &&
      cleanedRows[headerRowIndex + 1].filter((c) => c !== '').length >= 2
    ) {
      headerRowIndex++;
    }

    const candidateHeaderRow = cleanedRows[headerRowIndex];
    const remainingRows = cleanedRows.slice(headerRowIndex + 1);

    const firstRowHasDate = candidateHeaderRow.some(
      (cell) => normalizeToDDMMYYYY(cell) !== null
    );

    let headers: string[] = [];
    let rawDataMatrix: string[][] = [];

    if (remainingRows.length === 0 || firstRowHasDate) {
      const maxCols = Math.max(...cleanedRows.map((r) => r.length), 1);
      headers = Array.from({ length: maxCols }, (_, i) => `কলাম_${i + 1}`);
      rawDataMatrix = cleanedRows.slice(headerRowIndex);
    } else {
      const maxCols = Math.max(
        candidateHeaderRow.length,
        ...remainingRows.map((r) => r.length)
      );
      const seenHeaders = new Set<string>();
      headers = Array.from({ length: maxCols }, (_, i) => {
        const rawH = (candidateHeaderRow[i] || '').trim() || `কলাম_${i + 1}`;
        if (seenHeaders.has(rawH)) {
          return `${rawH}_${i + 1}`;
        }
        seenHeaders.add(rawH);
        return rawH;
      });
      rawDataMatrix = remainingRows;
    }

    const dataRows: Record<string, string>[] = [];
    for (const rowArr of rawDataMatrix) {
      if (!rowArr || rowArr.every((cell) => String(cell ?? '').trim() === '')) {
        continue;
      }
      const rowObj: Record<string, string> = {};
      headers.forEach((colName, cIdx) => {
        rowObj[colName] = String(rowArr[cIdx] ?? '').trim();
      });
      dataRows.push(rowObj);
    }

    if (dataRows.length === 0) return null;
    return { sheetName, headers, rows: dataRows };
  };

  const selectSheetTab = (tab: ParsedWorksheetTab, baseFileName?: string) => {
    setActiveSheetName(tab.sheetName);
    setSheetHeaders(tab.headers);
    setRawRows(tab.rows);
    setShowAllPreviewRows(false);
    if (baseFileName) {
      setUploadedFileName(
        availableSheets.length > 1
          ? `${baseFileName} (${tab.sheetName})`
          : baseFileName
      );
    }
    autoMapHeaders(tab.headers, tab.rows[0]);
  };

  const processWorkbook = (workbook: XLSX.WorkBook, sourceLabel: string) => {
    setParseErrorBn(null);
    setDetectedFullBackup(null);
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      setParseErrorBn('ফাইলে কোনো বৈধ ওয়ার্কশিট পাওয়া যায়নি।');
      return;
    }

    // Extract ALL non-empty worksheets so the user can view/switch between every tab
    const parsedTabs: ParsedWorksheetTab[] = [];
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      if (!ws) continue;
      const tab = extractSingleSheetTab(ws, sheetName);
      if (tab) {
        parsedTabs.push(tab);
      }
    }

    if (parsedTabs.length === 0) {
      setParseErrorBn(
        'স্প্রেডশিট ফাইলটি সম্পূর্ণ খালি। অনুগ্রহ করে ডেটাযুক্ত ফাইল নির্বাচন করুন।'
      );
      return;
    }

    setAvailableSheets(parsedTabs);

    // Check if this workbook is a multi-sheet SmartHisab workbook (Production, Expense, Loan, Fund, Fund_Transaction)
    const rawBackupFromWorkbook = convertExcelWorkbookToBackupJson(workbook);
    const parsedMultiModule = parseSmartHisabBackupData(rawBackupFromWorkbook);
    if (
      parsedMultiModule.summary.productionCount > 0 ||
      parsedMultiModule.summary.withdrawalCount > 0 ||
      parsedMultiModule.summary.expenseCount > 0 ||
      parsedMultiModule.summary.loanCount > 0 ||
      parsedMultiModule.summary.fundCount > 0
    ) {
      setDetectedFullBackup(parsedMultiModule);
    }

    // Prioritize the Production / প্রোডাকশন sheet tab by default if present!
    const preferredTab =
      parsedTabs.find((t) => {
        const lower = t.sheetName.trim().toLowerCase();
        return (
          lower.includes('production') ||
          lower.includes('প্রোডাকশন') ||
          lower.includes('work') ||
          lower.includes('কাজ')
        );
      }) || parsedTabs[0];

    setUploadedFileName(
      parsedTabs.length > 1
        ? `${sourceLabel} (${preferredTab.sheetName})`
        : sourceLabel
    );
    selectSheetTab(preferredTab);
    setStep(2);
  };

  const handleExecuteFullBackupImport = async (backupData: {
    state: ApplicationRepositoryState;
    summary: FullBackupImportSummary;
  }) => {
    setIsImportingFullBackup(true);
    setParseErrorBn(null);
    try {
      if (onImportFullRepositoryState) {
        const res = await onImportFullRepositoryState(backupData.state);
        setFullBackupSuccessBanner({
          summary: backupData.summary,
          persistedToCloud: res.persistedToCloud,
        });
      } else {
        const res = await onBatchImportEntries(
          backupData.state.productionEntries,
          `backup-${Date.now()}`
        );
        setFullBackupSuccessBanner({
          summary: backupData.summary,
          persistedToCloud: res.persistedToCloud,
        });
      }
    } catch (err) {
      setParseErrorBn(
        `সম্পূর্ণ ব্যাকআপ ইমপোর্ট করতে ত্রুটি: ${
          err instanceof Error ? err.message : 'অজানা ত্রুটি'
        }`
      );
    } finally {
      setIsImportingFullBackup(false);
    }
  };

  const handleImportAttachedBackupClick = async () => {
    setIsImportingFullBackup(true);
    setParseErrorBn(null);
    try {
      const parsed = await fetchAndParseAttachedUserBackup();
      if (!parsed) {
        setParseErrorBn('সংযুক্ত ব্যাকআপ ফাইলটি লোড করা যায়নি।');
        return;
      }
      await handleExecuteFullBackupImport(parsed);
    } finally {
      setIsImportingFullBackup(false);
    }
  };

  // Step 1A: Handle JSON, CSV or XLSX File Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseErrorBn(null);

    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.json') || file.type === 'application/json') {
        const rawText = await file.text();
        const rawJson = JSON.parse(
          rawText.replace(/^\uFEFF/, '')
        ) as RawSmartHisabBackupJson;
        const parsedBackup = parseSmartHisabBackupData(rawJson);
        setDetectedFullBackup(parsedBackup);
        await handleExecuteFullBackupImport(parsedBackup);
      } else if (lowerName.endsWith('.csv') || file.type === 'text/csv') {
        const rawText = await file.text();
        const cleanText = rawText.replace(/^\uFEFF/, '');
        const workbook = XLSX.read(cleanText, {
          type: 'string',
          cellDates: true,
        });
        processWorkbook(workbook, file.name);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellDates: true,
        });
        processWorkbook(workbook, file.name);
      }
    } catch (err) {
      setParseErrorBn(
        `ফাইলটি পড়তে ত্রুটি হয়েছে: ${
          err instanceof Error ? err.message : 'অসমর্থিত ফরম্যাট'
        }`
      );
    } finally {
      e.target.value = '';
    }
  };

  // Step 1B: Handle Public Google Sheets URL Fetch
  const handleFetchGoogleSheetsUrl = async () => {
    const url = googleSheetUrl.trim();
    if (!url) {
      setParseErrorBn('অনুগ্রহ করে একটি বৈধ Google Sheets লিংক প্রদান করুন।');
      return;
    }

    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      setParseErrorBn(
        'Google Sheets লিংকটি সঠিক নয়। অথবা Google Sheets থেকে File → Download → CSV / XLSX ডাউনলোড করে উপরে আপলোড করুন।'
      );
      return;
    }

    const spreadsheetId = match[1];
    const gidMatch = url.match(/gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '0';

    const gvizCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
    const exportCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

    setIsLoadingSheet(true);
    setParseErrorBn(null);
    try {
      let response = await fetch(gvizCsvUrl);
      if (!response.ok) {
        response = await fetch(exportCsvUrl);
      }
      if (!response.ok) {
        throw new Error(
          'শিটটি পাবলিকলি শেয়ার করা নেই। Google Sheets-এ "Anyone with the link can view" করুন অথবা CSV/XLSX ডাউনলোড করে আপলোড করুন।'
        );
      }
      const csvText = (await response.text()).replace(/^\uFEFF/, '');
      const workbook = XLSX.read(csvText, { type: 'string', cellDates: true });
      processWorkbook(workbook, `Google_Sheet_${spreadsheetId.slice(0, 8)}.csv`);
    } catch (err) {
      setParseErrorBn(
        err instanceof Error
          ? err.message
          : 'Google Sheets লিংক থেকে সরাসরি ডেটা আনা সম্ভব হয়নি। অনুগ্রহ করে CSV/XLSX ফাইল হিসেবে ডাউনলোড করে আপলোড করুন।'
      );
    } finally {
      setIsLoadingSheet(false);
    }
  };

  // Download Sample CSV Template
  const handleDownloadSampleTemplate = () => {
    const sampleCsv = [
      'Production Date,Item Name,Category,Size,Color,Quantity in Pieces,Quantity in Dozens,Rate per Dozen,Earned Wage,Work Status,Settlement Status,Notes',
      '02-11-2026,বাচ্চাদের কটি,কটি,২৪,সাদা (White),300,25,35,875,completed,settled,বায়ার স্টাইল ১০১',
      '03-11-2026,হাফ হাতা গোলগোলা,গোলগোলা,২৬,নেভি ব্লু (Navy Blue),120,10,40,400,completed,pending,লাইন ০৪',
      '04-11-2026,ফুল হাতা শার্ট,শার্ট,২৮,কালো (Black),96,8,120,960,in_progress,pending,চলমান লট',
    ].join('\n');

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'smart-hisab-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Step 4: Run Comprehensive Data Validation
  const runValidation = () => {
    const parseCleanNumber = (rawVal: string | undefined): number | null => {
      if (!rawVal) return null;
      const cleaned = toAsciiDigits(rawVal)
        .replace(/[৳$,\s]/g, '')
        .trim();
      if (!cleaned) return null;
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : null;
    };

    const seenFingerprints = new Set<string>();
    const existingFingerprints = new Set<string>(
      existingEntries.map(
        (e) =>
          `${e.date}|${(e.itemName || e.garmentType).toLowerCase()}|${e.pieces ?? 0}|${
            e.totalWage ?? 0
          }`
      )
    );

    const results: ValidatedImportRow[] = rawRows.map((row, idx) => {
      const errorsBn: string[] = [];
      const warningsBn: string[] = [];
      let hasCalculationMismatch = false;

      const getVal = (key: ImportFieldKey): string => {
        const col = columnMapping[key];
        return col ? String(row[col] ?? '').trim() : '';
      };

      // 1. Validate Date
      const rawDate = getVal('date');
      const normalizedDate = normalizeToDDMMYYYY(rawDate);
      if (!rawDate) {
        errorsBn.push('প্রোডাকশন তারিখ অনুপস্থিত');
      } else if (!normalizedDate) {
        errorsBn.push(`অবৈধ তারিখ ফরম্যাট ("${rawDate}")`);
      }

      // 2. Validate Item Name & Category
      const rawItemName = getVal('itemName');
      const rawCategory = getVal('category') || 'সাধারণ ক্যাটাগরি';
      if (!rawItemName) {
        errorsBn.push('আইটেমের নাম অনুপস্থিত');
      }

      const rawSize = getVal('size') || 'M';
      const rawColor = getVal('color') || 'সাদা (White)';

      // 3. Validate Quantities & Rates
      const rawPiecesStr = getVal('pieces');
      const rawDozensStr = getVal('dozens');
      const rawRateStr = getVal('ratePerDozen');
      const rawEarnedStr = getVal('totalWage');
      const rawReceivedStr = getVal('receivedWage');
      const rawPendingStr = getVal('pendingWage');

      let pieces = parseCleanNumber(rawPiecesStr);
      let dozens = parseCleanNumber(rawDozensStr);
      let ratePerDozen = parseCleanNumber(rawRateStr);
      let totalWage = parseCleanNumber(rawEarnedStr);
      const receivedWageInput = parseCleanNumber(rawReceivedStr);
      const pendingWageInput = parseCleanNumber(rawPendingStr);

      if (rawPiecesStr && pieces === null) {
        errorsBn.push(`পিস সংখ্যা সঠিক সংখ্যা নয় ("${rawPiecesStr}")`);
      }
      if (rawDozensStr && dozens === null) {
        errorsBn.push(`ডজন সংখ্যা সঠিক সংখ্যা নয় ("${rawDozensStr}")`);
      }
      if (rawRateStr && ratePerDozen === null) {
        errorsBn.push(`প্রতি ডজনের দর সঠিক সংখ্যা নয় ("${rawRateStr}")`);
      }

      // Derive missing pieces or dozens
      if (pieces === null && dozens !== null && dozens >= 0) {
        pieces = Math.round(dozens * 12);
      }
      if (pieces === null) {
        pieces = 0;
      }
      const expectedDozens = calculateDozensFromPieces(pieces);

      if (
        dozens !== null &&
        pieces > 0 &&
        Math.abs(dozens - expectedDozens) > 0.05
      ) {
        hasCalculationMismatch = true;
        warningsBn.push(
          `ডজন অসামঞ্জস্য: ফাইলে ${toBengaliDigits(dozens)} ডজন, কিন্তু ${toBengaliDigits(
            pieces
          )} পিস ÷ ১২ = ${formatDozensBn(expectedDozens)} ডজন`
        );
      }

      const finalDozens =
        autoRecalculateWages || dozens === null ? expectedDozens : dozens;

      if (ratePerDozen === null) {
        if (totalWage !== null && finalDozens > 0) {
          ratePerDozen = Number((totalWage / finalDozens).toFixed(2));
        } else {
          ratePerDozen = 0;
        }
      }

      const expectedEarnedWage = calculateEarnedWageFromPiecesAndRate(
        pieces,
        ratePerDozen
      );

      if (
        totalWage !== null &&
        ratePerDozen > 0 &&
        pieces > 0 &&
        Math.abs(totalWage - expectedEarnedWage) > 1
      ) {
        hasCalculationMismatch = true;
        warningsBn.push(
          `মজুরি হিসাব অসামঞ্জস্য: ফাইলে ৳${toBengaliDigits(
            totalWage
          )}, কিন্তু ডজন × দর অনুযায়ী ৳${toBengaliDigits(expectedEarnedWage)}`
        );
      }

      const finalEarnedWage =
        autoRecalculateWages && pieces > 0 && ratePerDozen > 0
          ? expectedEarnedWage
          : totalWage ?? expectedEarnedWage;

      if (pieces <= 0 && finalEarnedWage <= 0) {
        errorsBn.push('পিস সংখ্যা এবং মজুরি উভয়ই শূন্য বা অনুপস্থিত');
      }

      // 4. Work & Settlement Status
      const rawWorkStatus = getVal('workStatus').toLowerCase();
      const workStatus: WorkStatus =
        rawWorkStatus.includes('in_progress') ||
        rawWorkStatus.includes('progress') ||
        rawWorkStatus.includes('চলমান')
          ? 'in_progress'
          : 'completed';

      const rawSettlement = getVal('settlementStatus').toLowerCase();
      const settlementStatus: SettlementStatus =
        rawSettlement.includes('settled') ||
        rawSettlement.includes('paid') ||
        rawSettlement.includes('পরিশোধিত') ||
        (receivedWageInput !== null &&
          finalEarnedWage > 0 &&
          receivedWageInput >= finalEarnedWage)
          ? 'settled'
          : 'pending';

      const finalReceivedWage =
        receivedWageInput !== null
          ? receivedWageInput
          : settlementStatus === 'settled'
          ? finalEarnedWage
          : 0;

      const finalPendingWage =
        pendingWageInput !== null
          ? pendingWageInput
          : Number(Math.max(0, finalEarnedWage - finalReceivedWage).toFixed(2));

      // 5. Timestamps
      const startWorkTime = getVal('startWorkTime') || null;
      const endWorkTime = getVal('endWorkTime') || null;
      const durationMins = calculateDurationMinutes(startWorkTime, endWorkTime);
      if (durationMins !== null && durationMins < 0) {
        errorsBn.push('কাজ শেষের সময় কাজ শুরুর সময়ের আগে দেওয়া হয়েছে');
      }

      // 6. Duplicate detection
      const fingerprint = `${normalizedDate || rawDate}|${rawItemName.toLowerCase()}|${pieces}|${finalEarnedWage}`;
      const isDuplicate =
        existingFingerprints.has(fingerprint) || seenFingerprints.has(fingerprint);
      seenFingerprints.add(fingerprint);

      if (isDuplicate) {
        warningsBn.push(
          'ডুপ্লিকেট রেকর্ড সনাক্ত হয়েছে (একই তারিখ, আইটেম, পিস ও মজুরি ইতোমধ্যে বিদ্যমান)'
        );
      }

      const entry: ProductionEntry = {
        id: `imp-${Date.now()}-${idx}`,
        date: normalizedDate || rawDate,
        itemName: rawItemName || 'পোশাক আইটেম',
        category: rawCategory,
        garmentType: `${rawItemName || 'পোশাক আইটেম'} (${rawCategory})`,
        size: rawSize,
        sizes: rawSize.split(',').map((s) => s.trim()).filter(Boolean),
        color: rawColor,
        colors: rawColor.split(',').map((c) => c.trim()).filter(Boolean),
        pieces,
        dozens: finalDozens,
        ratePerDozen,
        totalWage: finalEarnedWage,
        receivedWage: finalReceivedWage,
        pendingWage: finalPendingWage,
        workStatus,
        settlementStatus,
        startWorkTime,
        endWorkTime,
        workDurationMinutes: durationMins && durationMins >= 0 ? durationMins : null,
        shortDescription: getVal('shortDescription'),
        photos: [],
      };

      return {
        rowIndex: idx + 1,
        rawRow: row,
        entry,
        errorsBn,
        warningsBn,
        isDuplicate,
        hasCalculationMismatch,
        // Automatically mark invalid or duplicate rows to skip by default
        skipRow: errorsBn.length > 0 || isDuplicate,
      };
    });

    setValidatedRows(results);
    setConfirmedByOperator(false);
    setStep(4);
  };

  const toggleSkipValidatedRow = (rowIndex: number) => {
    setValidatedRows((prev) =>
      prev.map((r) =>
        r.rowIndex === rowIndex ? { ...r, skipRow: !r.skipRow } : r
      )
    );
  };

  const validationStats = useMemo(() => {
    const total = validatedRows.length;
    const withErrors = validatedRows.filter((r) => r.errorsBn.length > 0).length;
    const duplicates = validatedRows.filter((r) => r.isDuplicate).length;
    const mismatches = validatedRows.filter((r) => r.hasCalculationMismatch).length;
    const selectedToImport = validatedRows.filter(
      (r) => !r.skipRow && r.errorsBn.length === 0
    ).length;
    const skipped = total - selectedToImport;

    return {
      total,
      withErrors,
      duplicates,
      mismatches,
      selectedToImport,
      skipped,
    };
  }, [validatedRows]);

  // Step 5 -> Step 6: Execute Safe Batch Import
  const handleExecuteImport = async () => {
    if (!confirmedByOperator) return;
    const rowsToImport = validatedRows.filter(
      (r) => !r.skipRow && r.errorsBn.length === 0
    );
    const failedRows = validatedRows.filter((r) => r.errorsBn.length > 0);
    const skippedRows = validatedRows.filter(
      (r) => r.skipRow && r.errorsBn.length === 0
    );

    const batchId = `batch-${Date.now()}`;
    setIsImporting(true);
    try {
      const response = await onBatchImportEntries(
        rowsToImport.map((r) => r.entry),
        batchId
      );

      const errorList: string[] = [];
      if (response.errorBn) {
        errorList.push(response.errorBn);
      }
      failedRows.forEach((f) => {
        errorList.push(
          `সারি #${toBengaliDigits(f.rowIndex)}: ${f.errorsBn.join(', ')}`
        );
      });

      setImportResult({
        batchId,
        importedCount: response.importedCount,
        skippedCount: skippedRows.length,
        failedCount: failedRows.length + (response.errorBn ? rowsToImport.length : 0),
        persistedToCloud: response.persistedToCloud,
        errorDetailsBn: errorList,
      });
      setStep(6);
    } finally {
      setIsImporting(false);
    }
  };

  const handleRollbackLastBatch = async () => {
    if (!importResult?.batchId) return;
    const res = await onRollbackImportBatch(importResult.batchId);
    if (res.errorBn) {
      setRollbackNoticeBn(res.errorBn);
    } else {
      setRollbackNoticeBn(
        `ব্যাচ (${importResult.batchId}) সফলভাবে রোলব্যাক করা হয়েছে এবং ইমপোর্টকৃত সারিগুলো প্রত্যাহার করা হয়েছে।`
      );
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <PageHeader
        moduleIndexBn="০৪. প্রধান মডিউল · ডেটা ইমপোর্ট (Google Sheets / Excel / CSV)"
        titleBn="গুগল শিট, এক্সেল ও সিএসভি ডেটা ইমপোর্ট"
        subtitleBn="আপনার পূর্ববর্তী প্রোডাকশন ও মজুরির হিসাব ৬টি নিরাপদ ধাপে যাচাই করে স্মার্ট হিসাবে যুক্ত করুন (ডুপ্লিকেট প্রতিরোধ ও রোলব্যাক সুবিধাসহ)"
        primaryActionLabelBn="নমুনা CSV টেমপ্লেট ডাউনলোড"
        primaryActionIcon={<Download className="w-4 h-4" />}
        onPrimaryAction={handleDownloadSampleTemplate}
        secondaryActionLabelBn="নতুন ফাইল নির্বাচন"
        secondaryActionIcon={<RotateCcw className="w-4 h-4" />}
        onSecondaryAction={() => {
          setStep(1);
          setParseErrorBn(null);
          setImportResult(null);
          setRollbackNoticeBn(null);
        }}
      />

      {/* 6-Step Progress Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {[
            { num: 1, titleBn: '১. ফাইল আপলোড' },
            { num: 2, titleBn: '২. ডেটা প্রিভিউ' },
            { num: 3, titleBn: '৩. কলাম ম্যাপিং' },
            { num: 4, titleBn: '৪. ডেটা যাচাইকরণ' },
            { num: 5, titleBn: '৫. ইমপোর্ট নিশ্চিতকরণ' },
            { num: 6, titleBn: '৬. ইমপোর্ট ফলাফল' },
          ].map((item) => {
            const isActive = step === item.num;
            const isDone = step > item.num;
            return (
              <div
                key={item.num}
                className={`px-3 py-2 rounded-xl border font-semibold flex items-center justify-between ${
                  isActive
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200'
                    : isDone
                    ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                <span className="truncate">{item.titleBn}</span>
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {parseErrorBn && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-4 text-xs sm:text-sm text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{parseErrorBn}</span>
        </div>
      )}

      {/* Full Multi-Module Backup Import Success Banner */}
      {fullBackupSuccessBanner && (
        <div className="rounded-2xl border-2 border-emerald-500 dark:border-emerald-600 bg-emerald-50/90 dark:bg-emerald-950/50 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-emerald-950 dark:text-emerald-100">
                  আপনার সম্পূর্ণ হিসাব সফলভাবে ইমপোর্ট ও সিঙ্ক হয়েছে!
                </h3>
                <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-0.5">
                  {fullBackupSuccessBanner.persistedToCloud
                    ? 'সুপাবেস ক্লাউড ডাটাবেসে স্থায়ীভাবে সংরক্ষিত হয়েছে (পেজ রিফ্রেশ করলেও মুছবে না)'
                    : 'অ্যাপ্লিকেশনে সংরক্ষিত হয়েছে (ক্লাউডে রাখতে উপরে লগইন করুন)'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 p-3">
              <p className="text-slate-500 dark:text-slate-400">প্রোডাকশন এন্ট্রি</p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {toBengaliDigits(fullBackupSuccessBanner.summary.productionCount)} টি কাজ
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 p-3">
              <p className="text-slate-500 dark:text-slate-400">কোম্পানি থেকে উত্তোলন</p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {toBengaliDigits(fullBackupSuccessBanner.summary.withdrawalCount)} টি উত্তোলন
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 p-3">
              <p className="text-slate-500 dark:text-slate-400">আয় ও পরিবার খরচ</p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {toBengaliDigits(
                  fullBackupSuccessBanner.summary.expenseCount +
                    fullBackupSuccessBanner.summary.incomeCount
                )}{' '}
                টি লেনদেন
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 p-3">
              <p className="text-slate-500 dark:text-slate-400">বিকাশ ও ঋণ খাতা</p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {toBengaliDigits(fullBackupSuccessBanner.summary.loanCount)} টি ঋণ হিসাব
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 p-3">
              <p className="text-slate-500 dark:text-slate-400">ফান্ড ও চিকিৎসা তহবিল</p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {toBengaliDigits(fullBackupSuccessBanner.summary.fundCount)} টি ফান্ড ({toBengaliDigits(fullBackupSuccessBanner.summary.fundTxCount)} লেনদেন)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.DASHBOARD)}
              className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer"
            >
              ড্যাশবোর্ডে দেখুন →
            </button>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.PRODUCTION)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
            >
              প্রোডাকশন খাতা (৬১টি) →
            </button>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.WEEKLY_REPORT)}
              className="px-3.5 py-2 rounded-xl border border-teal-700 text-teal-800 dark:text-teal-200 text-xs font-bold cursor-pointer"
            >
              সাপ্তাহিক রিপোর্ট (শনি–বৃহস্পতি) →
            </button>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.PAYMENTS)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
            >
              কোম্পানি উত্তোলন (১৮টি) →
            </button>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.LOANS)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
            >
              বিকাশ লোন →
            </button>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.FUNDS)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
            >
              চিকিৎসা ফান্ড →
            </button>
            <button
              type="button"
              onClick={() => onNavigate(ModuleId.INCOME_EXPENSE)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold cursor-pointer"
            >
              পরিবার ও অন্যান্য খরচ (২০টি) →
            </button>
          </div>
        </div>
      )}

      {/* STEP 1: Upload File (JSON / CSV / XLSX) or Google Sheets Link */}
      {step === 1 && (
        <div className="space-y-6">
          {/* 1-Click Attached SmartHisab_Backup_2026-11-06.json Import Card */}
          <div className="rounded-2xl border-2 border-teal-600/80 dark:border-teal-500/80 bg-gradient-to-br from-teal-50/90 via-white to-emerald-50/60 dark:from-teal-950/60 dark:via-slate-900 dark:to-emerald-950/30 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-700 text-white text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>১-ক্লিকে সম্পূর্ণ ব্যাকআপ ও সকল ট্যাব ইমপোর্ট</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  আপনার সংযুক্ত ব্যাকআপ হিসাব (SmartHisab_Backup_2026-11-06.json / Ay bay.xlsx) ইমপোর্ট করুন
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  আপনার পাঠানো ব্যাকআপ ফাইলের <strong>প্রোডাকশন (৬১টি কাজ)</strong>, <strong>কোম্পানি থেকে বিল উত্তোলন (১৮টি = ৳৭১,৫০০)</strong>, <strong>পরিবার ও অন্যান্য খরচ (২০টি)</strong>, <strong>বিকাশ লোন (৮টি কিস্তি পরিশোধসহ)</strong> এবং <strong>চিকিৎসা ফান্ড (২টি ফান্ড, ১৪টি লেনদেন)</strong> এক ক্লিকেই সকল মডিউলে ও সুপাবেস ক্লাউডে সংরক্ষণ করুন।
                </p>
              </div>

              <button
                type="button"
                onClick={handleImportAttachedBackupClick}
                disabled={isImportingFullBackup}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-sm"
              >
                <Database className="w-4 h-4" />
                <span>
                  {isImportingFullBackup
                    ? 'সকল হিসাব ইমপোর্ট ও সিঙ্ক হচ্ছে...'
                    : 'সংযুক্ত ব্যাকআপের সকল হিসাব ১-ক্লিকে ইমপোর্ট করুন'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ধাপ ১ (ক): Excel (.xlsx), JSON ব্যাকআপ বা CSV ফাইল আপলোড করুন
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                আপনার <strong>Ay bay.xlsx</strong> (মাল্টি-ট্যাব এক্সেল), <strong>SmartHisab_Backup.json</strong> অথবা <strong>CSV</strong> ফাইল এখানে আপলোড করুন। এক্সেল ফাইলে একাধিক ট্যাব (Production, Expense, Loan, Fund, Fund_Transaction) থাকলে সব ট্যাবই দেখতে ও ইমপোর্ট করতে পারবেন।
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-600 dark:hover:border-teal-500 rounded-2xl p-6 text-center bg-slate-50/70 dark:bg-slate-950/50 transition-colors cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Excel (.xlsx / .xls), JSON ব্যাকআপ অথবা CSV ফাইল নির্বাচন করতে ট্যাপ করুন
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  মাল্টি-ট্যাব স্প্রেডশিট (প্রোডাকশন, খরচ, লোন, ফান্ড) ও JSON ব্যাকআপ সম্পূর্ণ সমর্থিত
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ধাপ ১ (খ): সরাসরি Google Sheets লিংক থেকে ইমপোর্ট (ঐচ্ছিক)
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  আপনার Google Sheet-টি যদি <em>&ldquo;Anyone with the link can view&rdquo;</em> করা থাকে, তবে তার লিংক নিচে পেস্ট করে সরাসরি লোড করতে পারেন:
                </p>

                <div className="space-y-2">
                  <label
                    htmlFor="google-sheet-url-input"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Google Sheets URL
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="google-sheet-url-input"
                      type="url"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleFetchGoogleSheetsUrl}
                      disabled={isLoadingSheet}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                      <Link2 className="w-4 h-4" />
                      <span>{isLoadingSheet ? 'লোড হচ্ছে...' : 'শিট লোড করুন'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3.5 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>ইমপোর্ট নিরাপত্তা নিশ্চয়তা:</span>
                </p>
                <p>
                  • পূর্বে সংরক্ষিত কোনো প্রোডাকশন তথ্য মুছে ফেলা হবে না। • ঐতিহাসিক প্রোডাকশন তারিখ অক্ষুণ্ণ থাকবে এবং স্বয়ংক্রিয়ভাবে শনিবার–বৃহস্পতিবার সাপ্তাহিক রিপোর্টে যুক্ত হবে।
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Preview Spreadsheet Contents + Multi-Tab Switcher */}
      {step === 2 && (
        <div className="space-y-4">
          {/* If Multi-Tab SmartHisab Workbook Detected, offer 1-Click Import of ALL Tabs */}
          {detectedFullBackup && (
            <div className="rounded-2xl border-2 border-teal-600 dark:border-teal-500 bg-teal-50/90 dark:bg-teal-950/50 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-teal-800 dark:text-teal-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>মাল্টি-ট্যাব স্প্রেডশিট সনাক্ত হয়েছে ({toBengaliDigits(availableSheets.length)} টি ট্যাব)</span>
                </p>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  এই ফাইলের সকল ট্যাবের হিসাব একসাথে ইমপোর্ট করতে চান?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  সনাক্তকৃত হিসাব: প্রোডাকশন কাজ: <strong>{toBengaliDigits(detectedFullBackup.summary.productionCount)}টি</strong> · কোম্পানি থেকে উত্তোলন: <strong>{toBengaliDigits(detectedFullBackup.summary.withdrawalCount)}টি</strong> · খরচ: <strong>{toBengaliDigits(detectedFullBackup.summary.expenseCount)}টি</strong> · ঋণ হিসাব: <strong>{toBengaliDigits(detectedFullBackup.summary.loanCount)}টি</strong> · ফান্ড: <strong>{toBengaliDigits(detectedFullBackup.summary.fundCount)}টি ({toBengaliDigits(detectedFullBackup.summary.fundTxCount)}টি লেনদেন)</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleExecuteFullBackupImport(detectedFullBackup)}
                disabled={isImportingFullBackup}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Database className="w-4 h-4" />
                <span>
                  {isImportingFullBackup
                    ? 'সব ট্যাব ইমপোর্ট হচ্ছে...'
                    : 'সব ট্যাবের সম্পূর্ণ হিসাব একসাথে ইমপোর্ট করুন'}
                </span>
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
            {/* Sheet Tab Selector Bar when Excel file has multiple tabs */}
            {availableSheets.length > 1 && (
              <div className="space-y-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-teal-600" />
                  <span>
                    স্প্রেডশিটের সকল ট্যাব ({toBengaliDigits(availableSheets.length)} টি) — যেকোনো ট্যাবে ট্যাপ করে সেই ট্যাবের সম্পূর্ণ হিসাব দেখুন:
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {availableSheets.map((tab) => {
                    const isSelected = tab.sheetName === activeSheetName;
                    return (
                      <button
                        key={tab.sheetName}
                        type="button"
                        onClick={() => selectSheetTab(tab)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-teal-500'
                        }`}
                      >
                        <span>{tab.sheetName}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                            isSelected
                              ? 'bg-teal-800 text-teal-100'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {toBengaliDigits(tab.rows.length)} সারি
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ধাপ ২: স্প্রেডশিট ডেটা প্রিভিউ ({activeSheetName || uploadedFileName})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  নির্বাচিত ট্যাব: <strong>{activeSheetName || 'ডিফল্ট'}</strong> · মোট সনাক্তকৃত সারি:{' '}
                  {toBengaliDigits(rawRows.length)} টি · কলাম:{' '}
                  {toBengaliDigits(sheetHeaders.length)} টি{' '}
                  {showAllPreviewRows
                    ? '(সকল সারি নিচে দেখানো হচ্ছে)'
                    : `(প্রথম ${toBengaliDigits(Math.min(10, rawRows.length))}টি সারি দেখানো হলো)`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {rawRows.length > 10 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPreviewRows((prev) => !prev)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl border border-teal-600/70 text-teal-700 dark:text-teal-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>
                      {showAllPreviewRows
                        ? 'সংক্ষিপ্ত প্রিভিউ (১০ সারি)'
                        : `সব সারি দেখুন (${toBengaliDigits(rawRows.length)} টি)`}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  অন্য ফাইল নিন
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  পরবর্তী ধাপ: কলাম ম্যাপিং →
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-semibold text-slate-700 dark:text-slate-300">
                    <th className="py-2.5 px-3 whitespace-nowrap">#</th>
                    {sheetHeaders.map((h) => (
                      <th key={h} className="py-2.5 px-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(showAllPreviewRows ? rawRows : rawRows.slice(0, 10)).map(
                    (r, rIdx) => (
                      <tr key={rIdx}>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {toBengaliDigits(rIdx + 1)}
                        </td>
                        {sheetHeaders.map((h) => (
                          <td
                            key={h}
                            className="py-2.5 px-3 text-slate-800 dark:text-slate-200 whitespace-nowrap max-w-[220px] truncate"
                          >
                            {r[h] || '—'}
                          </td>
                        ))}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Column Mapping */}
      {step === 3 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ধাপ ৩: স্প্রেডশিট কলাম ম্যাপিং (Column Mapping)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                আপনার স্প্রেডশিটের কলামের নামের সাথে স্মার্ট হিসাবের ফিল্ডগুলো মিলিয়ে নিন
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                ← প্রিভিউতে ফিরুন
              </button>
              <button
                type="button"
                onClick={runValidation}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                পরবর্তী ধাপ: ডেটা যাচাই করুন →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {IMPORT_FIELD_DEFINITIONS.map((fieldDef) => (
              <div
                key={fieldDef.key}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 bg-slate-50/50 dark:bg-slate-950/40"
              >
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {fieldDef.labelBn}{' '}
                  {fieldDef.required && (
                    <span className="text-rose-600 dark:text-rose-400">*</span>
                  )}
                </label>
                <select
                  value={columnMapping[fieldDef.key]}
                  onChange={(e) =>
                    setColumnMapping((prev) => ({
                      ...prev,
                      [fieldDef.key]: e.target.value,
                    }))
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- কলাম নির্বাচন করা হয়নি --</option>
                  {sheetHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRecalculateWages}
                onChange={(e) => setAutoRecalculateWages(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600"
              />
              <span>
                ডজন বা মজুরি অসামঞ্জস্য থাকলে পিস ও দর অনুযায়ী স্বয়ংক্রিয়ভাবে সঠিক ডজন (Pieces ÷ 12) ও মজুরি গণনা করুন
              </span>
            </label>
          </div>
        </div>
      )}

      {/* STEP 4: Data Validation */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <SummaryCard
              titleBn="মোট যাচাইকৃত সারি"
              amount={null}
              customValueBn={`${toBengaliDigits(validationStats.total)} টি`}
              subtitleBn="স্প্রেডশিটের সর্বমোট ডেটা সারি"
              icon={<FileSpreadsheet className="w-5 h-5" />}
              tone="default"
            />
            <SummaryCard
              titleBn="ইমপোর্টযোগ্য বৈধ সারি"
              amount={null}
              customValueBn={`${toBengaliDigits(validationStats.selectedToImport)} টি`}
              subtitleBn="নির্বাচিত সঠিক সারি"
              icon={<CheckCircle2 className="w-5 h-5" />}
              tone="positive"
            />
            <SummaryCard
              titleBn="ত্রুটিযুক্ত সারি"
              amount={null}
              customValueBn={`${toBengaliDigits(validationStats.withErrors)} টি`}
              subtitleBn="তারিখ বা সংখ্যার ত্রুটি"
              icon={<AlertTriangle className="w-5 h-5" />}
              tone="danger"
            />
            <SummaryCard
              titleBn="ডুপ্লিকেট ও হিসাব সতর্কতা"
              amount={null}
              customValueBn={`ডুপ্লিকেট: ${toBengaliDigits(
                validationStats.duplicates
              )} · অসামঞ্জস্য: ${toBengaliDigits(validationStats.mismatches)}`}
              subtitleBn="স্বয়ংক্রিয়ভাবে চিহ্নিত"
              icon={<ShieldCheck className="w-5 h-5" />}
              tone="warning"
            />
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ধাপ ৪: ডেটা যাচাইকরণ ফলাফল (Data Validation)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ত্রুটিযুক্ত বা ডুপ্লিকেট সারিগুলো টিক চিহ্ন তুলে বাদ (Skip) দিতে পারেন
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  ← কলাম ম্যাপিং পরিবর্তন
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  disabled={validationStats.selectedToImport === 0}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  পরবর্তী ধাপ: ইমপোর্ট নিশ্চিতকরণ →
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {validatedRows.map((vRow) => {
                const hasErr = vRow.errorsBn.length > 0;
                return (
                  <div
                    key={vRow.rowIndex}
                    className={`rounded-xl border p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      hasErr
                        ? 'border-rose-200 dark:border-rose-900/70 bg-rose-50/40 dark:bg-rose-950/30'
                        : vRow.isDuplicate || vRow.hasCalculationMismatch
                        ? 'border-amber-200 dark:border-amber-900/70 bg-amber-50/40 dark:bg-amber-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          সারি #{toBengaliDigits(vRow.rowIndex)}
                        </span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          তারিখ: {formatDateDDMMYYYY(vRow.entry.date, true)}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {vRow.entry.itemName}
                        </span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {toBengaliDigits(vRow.entry.pieces ?? 0)} পিস ({formatDozensBn(vRow.entry.dozens)} ডজন) ·{' '}
                          {formatTaka(vRow.entry.totalWage, true)}
                        </span>
                      </div>

                      {vRow.errorsBn.map((err, i) => (
                        <p key={i} className="text-rose-700 dark:text-rose-400 font-semibold">
                          • ত্রুটি: {err}
                        </p>
                      ))}
                      {vRow.warningsBn.map((warn, i) => (
                        <p key={i} className="text-amber-700 dark:text-amber-400">
                          • সতর্কতা: {warn}
                        </p>
                      ))}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={hasErr}
                          checked={!vRow.skipRow && !hasErr}
                          onChange={() => toggleSkipValidatedRow(vRow.rowIndex)}
                          className="w-4 h-4 rounded text-teal-600"
                        />
                        <span>
                          {hasErr
                            ? 'ত্রুটিযুক্ত (ইমপোর্ট অযোগ্য)'
                            : vRow.skipRow
                            ? 'বাদ দেওয়া হয়েছে (Skipped)'
                            : 'ইমপোর্ট করা হবে'}
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Import Confirmation */}
      {step === 5 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5 max-w-2xl mx-auto">
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              ধাপ ৫: চূড়ান্ত ইমপোর্ট নিশ্চিতকরণ (Import Confirmation)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              ইমপোর্ট শুরু করার পূর্বে নিচের সারসংক্ষেপটি যাচাই করুন
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                ইমপোর্ট করা হবে
              </p>
              <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {toBengaliDigits(validationStats.selectedToImport)} টি সারি
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-3.5">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                বাদ দেওয়া (Skipped) সারি
              </p>
              <p className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
                {toBengaliDigits(validationStats.skipped)} টি সারি
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 p-3.5">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                ত্রুটিযুক্ত সারি
              </p>
              <p className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-1">
                {toBengaliDigits(validationStats.withErrors)} টি সারি
              </p>
            </div>
          </div>

          <label className="flex items-start gap-2.5 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-xs sm:text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={confirmedByOperator}
              onChange={(e) => setConfirmedByOperator(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-teal-600 shrink-0"
            />
            <span>
              আমি যাচাই করেছি যে নির্বাচিত{' '}
              <strong>{toBengaliDigits(validationStats.selectedToImport)} টি</strong> প্রোডাকশন রেকর্ড আমার বিদ্যমান ডেটার সাথে নিরাপদে যুক্ত হবে এবং পূর্বের কোনো ডেটা মুছে যাবে না।
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold cursor-pointer"
            >
              ← যাচাইকরণে ফিরুন
            </button>
            <button
              type="button"
              disabled={!confirmedByOperator || isImporting}
              onClick={handleExecuteImport}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold cursor-pointer"
            >
              {isImporting
                ? 'ডেটা ইমপোর্ট হচ্ছে...'
                : 'নিশ্চিত করুন ও ডেটা ইমপোর্ট করুন'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Import Results & Rollback */}
      {step === 6 && importResult && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                ধাপ ৬: ইমপোর্ট ফলাফল (Import Results)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ব্যাচ আইডি: {importResult.batchId} ·{' '}
                {importResult.persistedToCloud
                  ? 'সুপাবেস ক্লাউড ডাটাবেসে সংরক্ষিত হয়েছে'
                  : 'অ্যাপ্লিকেশন মেমোরিতে যুক্ত হয়েছে'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRollbackLastBatch}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold cursor-pointer"
              >
                এই ইমপোর্ট রোলব্যাক (বাতিল) করুন
              </button>
              <button
                type="button"
                onClick={() => onNavigate(ModuleId.PRODUCTION)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer"
              >
                প্রোডাকশন ইতিহাসে দেখুন →
              </button>
              <button
                type="button"
                onClick={() => onNavigate(ModuleId.WEEKLY_REPORT)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold cursor-pointer"
              >
                সাপ্তাহিক রিপোর্টে দেখুন →
              </button>
            </div>
          </div>

          {rollbackNoticeBn && (
            <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 p-3.5 text-xs sm:text-sm text-teal-900 dark:text-teal-200">
              {rollbackNoticeBn}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              titleBn="সফলভাবে ইমপোর্টকৃত সারি"
              amount={null}
              customValueBn={`${toBengaliDigits(importResult.importedCount)} টি`}
              subtitleBn="প্রোডাকশন ও সাপ্তাহিক রিপোর্টে যুক্ত"
              icon={<CheckCircle2 className="w-5 h-5" />}
              tone="positive"
            />
            <SummaryCard
              titleBn="বাদ দেওয়া (Skipped) সারি"
              amount={null}
              customValueBn={`${toBengaliDigits(importResult.skippedCount)} টি`}
              subtitleBn="ডুপ্লিকেট বা ব্যবহারকারী কর্তৃক বাদ"
              icon={<RotateCcw className="w-5 h-5" />}
              tone="warning"
            />
            <SummaryCard
              titleBn="ব্যর্থ (Failed) সারি"
              amount={null}
              customValueBn={`${toBengaliDigits(importResult.failedCount)} টি`}
              subtitleBn="ভ্যালিডেশন বা ডাটাবেস ত্রুটি"
              icon={<AlertTriangle className="w-5 h-5" />}
              tone="danger"
            />
          </div>

          {importResult.errorDetailsBn.length > 0 && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/50 dark:bg-rose-950/30 p-4 space-y-1.5 text-xs text-rose-800 dark:text-rose-200">
              <p className="font-bold">ত্রুটির বিস্তারিত বিবরণ (Error Details):</p>
              {importResult.errorDetailsBn.map((detail, idx) => (
                <p key={idx}>• {detail}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
