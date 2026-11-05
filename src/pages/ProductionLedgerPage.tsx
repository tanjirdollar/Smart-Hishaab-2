import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  FilePlus2,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  Square,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  GARMENT_CATEGORY_OPTIONS,
  GARMENT_COLOR_OPTIONS,
  GARMENT_ITEM_NAME_OPTIONS,
  GARMENT_SIZE_OPTIONS,
} from '../config/navigation';
import {
  ProductionEntry,
  ProductionFilterState,
  SettlementStatus,
  UploadedPhotoPreview,
  WorkStatus,
} from '../types/models';
import {
  calculateDozensFromPieces,
  calculateDurationMinutes,
  calculateEarnedWageFromPiecesAndRate,
  formatDateDDMMYYYY,
  formatDozensBn,
  formatDurationBn,
  formatTaka,
  formatWorkTimestampBn,
  getNowLocalDateTimeInput,
  getTodayDDMMYYYY,
  parseAnyDateToDateObj,
  toAsciiDigits,
  toBengaliDigits,
  toDateTimeLocalInputValue,
} from '../utils/formatters';
import { EmptyDataState } from '../components/ui/EmptyDataState';
import {
  DateInputDDMMYYYY,
  FormInput,
  FormSelect,
  FormTextarea,
  MultiPhotoUpload,
} from '../components/ui/FormFields';
import { ModalDrawer } from '../components/ui/ModalDrawer';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/ui/SummaryCard';

export interface ProductionLedgerPageProps {
  entries: ProductionEntry[];
  onSaveEntry: (entry: ProductionEntry, rawFiles?: File[]) => void;
  onDeleteEntry: (id: string) => void;
}

interface ProductionFormDraft {
  id: string | null;
  date: string;
  itemName: string;
  customItemName: string;
  category: string;
  customCategory: string;
  selectedSizes: string[];
  customSizeInput: string;
  selectedColors: string[];
  customColorInput: string;
  pieces: string;
  ratePerDozen: string;
  receivedWage: string;
  workStatus: WorkStatus;
  settlementStatus: SettlementStatus;
  startWorkTime: string;
  endWorkTime: string;
  shortDescription: string;
  photos: UploadedPhotoPreview[];
  rawFiles: File[];
}

function createEmptyDraft(): ProductionFormDraft {
  return {
    id: null,
    date: getTodayDDMMYYYY(false),
    itemName: GARMENT_ITEM_NAME_OPTIONS[0],
    customItemName: '',
    category: GARMENT_CATEGORY_OPTIONS[0],
    customCategory: '',
    selectedSizes: ['M'],
    customSizeInput: '',
    selectedColors: [GARMENT_COLOR_OPTIONS[0]],
    customColorInput: '',
    pieces: '',
    ratePerDozen: '',
    receivedWage: '',
    workStatus: 'in_progress',
    settlementStatus: 'pending',
    startWorkTime: '',
    endWorkTime: '',
    shortDescription: '',
    photos: [],
    rawFiles: [],
  };
}

/**
 * Visual status styles according to requirements:
 * - In Progress: Blue
 * - Completed but wage Pending: Soft Amber/Orange
 * - Wage Settled: Soft Green
 */
function getEntryVisualCardStyle(entry: ProductionEntry): {
  cardBorderBg: string;
  workLabelBn: string;
  workTextColor: string;
  settlementLabelBn: string;
  settlementTextColor: string;
} {
  const isWorkCompleted = entry.workStatus === 'completed';
  const isWageSettled = entry.settlementStatus === 'settled';

  const workLabelBn = isWorkCompleted ? 'কাজ সম্পন্ন (Completed)' : 'কাজ চলমান (In Progress)';
  const workTextColor = isWorkCompleted
    ? 'text-amber-700 dark:text-amber-300'
    : 'text-sky-700 dark:text-sky-300';

  const settlementLabelBn = isWageSettled
    ? 'মজুরি পরিশোধিত (Settled)'
    : 'মজুরি বকেয়া (Pending)';
  const settlementTextColor = isWageSettled
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-amber-700 dark:text-amber-300';

  if (isWageSettled) {
    return {
      cardBorderBg:
        'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/35 dark:bg-emerald-950/25',
      workLabelBn,
      workTextColor: isWorkCompleted
        ? 'text-emerald-700 dark:text-emerald-300'
        : 'text-sky-700 dark:text-sky-300',
      settlementLabelBn,
      settlementTextColor,
    };
  }

  if (isWorkCompleted) {
    // Completed but wage Pending -> Soft Amber/Orange
    return {
      cardBorderBg:
        'border-amber-200 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/25',
      workLabelBn,
      workTextColor,
      settlementLabelBn,
      settlementTextColor,
    };
  }

  // In Progress -> Blue
  return {
    cardBorderBg:
      'border-sky-200 dark:border-sky-800/80 bg-sky-50/40 dark:bg-sky-950/25',
    workLabelBn,
    workTextColor,
    settlementLabelBn,
    settlementTextColor,
  };
}

export const ProductionLedgerPage: React.FC<ProductionLedgerPageProps> = ({
  entries,
  onSaveEntry,
  onDeleteEntry,
}) => {
  const [filters, setFilters] = useState<ProductionFilterState>({
    searchQuery: '',
    dateFrom: '',
    dateTo: '',
    itemName: 'ALL',
    category: 'ALL',
    size: 'ALL',
    color: 'ALL',
    workStatus: 'ALL',
    settlementStatus: 'ALL',
  });

  const [availableSizes, setAvailableSizes] = useState<string[]>(GARMENT_SIZE_OPTIONS);
  const [availableColors, setAvailableColors] = useState<string[]>(GARMENT_COLOR_OPTIONS);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [draft, setDraft] = useState<ProductionFormDraft>(createEmptyDraft);
  const [formErrorBn, setFormErrorBn] = useState<string | null>(null);
  const [statusBannerBn, setStatusBannerBn] = useState<string | null>(null);

  // Automatic calculation in Section C:
  // Dozens = Pieces / 12
  // Earned Wage = Dozens × Rate per Dozen
  const parsedPieces = useMemo(() => {
    const clean = toAsciiDigits(draft.pieces).trim();
    const num = Number(clean);
    return clean && Number.isFinite(num) && num >= 0 ? Math.round(num) : 0;
  }, [draft.pieces]);

  const parsedRatePerDozen = useMemo(() => {
    const clean = toAsciiDigits(draft.ratePerDozen).trim();
    const num = Number(clean);
    return clean && Number.isFinite(num) && num >= 0 ? num : 0;
  }, [draft.ratePerDozen]);

  const calculatedDozens = useMemo(
    () => calculateDozensFromPieces(parsedPieces),
    [parsedPieces]
  );

  const calculatedEarnedWage = useMemo(
    () => calculateEarnedWageFromPiecesAndRate(parsedPieces, parsedRatePerDozen),
    [parsedPieces, parsedRatePerDozen]
  );

  const calculatedDurationMinutes = useMemo(
    () => calculateDurationMinutes(draft.startWorkTime, draft.endWorkTime),
    [draft.startWorkTime, draft.endWorkTime]
  );

  const handleOpenAddModal = () => {
    setFormErrorBn(null);
    setDraft(createEmptyDraft());
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (entry: ProductionEntry) => {
    setFormErrorBn(null);
    const sizesList =
      entry.sizes && entry.sizes.length > 0
        ? entry.sizes
        : entry.size
        ? entry.size.split(',').map((s) => s.trim()).filter(Boolean)
        : ['M'];
    const colorsList =
      entry.colors && entry.colors.length > 0
        ? entry.colors
        : entry.color
        ? entry.color.split(',').map((c) => c.trim()).filter(Boolean)
        : [GARMENT_COLOR_OPTIONS[0]];

    // Ensure custom sizes/colors from edited entry are available in options
    setAvailableSizes((prev) => Array.from(new Set([...prev, ...sizesList])));
    setAvailableColors((prev) => Array.from(new Set([...prev, ...colorsList])));

    const isKnownItem = GARMENT_ITEM_NAME_OPTIONS.includes(entry.itemName);
    const isKnownCat = GARMENT_CATEGORY_OPTIONS.includes(entry.category);

    setDraft({
      id: entry.id,
      date: entry.date,
      itemName: isKnownItem ? entry.itemName : 'CUSTOM',
      customItemName: isKnownItem ? '' : entry.itemName,
      category: isKnownCat ? entry.category : 'CUSTOM',
      customCategory: isKnownCat ? '' : entry.category,
      selectedSizes: sizesList,
      customSizeInput: '',
      selectedColors: colorsList,
      customColorInput: '',
      pieces: entry.pieces !== null ? String(entry.pieces) : '',
      ratePerDozen: entry.ratePerDozen !== null ? String(entry.ratePerDozen) : '',
      receivedWage: entry.receivedWage !== null ? String(entry.receivedWage) : '',
      workStatus: entry.workStatus ?? 'in_progress',
      settlementStatus: entry.settlementStatus ?? 'pending',
      startWorkTime: toDateTimeLocalInputValue(entry.startWorkTime),
      endWorkTime: toDateTimeLocalInputValue(entry.endWorkTime),
      shortDescription: entry.shortDescription,
      photos: entry.photos,
      rawFiles: [],
    });
    setIsFormModalOpen(true);
  };

  // Form Section B: Toggle multi-size & custom size
  const toggleSizeSelection = (sizeVal: string) => {
    setDraft((prev) => {
      const exists = prev.selectedSizes.includes(sizeVal);
      const next = exists
        ? prev.selectedSizes.filter((s) => s !== sizeVal)
        : [...prev.selectedSizes, sizeVal];
      return {
        ...prev,
        selectedSizes: next.length > 0 ? next : [sizeVal],
      };
    });
  };

  const handleAddCustomSize = () => {
    const val = draft.customSizeInput.trim();
    if (!val) return;
    if (!availableSizes.includes(val)) {
      setAvailableSizes((prev) => [...prev, val]);
    }
    setDraft((prev) => ({
      ...prev,
      selectedSizes: Array.from(new Set([...prev.selectedSizes, val])),
      customSizeInput: '',
    }));
  };

  const toggleColorSelection = (colorVal: string) => {
    setDraft((prev) => {
      const exists = prev.selectedColors.includes(colorVal);
      const next = exists
        ? prev.selectedColors.filter((c) => c !== colorVal)
        : [...prev.selectedColors, colorVal];
      return {
        ...prev,
        selectedColors: next.length > 0 ? next : [colorVal],
      };
    });
  };

  const handleAddCustomColor = () => {
    const val = draft.customColorInput.trim();
    if (!val) return;
    if (!availableColors.includes(val)) {
      setAvailableColors((prev) => [...prev, val]);
    }
    setDraft((prev) => ({
      ...prev,
      selectedColors: Array.from(new Set([...prev.selectedColors, val])),
      customColorInput: '',
    }));
  };

  // Section D: Start Work and End Work triggers inside Form
  const handleFormStartWorkNow = () => {
    const nowStr = getNowLocalDateTimeInput();
    setDraft((prev) => ({
      ...prev,
      startWorkTime: nowStr,
      workStatus: 'in_progress',
    }));
    setFormErrorBn(null);
  };

  const handleFormEndWorkNow = () => {
    const nowStr = getNowLocalDateTimeInput();
    if (draft.startWorkTime) {
      const dur = calculateDurationMinutes(draft.startWorkTime, nowStr);
      if (dur !== null && dur < 0) {
        setFormErrorBn(
          'কাজ শেষের সময় কাজ শুরুর সময়ের আগে হতে পারে না। অনুগ্রহ করে সঠিক সময় নির্বাচন করুন।'
        );
        return;
      }
    }
    setDraft((prev) => ({
      ...prev,
      endWorkTime: nowStr,
      workStatus: 'completed',
      // Note: Do NOT automatically mark wages as Settled when work is Completed!
    }));
    setFormErrorBn(null);
  };

  // Direct Start Work / End Work / Settlement toggle on existing Production History entries
  const handleQuickStartWorkOnEntry = (entry: ProductionEntry) => {
    const nowStr = getNowLocalDateTimeInput();
    const updated: ProductionEntry = {
      ...entry,
      startWorkTime: nowStr,
      workStatus: 'in_progress',
      workDurationMinutes: calculateDurationMinutes(nowStr, entry.endWorkTime),
    };
    onSaveEntry(updated);
    setStatusBannerBn(
      `"${entry.itemName}" এর কাজ শুরু হয়েছে (${formatWorkTimestampBn(nowStr)}) — স্ট্যাটাস: কাজ চলমান।`
    );
  };

  const handleQuickEndWorkOnEntry = (entry: ProductionEntry) => {
    const nowStr = getNowLocalDateTimeInput();
    const startRef = entry.startWorkTime || nowStr;
    const duration = calculateDurationMinutes(startRef, nowStr);
    if (duration !== null && duration < 0) {
      setStatusBannerBn(
        'ত্রুটি: কাজ শেষের সময় কাজ শুরুর সময়ের আগে হতে পারে না। সম্পাদনা ফর্মে সময় যাচাই করুন।'
      );
      return;
    }
    const updated: ProductionEntry = {
      ...entry,
      startWorkTime: startRef,
      endWorkTime: nowStr,
      workStatus: 'completed',
      workDurationMinutes: duration ?? 0,
      // Keep settlementStatus completely unchanged!
    };
    onSaveEntry(updated);
    setStatusBannerBn(
      `"${entry.itemName}" এর কাজ সম্পন্ন হয়েছে (${formatWorkTimestampBn(nowStr)})। মজুরি পরিশোধের অবস্থা অপরিবর্তিত রয়েছে।`
    );
  };

  const handleQuickToggleSettlementOnEntry = (entry: ProductionEntry) => {
    const nextSettlement: SettlementStatus =
      entry.settlementStatus === 'settled' ? 'pending' : 'settled';
    const earned = entry.totalWage ?? 0;
    const updated: ProductionEntry = {
      ...entry,
      settlementStatus: nextSettlement,
      receivedWage: nextSettlement === 'settled' ? earned : 0,
      pendingWage: nextSettlement === 'settled' ? 0 : earned,
    };
    onSaveEntry(updated);
    setStatusBannerBn(
      nextSettlement === 'settled'
        ? `"${entry.itemName}" এর মজুরি পরিশোধিত (Settled) হিসেবে চিহ্নিত হয়েছে।`
        : `"${entry.itemName}" এর মজুরি বকেয়া (Pending) হিসেবে চিহ্নিত হয়েছে।`
    );
  };

  const handleAddPhotos = (fileList: FileList) => {
    const filesArray = Array.from(fileList);
    const added: UploadedPhotoPreview[] = filesArray.map((file, idx) => ({
      id: `photo-${Date.now()}-${idx}`,
      fileName: file.name,
      fileSize: file.size,
      previewUrl: URL.createObjectURL(file),
      mimeType: file.type || 'image/jpeg',
    }));
    setDraft((prev) => ({
      ...prev,
      photos: [...prev.photos, ...added],
      rawFiles: [...prev.rawFiles, ...filesArray],
    }));
  };

  const handleRemovePhoto = (photoId: string) => {
    setDraft((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photoId),
    }));
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorBn(null);

    if (draft.startWorkTime && draft.endWorkTime) {
      const dur = calculateDurationMinutes(draft.startWorkTime, draft.endWorkTime);
      if (dur !== null && dur < 0) {
        setFormErrorBn(
          'অবৈধ সময়ক্রম: কাজ শেষের সময় (End Work) কখনোই কাজ শুরুর সময়ের (Start Work) আগে হতে পারে না।'
        );
        return;
      }
    }

    const finalItemName =
      draft.itemName === 'CUSTOM'
        ? draft.customItemName.trim() || 'পোশাক আইটেম'
        : draft.itemName;
    const finalCategory =
      draft.category === 'CUSTOM'
        ? draft.customCategory.trim() || 'সাধারণ ক্যাটাগরি'
        : draft.category;

    const cleanRecWage = toAsciiDigits(draft.receivedWage).trim();
    const explicitReceived =
      cleanRecWage && Number.isFinite(Number(cleanRecWage))
        ? Number(cleanRecWage)
        : draft.settlementStatus === 'settled'
        ? calculatedEarnedWage
        : 0;

    const finalSettlementStatus: SettlementStatus = draft.settlementStatus;
    const finalReceivedWage =
      finalSettlementStatus === 'settled' && explicitReceived === 0
        ? calculatedEarnedWage
        : explicitReceived;
    const finalPendingWage = Number(
      Math.max(0, calculatedEarnedWage - finalReceivedWage).toFixed(2)
    );

    const record: ProductionEntry = {
      id: draft.id ?? `prod-${Date.now()}`,
      date: draft.date || getTodayDDMMYYYY(false),
      itemName: finalItemName,
      category: finalCategory,
      garmentType: `${finalItemName} (${finalCategory})`,
      size: draft.selectedSizes.join(', '),
      sizes: draft.selectedSizes,
      color: draft.selectedColors.join(', '),
      colors: draft.selectedColors,
      pieces: parsedPieces,
      dozens: calculatedDozens,
      ratePerDozen: parsedRatePerDozen,
      totalWage: calculatedEarnedWage,
      receivedWage: finalReceivedWage,
      pendingWage: finalPendingWage,
      workStatus: draft.workStatus,
      settlementStatus: finalSettlementStatus,
      startWorkTime: draft.startWorkTime || null,
      endWorkTime: draft.endWorkTime || null,
      workDurationMinutes: calculatedDurationMinutes,
      shortDescription: draft.shortDescription.trim(),
      photos: draft.photos,
    };

    onSaveEntry(record, draft.rawFiles);
    setStatusBannerBn(
      draft.id
        ? 'প্রোডাকশন এন্ট্রি সফলভাবে আপডেট করা হয়েছে।'
        : 'নতুন প্রোডাকশন এন্ট্রি সংরক্ষিত হয়েছে।'
    );
    setDraft(createEmptyDraft());
    setIsFormModalOpen(false);
    setShowInlineForm(false);
  };

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      dateFrom: '',
      dateTo: '',
      itemName: 'ALL',
      category: 'ALL',
      size: 'ALL',
      color: 'ALL',
      workStatus: 'ALL',
      settlementStatus: 'ALL',
    });
  };

  // Distinct item names & categories from existing records + defaults
  const filterItemOptions = useMemo(() => {
    const dynamicItems = entries.map((e) => e.itemName).filter(Boolean);
    return Array.from(new Set([...GARMENT_ITEM_NAME_OPTIONS, ...dynamicItems]));
  }, [entries]);

  const filterCategoryOptions = useMemo(() => {
    const dynamicCats = entries.map((e) => e.category).filter(Boolean);
    return Array.from(new Set([...GARMENT_CATEGORY_OPTIONS, ...dynamicCats]));
  }, [entries]);

  // Filter and sort chronologically (newest entries at the top)
  const sortedFilteredEntries = useMemo(() => {
    const fromDt = parseAnyDateToDateObj(filters.dateFrom);
    const toDt = parseAnyDateToDateObj(filters.dateTo);
    const fromTime = fromDt
      ? new Date(fromDt.getFullYear(), fromDt.getMonth(), fromDt.getDate(), 0, 0, 0).getTime()
      : null;
    const toTime = toDt
      ? new Date(toDt.getFullYear(), toDt.getMonth(), toDt.getDate(), 23, 59, 59).getTime()
      : null;

    return entries
      .filter((entry) => {
        const entryDt = parseAnyDateToDateObj(entry.date);
        const entryTime = entryDt ? entryDt.getTime() : 0;

        if (fromTime !== null && entryTime < fromTime) return false;
        if (toTime !== null && entryTime > toTime) return false;

        if (
          filters.itemName !== 'ALL' &&
          entry.itemName !== filters.itemName &&
          entry.garmentType !== filters.itemName
        ) {
          return false;
        }
        if (filters.category !== 'ALL' && entry.category !== filters.category) {
          return false;
        }
        if (
          filters.size !== 'ALL' &&
          !entry.sizes?.includes(filters.size) &&
          !entry.size.includes(filters.size)
        ) {
          return false;
        }
        if (
          filters.color !== 'ALL' &&
          !entry.colors?.includes(filters.color) &&
          !entry.color.includes(filters.color)
        ) {
          return false;
        }
        if (filters.workStatus !== 'ALL' && entry.workStatus !== filters.workStatus) {
          return false;
        }
        if (
          filters.settlementStatus !== 'ALL' &&
          entry.settlementStatus !== filters.settlementStatus
        ) {
          return false;
        }

        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const haystack = `${entry.itemName} ${entry.category} ${entry.garmentType} ${entry.size} ${entry.color} ${entry.shortDescription} ${entry.date}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dtA = parseAnyDateToDateObj(a.date)?.getTime() ?? 0;
        const dtB = parseAnyDateToDateObj(b.date)?.getTime() ?? 0;
        if (dtB !== dtA) return dtB - dtA;
        const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return cB - cA;
      });
  }, [entries, filters]);

  // Daily and Date-Range Production Summaries
  const filteredSummary = useMemo(() => {
    const todayStr = getTodayDDMMYYYY(false);
    const todayEntries = entries.filter(
      (e) => toAsciiDigits(e.date) === toAsciiDigits(todayStr)
    );
    const todayPieces = todayEntries.reduce((s, e) => s + (e.pieces ?? 0), 0);
    const todayDozens = calculateDozensFromPieces(todayPieces);
    const todayEarned = todayEntries.reduce((s, e) => s + (e.totalWage ?? 0), 0);

    const rangePieces = sortedFilteredEntries.reduce((s, e) => s + (e.pieces ?? 0), 0);
    const rangeDozens = Number(
      sortedFilteredEntries
        .reduce(
          (s, e) => s + (e.dozens ?? calculateDozensFromPieces(e.pieces ?? 0)),
          0
        )
        .toFixed(4)
    );
    const rangeEarned = Number(
      sortedFilteredEntries.reduce((s, e) => s + (e.totalWage ?? 0), 0).toFixed(2)
    );
    const rangeReceived = Number(
      sortedFilteredEntries
        .reduce((s, e) => {
          if (e.receivedWage !== null && e.receivedWage !== undefined && e.receivedWage > 0) {
            return s + e.receivedWage;
          }
          if (e.settlementStatus === 'settled') return s + (e.totalWage ?? 0);
          return s;
        }, 0)
        .toFixed(2)
    );
    const rangePending = Number(Math.max(0, rangeEarned - rangeReceived).toFixed(2));

    return {
      todayPieces,
      todayDozens,
      todayEarned,
      rangePieces,
      rangeDozens,
      rangeEarned,
      rangeReceived,
      rangePending,
    };
  }, [entries, sortedFilteredEntries]);

  const renderStructuredForm = (isModalContext: boolean) => (
    <form onSubmit={handleSubmitForm} className="space-y-6">
      {formErrorBn && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 p-3.5 text-xs sm:text-sm font-medium text-rose-800 dark:text-rose-200">
          {formErrorBn}
        </div>
      )}

      {/* Section A: Production Information */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            বিভাগ ক: প্রোডাকশন তথ্য (Production Information)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            প্রোডাকশন তারিখ, পোশাক আইটেমের নাম এবং ক্যাটাগরি নির্বাচন করুন
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DateInputDDMMYYYY
            id={isModalContext ? 'modal-prod-date' : 'inline-prod-date'}
            labelBn="প্রোডাকশন তারিখ (DD-MM-YYYY)"
            valueDDMMYYYY={draft.date}
            onChangeDDMMYYYY={(val) => setDraft((prev) => ({ ...prev, date: val }))}
          />

          <div className="space-y-2">
            <FormSelect
              id={isModalContext ? 'modal-item-name' : 'inline-item-name'}
              labelBn="আইটেমের নাম (Item Name)"
              value={draft.itemName}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, itemName: e.target.value }))
              }
              options={[
                ...GARMENT_ITEM_NAME_OPTIONS.map((item) => ({
                  value: item,
                  labelBn: item,
                })),
                { value: 'CUSTOM', labelBn: '+ নতুন আইটেমের নাম লিখুন...' },
              ]}
            />
            {draft.itemName === 'CUSTOM' && (
              <FormInput
                id={isModalContext ? 'modal-custom-item' : 'inline-custom-item'}
                labelBn="নতুন আইটেমের নাম"
                placeholder="যেমন: কার্গো প্যান্ট পকেট জয়েন্ট"
                value={draft.customItemName}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, customItemName: e.target.value }))
                }
              />
            )}
          </div>

          <div className="space-y-2">
            <FormSelect
              id={isModalContext ? 'modal-category' : 'inline-category'}
              labelBn="ক্যাটাগরি (Category)"
              value={draft.category}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, category: e.target.value }))
              }
              options={[
                ...GARMENT_CATEGORY_OPTIONS.map((cat) => ({
                  value: cat,
                  labelBn: cat,
                })),
                { value: 'CUSTOM', labelBn: '+ নতুন ক্যাটাগরি লিখুন...' },
              ]}
            />
            {draft.category === 'CUSTOM' && (
              <FormInput
                id={isModalContext ? 'modal-custom-cat' : 'inline-custom-cat'}
                labelBn="নতুন ক্যাটাগরির নাম"
                placeholder="যেমন: সোয়েটার / জ্যাকেট"
                value={draft.customCategory}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, customCategory: e.target.value }))
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Section B: Size and Color (Multi-select + User-defined) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            বিভাগ খ: সাইজ ও রঙ (Size & Color — এক বা একাধিক নির্বাচনযোগ্য)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ট্যাপ করে এক বা একাধিক সাইজ ও রঙ নির্বাচন করুন অথবা নিজের মতো যোগ করুন
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Sizes */}
          <div className="space-y-2.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              সাইজ নির্বাচন ({draft.selectedSizes.join(', ')})
            </label>
            <div className="flex flex-wrap gap-2">
              {availableSizes.map((sz) => {
                const isSelected = draft.selectedSizes.includes(sz);
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => toggleSizeSelection(sz)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-700 dark:bg-teal-600 dark:border-teal-500'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={draft.customSizeInput}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, customSizeInput: e.target.value }))
                }
                placeholder="নতুন সাইজ (যেমন: 4XL, 32)"
                className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm"
              />
              <button
                type="button"
                onClick={handleAddCustomSize}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shrink-0 cursor-pointer"
              >
                + সাইজ যোগ
              </button>
            </div>
          </div>

          {/* Colors */}
          <div className="space-y-2.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              রঙ নির্বাচন ({draft.selectedColors.join(', ')})
            </label>
            <div className="flex flex-wrap gap-2">
              {availableColors.map((clr) => {
                const isSelected = draft.selectedColors.includes(clr);
                return (
                  <button
                    key={clr}
                    type="button"
                    onClick={() => toggleColorSelection(clr)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-700 dark:bg-teal-600 dark:border-teal-500'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {clr}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={draft.customColorInput}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, customColorInput: e.target.value }))
                }
                placeholder="নতুন রঙ (যেমন: স্কাই ব্লু)"
                className="flex-1 min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm"
              />
              <button
                type="button"
                onClick={handleAddCustomColor}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shrink-0 cursor-pointer"
              >
                + রঙ যোগ
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section C: Quantity and Wage Calculation */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            বিভাগ গ: পরিমাণ ও স্বয়ংক্রিয় মজুরি হিসাব (Quantity & Wage Calculation)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            সূত্র: ডজন = পিস ÷ ১২ · অর্জিত মজুরি = ডজন × প্রতি ডজনের দর (ঐতিহাসিক দর হিসেবে সংরক্ষিত থাকে)
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormInput
            id={isModalContext ? 'modal-pieces' : 'inline-pieces'}
            labelBn="পিস সংখ্যা (Quantity in Pieces)"
            type="text"
            inputMode="numeric"
            placeholder="যেমন: ১৪৪"
            rightUnitBn="পিস"
            value={draft.pieces}
            onChange={(e) => setDraft((prev) => ({ ...prev, pieces: e.target.value }))}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              স্বয়ংক্রিয় ডজন (Pieces ÷ 12)
            </label>
            <div className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm font-mono tabular-nums font-bold flex items-center justify-between">
              <span>{formatDozensBn(calculatedDozens)}</span>
              <span className="text-xs font-sans font-medium text-slate-500">ডজন</span>
            </div>
          </div>

          <FormInput
            id={isModalContext ? 'modal-rate' : 'inline-rate'}
            labelBn="প্রতি ডজনের দর (Rate per Dozen)"
            type="text"
            inputMode="decimal"
            placeholder="যেমন: ১২০.০০"
            rightUnitBn="৳/ডজন"
            value={draft.ratePerDozen}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, ratePerDozen: e.target.value }))
            }
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              স্বয়ংক্রিয় অর্জিত মজুরি (Earned Wage)
            </label>
            <div className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 text-sm font-mono tabular-nums font-bold flex items-center justify-between">
              <span>{formatTaka(calculatedEarnedWage, true)}</span>
              <span className="text-xs font-sans font-medium text-teal-700 dark:text-teal-400">
                মোট মজুরি
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
          <FormSelect
            id={isModalContext ? 'modal-settlement' : 'inline-settlement'}
            labelBn="মজুরি পরিশোধের অবস্থা (Wage Settlement Status — কাজ সম্পন্ন থেকে স্বাধীন)"
            value={draft.settlementStatus}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                settlementStatus: e.target.value as SettlementStatus,
              }))
            }
            options={[
              { value: 'pending', labelBn: 'মজুরি বকেয়া (Pending)' },
              { value: 'settled', labelBn: 'মজুরি পরিশোধিত (Settled)' },
            ]}
          />

          <FormInput
            id={isModalContext ? 'modal-received-wage' : 'inline-received-wage'}
            labelBn="প্রাপ্ত মজুরি (Received Wage — ঐচ্ছিক আংশিক বা পূর্ণ টাকা)"
            type="text"
            inputMode="decimal"
            placeholder="যেমন: ০.০০"
            rightUnitBn="৳"
            value={draft.receivedWage}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, receivedWage: e.target.value }))
            }
          />
        </div>
      </div>

      {/* Section D: Work Timing (Start Work, End Work, Duration, Work Status) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              বিভাগ ঘ: কাজের সময় নির্ধারণ (Work Timing — Start & End Work)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              বাটনে ক্লিক করে বর্তমান সময় রেকর্ড করুন অথবা ম্যানুয়ালি সম্পাদনা করুন
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFormStartWorkNow}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>কাজ শুরু (Start Work)</span>
            </button>
            <button
              type="button"
              onClick={handleFormEndWorkNow}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>কাজ শেষ (End Work)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor={isModalContext ? 'modal-start-time' : 'inline-start-time'}
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              কাজ শুরুর সময় (Start Work)
            </label>
            <input
              id={isModalContext ? 'modal-start-time' : 'inline-start-time'}
              type="datetime-local"
              value={draft.startWorkTime}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  startWorkTime: e.target.value,
                }))
              }
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={isModalContext ? 'modal-end-time' : 'inline-end-time'}
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              কাজ শেষের সময় (End Work)
            </label>
            <input
              id={isModalContext ? 'modal-end-time' : 'inline-end-time'}
              type="datetime-local"
              value={draft.endWorkTime}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  endWorkTime: e.target.value,
                }))
              }
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              মোট কাজের সময়কাল (Duration)
            </label>
            <div
              className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
                calculatedDurationMinutes !== null && calculatedDurationMinutes < 0
                  ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>{formatDurationBn(calculatedDurationMinutes)}</span>
            </div>
          </div>

          <FormSelect
            id={isModalContext ? 'modal-work-status' : 'inline-work-status'}
            labelBn="কাজের অবস্থা (Work Status)"
            value={draft.workStatus}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                workStatus: e.target.value as WorkStatus,
              }))
            }
            options={[
              { value: 'in_progress', labelBn: 'কাজ চলমান (In Progress — নীল)' },
              { value: 'completed', labelBn: 'কাজ সম্পন্ন (Completed)' },
            ]}
          />
        </div>
      </div>

      {/* Section E: Additional Information */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            বিভাগ ঙ: অতিরিক্ত তথ্য ও ছবি (Additional Information)
          </h3>
        </div>

        <FormTextarea
          id={isModalContext ? 'modal-notes' : 'inline-notes'}
          labelBn="নোট / সংক্ষিপ্ত বিবরণ (Notes)"
          placeholder="বায়ারের নাম, স্টাইল নম্বর, অপারেশন বা লট নম্বর লিখুন..."
          value={draft.shortDescription}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, shortDescription: e.target.value }))
          }
        />

        <MultiPhotoUpload
          photos={draft.photos}
          onAddPhotos={handleAddPhotos}
          onRemovePhoto={handleRemovePhoto}
        />
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            setDraft(createEmptyDraft());
            setFormErrorBn(null);
            if (isModalContext) setIsFormModalOpen(false);
          }}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
        >
          {isModalContext ? 'বাতিল করুন' : 'ফর্ম রিসেট করুন'}
        </button>
        <button
          type="submit"
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>
            {draft.id ? 'প্রোডাকশন তথ্য আপডেট করুন' : 'প্রোডাকশন এন্ট্রি সংরক্ষণ করুন'}
          </span>
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <PageHeader
        moduleIndexBn="০২. প্রধান মডিউল · প্রোডাকশন হিসাব"
        titleBn="প্রোডাকশন ইতিহাস ও কাজের সময় ট্র্যাকিং"
        subtitleBn="প্রতিদিনের সেলাইকৃত পোশাকের পিস, স্বয়ংক্রিয় ডজন ও মজুরি হিসাব, কাজ শুরু/শেষের সময় এবং স্বাধীন পরিশোধ স্ট্যাটাস"
        primaryActionLabelBn="নতুন প্রোডাকশন যোগ করুন"
        primaryActionIcon={<Plus className="w-4 h-4" />}
        onPrimaryAction={handleOpenAddModal}
        secondaryActionLabelBn={
          showInlineForm ? 'ফর্ম প্যানেল লুকান' : 'পাতার উপরে ফর্ম খুলুন'
        }
        secondaryActionIcon={<FilePlus2 className="w-4 h-4" />}
        onSecondaryAction={() => setShowInlineForm((prev) => !prev)}
      />

      {statusBannerBn && (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/40 px-4 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm text-teal-900 dark:text-teal-200">
          <span className="break-words">{statusBannerBn}</span>
          <button
            type="button"
            onClick={() => setStatusBannerBn(null)}
            className="text-xs font-semibold underline cursor-pointer shrink-0"
          >
            বন্ধ করুন
          </button>
        </div>
      )}

      {/* Daily & Date-Range Production Summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <SummaryCard
          titleBn="আজকের প্রোডাকশন ও মজুরি"
          amount={filteredSummary.todayEarned}
          subtitleBn={`আজ: ${toBengaliDigits(filteredSummary.todayPieces)} পিস (${formatDozensBn(
            filteredSummary.todayDozens
          )} ডজন)`}
          icon={<Scissors className="w-5 h-5" />}
          tone="accent"
        />
        <SummaryCard
          titleBn="তালিকাভুক্ত মোট প্রোডাকশন"
          amount={null}
          customValueBn={`${toBengaliDigits(
            filteredSummary.rangePieces
          )} পিস · ${formatDozensBn(filteredSummary.rangeDozens)} ডজন`}
          subtitleBn={`ফিল্টারকৃত এন্ট্রি: ${toBengaliDigits(
            sortedFilteredEntries.length
          )} টি`}
          icon={<Layers className="w-5 h-5" />}
          tone="default"
        />
        <SummaryCard
          titleBn="তালিকাভুক্ত মোট অর্জিত মজুরি"
          amount={filteredSummary.rangeEarned}
          subtitleBn={`প্রাপ্ত মজুরি: ${formatTaka(filteredSummary.rangeReceived, true)}`}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="positive"
        />
        <SummaryCard
          titleBn="তালিকাভুক্ত বকেয়া মজুরি"
          amount={filteredSummary.rangePending}
          subtitleBn="কাজ সম্পন্ন হলেও অপরিশোধিত বকেয়া"
          icon={<Wallet className="w-5 h-5" />}
          tone="warning"
        />
      </div>

      {/* Visual Status Legend */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          স্ট্যাটাস রঙের নির্দেশিকা (কাজের অবস্থা ও মজুরি পরিশোধ সম্পূর্ণ স্বাধীন):
        </span>
        <div className="flex flex-wrap items-center gap-4 text-slate-700 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-sky-500 inline-block" />
            <span>কাজ চলমান (In Progress — নীল)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
            <span>কাজ সম্পন্ন কিন্তু মজুরি বকেয়া (Pending — কমলা/হলুদ)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
            <span>মজুরি পরিশোধিত (Wage Settled — সবুজ)</span>
          </span>
        </div>
      </div>

      {/* Inline Structured Form (when toggled open) */}
      {showInlineForm && (
        <section
          aria-labelledby="production-form-heading"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
        >
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <h2
              id="production-form-heading"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              প্রোডাকশন এন্ট্রি ফর্ম (৫টি বিভাগে বিন্যস্ত)
            </h2>
          </div>
          {renderStructuredForm(false)}
        </section>
      )}

      {/* Search & Comprehensive Filters */}
      <section
        aria-label="প্রোডাকশন ফিল্টার ও অনুসন্ধান"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            অনুসন্ধান ও ফিল্টার (তারিখ পরিসর, আইটেম, ক্যাটাগরি, সাইজ, রঙ ও স্ট্যাটাস)
          </h2>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>রিসেট</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="space-y-1.5 sm:col-span-2">
            <label
              htmlFor="prod-search-input"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              অনুসন্ধান করুন
            </label>
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                id="prod-search-input"
                type="search"
                value={filters.searchQuery}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
                }
                placeholder="আইটেমের নাম, ক্যাটাগরি, নোট বা তারিখ খুঁজুন..."
                className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm"
              />
            </div>
          </div>

          {/* Date Range From */}
          <DateInputDDMMYYYY
            id="prod-filter-date-from"
            labelBn="শুরুর তারিখ (DD-MM-YYYY)"
            valueDDMMYYYY={filters.dateFrom}
            onChangeDDMMYYYY={(val) =>
              setFilters((prev) => ({ ...prev, dateFrom: val }))
            }
            placeholderBn="শুরুর তারিখ"
          />

          {/* Date Range To */}
          <DateInputDDMMYYYY
            id="prod-filter-date-to"
            labelBn="শেষের তারিখ (DD-MM-YYYY)"
            valueDDMMYYYY={filters.dateTo}
            onChangeDDMMYYYY={(val) =>
              setFilters((prev) => ({ ...prev, dateTo: val }))
            }
            placeholderBn="শেষের তারিখ"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <FormSelect
            id="prod-filter-item"
            labelBn="আইটেমের নাম"
            value={filters.itemName}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, itemName: e.target.value }))
            }
            options={[
              { value: 'ALL', labelBn: 'সকল আইটেম' },
              ...filterItemOptions.map((item) => ({ value: item, labelBn: item })),
            ]}
          />

          <FormSelect
            id="prod-filter-category"
            labelBn="ক্যাটাগরি"
            value={filters.category}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, category: e.target.value }))
            }
            options={[
              { value: 'ALL', labelBn: 'সকল ক্যাটাগরি' },
              ...filterCategoryOptions.map((cat) => ({ value: cat, labelBn: cat })),
            ]}
          />

          <FormSelect
            id="prod-filter-size"
            labelBn="সাইজ"
            value={filters.size}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, size: e.target.value }))
            }
            options={[
              { value: 'ALL', labelBn: 'সকল সাইজ' },
              ...availableSizes.map((sz) => ({ value: sz, labelBn: sz })),
            ]}
          />

          <FormSelect
            id="prod-filter-color"
            labelBn="রঙ"
            value={filters.color}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, color: e.target.value }))
            }
            options={[
              { value: 'ALL', labelBn: 'সকল রঙ' },
              ...availableColors.map((clr) => ({ value: clr, labelBn: clr })),
            ]}
          />

          <FormSelect
            id="prod-filter-work-status"
            labelBn="কাজের অবস্থা"
            value={filters.workStatus}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                workStatus: e.target.value as 'ALL' | WorkStatus,
              }))
            }
            options={[
              { value: 'ALL', labelBn: 'সকল কাজের অবস্থা' },
              { value: 'in_progress', labelBn: 'কাজ চলমান (In Progress)' },
              { value: 'completed', labelBn: 'কাজ সম্পন্ন (Completed)' },
            ]}
          />

          <FormSelect
            id="prod-filter-settlement-status"
            labelBn="মজুরি পরিশোধ স্ট্যাটাস"
            value={filters.settlementStatus}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                settlementStatus: e.target.value as 'ALL' | SettlementStatus,
              }))
            }
            options={[
              { value: 'ALL', labelBn: 'সকল পরিশোধ স্ট্যাটাস' },
              { value: 'pending', labelBn: 'মজুরি বকেয়া (Pending)' },
              { value: 'settled', labelBn: 'মজুরি পরিশোধিত (Settled)' },
            ]}
          />
        </div>
      </section>

      {/* Production History Section: Mobile Cards (< lg) + Desktop Table (>= lg) */}
      <section
        aria-labelledby="production-history-heading"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
      >
        <div className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2
              id="production-history-heading"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              প্রোডাকশন ইতিহাস (সর্বশেষ এন্ট্রি সবার উপরে)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              মোবাইলে কার্ড ভিউ এবং ডেস্কটপে বিস্তারিত টেবিল ভিউ
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন প্রোডাকশন যোগ করুন</span>
          </button>
        </div>

        {sortedFilteredEntries.length === 0 ? (
          <EmptyDataState
            titleBn="কোনো প্রোডাকশন ইতিহাস পাওয়া যায়নি"
            descriptionBn="নতুন প্রোডাকশন যোগ করুন বাটনে ক্লিক করে অথবা ডেটা ইমপোর্ট মডিউল থেকে আপনার Google Sheets / Excel ফাইল ইমপোর্ট করুন।"
            tableNameHint="production_entries"
            actionLabelBn="নতুন প্রোডাকশন যোগ করুন"
            onActionClick={handleOpenAddModal}
            icon={<Scissors className="w-6 h-6" />}
          />
        ) : (
          <>
            {/* Mobile & Tablet Responsive Cards View (< lg) — Zero Horizontal Overflow */}
            <div className="lg:hidden divide-y divide-slate-200 dark:divide-slate-800 p-3 sm:p-4 space-y-3">
              {sortedFilteredEntries.map((entry) => {
                const visual = getEntryVisualCardStyle(entry);
                return (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 transition-colors ${visual.cardBorderBg}`}
                  >
                    {/* Top Row: Date + Total Earned Wage */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          তারিখ: {formatDateDDMMYYYY(entry.date, true)}
                        </p>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 break-words mt-0.5">
                          {entry.itemName || entry.garmentType}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 break-words">
                          ক্যাটাগরি: {entry.category} · সাইজ: {entry.size} · রঙ: {entry.color}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                          {formatTaka(entry.totalWage, true)}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          দর: {formatTaka(entry.ratePerDozen, true)}/ডজন
                        </p>
                      </div>
                    </div>

                    {/* Quantities & Independent Statuses */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/70 text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block">
                          পরিমাণ (পিস ও ডজন):
                        </span>
                        <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          {toBengaliDigits(entry.pieces ?? 0)} পিস ·{' '}
                          {formatDozensBn(entry.dozens)} ডজন
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`block font-semibold ${visual.workTextColor}`}>
                          {visual.workLabelBn}
                        </span>
                        <span className={`block font-semibold ${visual.settlementTextColor}`}>
                          {visual.settlementLabelBn}
                        </span>
                      </div>
                    </div>

                    {/* Work Timing Information */}
                    <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 p-2.5 text-xs space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-slate-600 dark:text-slate-400">
                          শুরু: <strong className="font-mono">{formatWorkTimestampBn(entry.startWorkTime)}</strong>
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          শেষ: <strong className="font-mono">{formatWorkTimestampBn(entry.endWorkTime)}</strong>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span>কাজের সময়কাল: {formatDurationBn(entry.workDurationMinutes)}</span>
                        {entry.shortDescription && (
                          <span className="truncate max-w-[160px]">
                            নোট: {entry.shortDescription}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mobile Touch Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickStartWorkOnEntry(entry)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>কাজ শুরু</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickEndWorkOnEntry(entry)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Square className="w-3 h-3" />
                          <span>কাজ শেষ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleSettlementOnEntry(entry)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {entry.settlementStatus === 'settled'
                              ? 'বকেয়া করুন'
                              : 'পরিশোধিত করুন'}
                          </span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(entry)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>সম্পাদনা</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteEntry(entry.id)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>মুছুন</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Responsive Table View (>= lg) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <th className="py-3.5 px-4 whitespace-nowrap">তারিখ (DD-MM-YYYY)</th>
                    <th className="py-3.5 px-4">আইটেম ও ক্যাটাগরি</th>
                    <th className="py-3.5 px-4">সাইজ ও রঙ</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">পিস ও ডজন</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">দর ও অর্জিত মজুরি</th>
                    <th className="py-3.5 px-4">কাজের সময় (শুরু - শেষ)</th>
                    <th className="py-3.5 px-4">কাজের ও মজুরি স্ট্যাটাস</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">কার্যক্রম</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {sortedFilteredEntries.map((entry) => {
                    const visual = getEntryVisualCardStyle(entry);
                    return (
                      <tr
                        key={entry.id}
                        className={`transition-colors ${visual.cardBorderBg}`}
                      >
                        <td className="py-3.5 px-4 font-mono tabular-nums whitespace-nowrap text-slate-800 dark:text-slate-200 align-top">
                          {formatDateDDMMYYYY(entry.date, true)}
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            {entry.itemName || entry.garmentType}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {entry.category}
                            {entry.shortDescription ? ` · ${entry.shortDescription}` : ''}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300 align-top">
                          <p>সাইজ: {entry.size}</p>
                          <p className="text-slate-500 dark:text-slate-400">
                            রঙ: {entry.color}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums align-top whitespace-nowrap">
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            {toBengaliDigits(entry.pieces ?? 0)} পিস
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDozensBn(entry.dozens)} ডজন
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums align-top whitespace-nowrap">
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            {formatTaka(entry.totalWage, true)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            দর: {formatTaka(entry.ratePerDozen, true)}/ডজন
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs align-top">
                          <p className="text-slate-700 dark:text-slate-300 font-mono">
                            শুরু: {formatWorkTimestampBn(entry.startWorkTime)}
                          </p>
                          <p className="text-slate-700 dark:text-slate-300 font-mono">
                            শেষ: {formatWorkTimestampBn(entry.endWorkTime)}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                            সময়কাল: {formatDurationBn(entry.workDurationMinutes)}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs align-top">
                          <p className={`font-bold ${visual.workTextColor}`}>
                            {visual.workLabelBn}
                          </p>
                          <p className={`font-semibold mt-0.5 ${visual.settlementTextColor}`}>
                            {visual.settlementLabelBn}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap align-top">
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleQuickStartWorkOnEntry(entry)}
                                title="বর্তমান সময়ে কাজ শুরু রেকর্ড করুন"
                                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Play className="w-3 h-3" />
                                <span>শুরু</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickEndWorkOnEntry(entry)}
                                title="বর্তমান সময়ে কাজ শেষ রেকর্ড করুন"
                                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Square className="w-3 h-3" />
                                <span>শেষ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickToggleSettlementOnEntry(entry)}
                                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold cursor-pointer"
                              >
                                {entry.settlementStatus === 'settled'
                                  ? 'বকেয়া করুন'
                                  : 'পরিশোধিত'}
                              </button>
                            </div>
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(entry)}
                                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>সম্পাদনা</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteEntry(entry.id)}
                                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>মুছুন</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Modal Form for Add / Edit Production Entry */}
      <ModalDrawer
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        titleBn={
          draft.id ? 'প্রোডাকশন এন্ট্রি সম্পাদনা করুন' : 'নতুন প্রোডাকশন যোগ করুন'
        }
        subtitleBn="৫টি যৌক্তিক বিভাগে প্রোডাকশন তথ্য, সাইজ/রঙ, স্বয়ংক্রিয় ডজন ও মজুরি এবং কাজের সময় নির্ধারণ"
        maxWidthClass="max-w-3xl"
      >
        {renderStructuredForm(true)}
      </ModalDrawer>
    </div>
  );
};
