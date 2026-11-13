import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  Eye,
  Filter,
  Image as ImageIcon,
  Mic,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  ShieldAlert,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  GARMENT_CATEGORY_OPTIONS,
  GARMENT_COLOR_OPTIONS,
  GARMENT_SIZE_OPTIONS,
} from '../config/navigation';
import { ExtractedVoiceProductionData } from '../services/voiceEntryService';
import {
  PaymentWithdrawalRecord,
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
import { AiVoiceEntryModal } from '../components/ui/AiVoiceEntryModal';
import { AnalogClockTimePicker } from '../components/ui/AnalogClockTimePicker';
import { EmptyDataState } from '../components/ui/EmptyDataState';
import {
  DateInputDDMMYYYY,
  FormInput,
  FormSelect,
  FormTextarea,
  MultiPhotoUpload,
} from '../components/ui/FormFields';
import { ModalDrawer } from '../components/ui/ModalDrawer';

export interface ProductionLedgerPageProps {
  entries: ProductionEntry[];
  withdrawals?: PaymentWithdrawalRecord[];
  onSaveEntry: (
    entry: ProductionEntry,
    rawFiles?: File[]
  ) => Promise<{ persistedToCloud: boolean; errorBn: string | null }>;
  onDeleteEntry: (id: string) => Promise<void> | void;
  onSaveWithdrawal?: (withdrawal: PaymentWithdrawalRecord) => void;
  onDeleteWithdrawal?: (id: string) => void;
}

interface ProductionFormDraft {
  id: string | null;
  date: string;
  itemName: string; // Pure user-entered text input, empty by default
  category: string; // One of the 4 preset categories ('কটি' | 'গোলগোলা' | 'শার্ট' | 'প্যান্ট'), empty by default
  selectedSizes: string[]; // Selected from the 11 preset sizes, empty by default
  selectedColors: string[];
  customColorInput: string;
  pieces: string;
  dozensInput: string;
  ratePerDozen: string;
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
    itemName: '',
    category: '',
    selectedSizes: [],
    selectedColors: [],
    customColorInput: '',
    pieces: '',
    dozensInput: '',
    ratePerDozen: '',
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
 * - Work Status:
 *   - কাজ চলছে (Blue)
 *   - কাজ সম্পন্ন
 * - Rate Settlement Status:
 *   - রেট নিষ্পত্তি হয়নি (Amber / Orange)
 *   - নিষ্পত্তি হয়েছে (Green)
 */
function getEntryVisualCardStyle(entry: ProductionEntry): {
  cardBorderBg: string;
  workLabelBn: string;
  workTextColor: string;
  settlementLabelBn: string;
  settlementTextColor: string;
} {
  const isWorkCompleted = entry.workStatus === 'completed';
  const isRateSettled = entry.settlementStatus === 'settled';

  const workLabelBn = isWorkCompleted ? 'কাজ সম্পন্ন' : 'কাজ চলছে';
  const workTextColor = isWorkCompleted
    ? 'text-slate-700 dark:text-slate-300'
    : 'text-sky-700 dark:text-sky-300';

  const settlementLabelBn = isRateSettled
    ? 'নিষ্পত্তি হয়েছে'
    : 'রেট নিষ্পত্তি হয়নি';
  const settlementTextColor = isRateSettled
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-rose-700 dark:text-rose-400';

  if (isRateSettled) {
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
    // Completed but Rate Pending -> Soft Amber/Orange
    return {
      cardBorderBg:
        'border-amber-200 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/25',
      workLabelBn,
      workTextColor: 'text-amber-700 dark:text-amber-300',
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
  withdrawals = [],
  onSaveEntry,
  onDeleteEntry,
  onSaveWithdrawal,
  onDeleteWithdrawal,
}) => {
  const [ledgerTab, setLedgerTab] = useState<'all' | 'production' | 'withdrawals'>('all');
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [withdrawalDraft, setWithdrawalDraft] = useState({
    id: '',
    date: getTodayDDMMYYYY(),
    amount: '4000',
    paymentMethod: 'নগদ (Cash)',
    voucherNo: '',
    remarks: 'মজুরি উত্তোলন',
  });

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

  const [availableColors, setAvailableColors] =
    useState<string[]>(GARMENT_COLOR_OPTIONS);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [draft, setDraft] = useState<ProductionFormDraft>(createEmptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrorBn, setFormErrorBn] = useState<string | null>(null);
  const [statusBannerBn, setStatusBannerBn] = useState<string | null>(null);

  // Secure delete confirmation state (prevents accidental single-touch delete)
  const [entryPendingDelete, setEntryPendingDelete] =
    useState<ProductionEntry | null>(null);
  const [deleteSafetyChecked, setDeleteSafetyChecked] = useState(false);
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);

  // Full-size photo preview modal state
  const [previewPhotoModal, setPreviewPhotoModal] = useState<{
    url: string;
    title: string;
    subtitle: string;
  } | null>(null);

  // Automatic calculation:
  // Dozens = Pieces / 12 (or Pieces = Dozens * 12)
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

  const handlePiecesChange = (val: string) => {
    const clean = toAsciiDigits(val).trim();
    const num = Number(clean);
    const nextDozens =
      clean && Number.isFinite(num) && num >= 0
        ? String(calculateDozensFromPieces(Math.round(num)))
        : '';
    setDraft((prev) => ({
      ...prev,
      pieces: val,
      dozensInput: nextDozens,
    }));
  };

  const handleDozensChange = (val: string) => {
    const clean = toAsciiDigits(val).trim();
    const num = Number(clean);
    const nextPieces =
      clean && Number.isFinite(num) && num >= 0
        ? String(Math.round(num * 12))
        : '';
    setDraft((prev) => ({
      ...prev,
      dozensInput: val,
      pieces: nextPieces,
    }));
  };

  const handleOpenAddModal = () => {
    setFormErrorBn(null);
    setDraft(createEmptyDraft());
    setIsFormModalOpen(true);
  };

  const handleOpenVoiceEntry = () => {
    setFormErrorBn(null);
    setIsVoiceModalOpen(true);
  };

  const handleApplyVoiceDataToForm = (extracted: ExtractedVoiceProductionData) => {
    setDraft((prev) => {
      const nextPieces =
        extracted.pieces !== null && extracted.pieces > 0
          ? String(extracted.pieces)
          : prev.pieces;
      const nextDozens =
        extracted.dozens !== null && extracted.dozens > 0
          ? String(extracted.dozens)
          : prev.dozensInput;

      return {
        ...prev,
        date: extracted.date || prev.date || getTodayDDMMYYYY(false),
        itemName: extracted.itemName || prev.itemName,
        category: extracted.category || prev.category,
        selectedSizes:
          extracted.sizes.length > 0 ? extracted.sizes : prev.selectedSizes,
        selectedColors: extracted.color
          ? [extracted.color]
          : prev.selectedColors,
        pieces: nextPieces,
        dozensInput: nextDozens,
        ratePerDozen:
          extracted.ratePerDozen !== null && extracted.ratePerDozen > 0
            ? String(extracted.ratePerDozen)
            : prev.ratePerDozen,
        shortDescription:
          extracted.notes ||
          prev.shortDescription ||
          (extracted.transcript ? `ভয়েস নোট: ${extracted.transcript}` : ''),
      };
    });

    if (!isFormModalOpen && !showInlineForm) {
      setIsFormModalOpen(true);
    }

    setStatusBannerBn(
      extracted.missingFieldsBn.length > 0
        ? `ভয়েস থেকে তথ্য ফর্মে বসানো হয়েছে। অনুগ্রহ করে অনুপস্থিত তথ্য (${extracted.missingFieldsBn.join(
            ', '
          )}) যাচাই করে "সংরক্ষণ করুন" বাটনে ট্যাপ করুন।`
        : 'ভয়েস থেকে সকল প্রোডাকশন তথ্য সফলভাবে ফর্মে বসানো হয়েছে। যাচাই করে "সংরক্ষণ করুন" বাটনে ট্যাপ করুন।'
    );
  };

  const handleOpenEditModal = (entry: ProductionEntry) => {
    setFormErrorBn(null);
    const sizesList =
      entry.sizes && entry.sizes.length > 0
        ? entry.sizes.map((s) => toBengaliDigits(s.trim()))
        : entry.size
        ? entry.size
            .split(',')
            .map((s) => toBengaliDigits(s.trim()))
            .filter(Boolean)
        : [];
    const colorsList =
      entry.colors && entry.colors.length > 0
        ? entry.colors
        : entry.color
        ? entry.color
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
        : [];

    if (colorsList.length > 0) {
      setAvailableColors((prev) => Array.from(new Set([...prev, ...colorsList])));
    }

    setDraft({
      id: entry.id,
      date: entry.date,
      itemName: entry.itemName || '',
      category: entry.category || '',
      selectedSizes: sizesList,
      selectedColors: colorsList,
      customColorInput: '',
      pieces: entry.pieces !== null ? String(entry.pieces) : '',
      dozensInput: entry.dozens !== null ? String(entry.dozens) : '',
      ratePerDozen: entry.ratePerDozen !== null ? String(entry.ratePerDozen) : '',
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

  // Toggle multi-size from the 11 preset sizes
  const toggleSizeSelection = (sizeVal: string) => {
    setDraft((prev) => {
      const exists = prev.selectedSizes.includes(sizeVal);
      const next = exists
        ? prev.selectedSizes.filter((s) => s !== sizeVal)
        : [...prev.selectedSizes, sizeVal];
      return {
        ...prev,
        selectedSizes: next,
      };
    });
  };

  const toggleColorSelection = (colorVal: string) => {
    setDraft((prev) => {
      const exists = prev.selectedColors.includes(colorVal);
      const next = exists
        ? prev.selectedColors.filter((c) => c !== colorVal)
        : [...prev.selectedColors, colorVal];
      return {
        ...prev,
        selectedColors: next,
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
      // Do NOT automatically mark rate settlement as settled when work is completed!
    }));
    setFormErrorBn(null);
  };

  // Direct Start Work / End Work / Rate Settlement toggle on existing Production History entries
  const handleQuickStartWorkOnEntry = async (entry: ProductionEntry) => {
    const nowStr = getNowLocalDateTimeInput();
    const updated: ProductionEntry = {
      ...entry,
      startWorkTime: nowStr,
      workStatus: 'in_progress',
      workDurationMinutes: calculateDurationMinutes(nowStr, entry.endWorkTime),
    };
    const res = await onSaveEntry(updated);
    setStatusBannerBn(
      res.errorBn
        ? res.errorBn
        : `"${entry.itemName}" এর কাজ শুরু হয়েছে (${formatWorkTimestampBn(nowStr)}) — কাজের অবস্থা: কাজ চলছে।`
    );
  };

  const handleQuickEndWorkOnEntry = async (entry: ProductionEntry) => {
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
    };
    const res = await onSaveEntry(updated);
    setStatusBannerBn(
      res.errorBn
        ? res.errorBn
        : `"${entry.itemName}" এর কাজ সম্পন্ন হয়েছে (${formatWorkTimestampBn(nowStr)})। রেট নিষ্পত্তি স্ট্যাটাস অপরিবর্তিত রয়েছে।`
    );
  };

  const handleQuickToggleSettlementOnEntry = async (entry: ProductionEntry) => {
    const nextSettlement: SettlementStatus =
      entry.settlementStatus === 'settled' ? 'pending' : 'settled';
    const earned = entry.totalWage ?? 0;
    const updated: ProductionEntry = {
      ...entry,
      settlementStatus: nextSettlement,
      receivedWage: nextSettlement === 'settled' ? earned : 0,
      pendingWage: nextSettlement === 'settled' ? 0 : earned,
    };
    const res = await onSaveEntry(updated);
    setStatusBannerBn(
      res.errorBn
        ? res.errorBn
        : nextSettlement === 'settled'
        ? `"${entry.itemName}" এর রেট নিষ্পত্তি স্ট্যাটাস "নিষ্পত্তি হয়েছে" হিসেবে সংরক্ষিত হয়েছে।`
        : `"${entry.itemName}" এর রেট নিষ্পত্তি স্ট্যাটাস "রেট নিষ্পত্তি হয়নি" হিসেবে সংরক্ষিত হয়েছে।`
    );
  };

  const compressFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const resultStr = typeof reader.result === 'string' ? reader.result : '';
        if (!resultStr) {
          resolve(URL.createObjectURL(file));
          return;
        }
        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 720;
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/jpeg', 0.75);
              resolve(compressed);
              return;
            }
          } catch {
            // fallback to raw data URL
          }
          resolve(resultStr);
        };
        img.onerror = () => resolve(resultStr);
        img.src = resultStr;
      };
      reader.onerror = () => resolve(URL.createObjectURL(file));
      reader.readAsDataURL(file);
    });
  };

  const handleAddPhotos = async (fileList: FileList) => {
    const filesArray = Array.from(fileList);
    const dataUrls = await Promise.all(filesArray.map(compressFileToDataUrl));
    const added: UploadedPhotoPreview[] = filesArray.map((file, idx) => ({
      id: `photo-${Date.now()}-${idx}`,
      fileName: file.name,
      fileSize: file.size,
      previewUrl: dataUrls[idx],
      storagePath: dataUrls[idx],
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

  const handleRequestSecureDelete = (entry: ProductionEntry) => {
    setEntryPendingDelete(entry);
    setDeleteSafetyChecked(false);
  };

  const handleConfirmSecureDelete = async () => {
    if (!entryPendingDelete || !deleteSafetyChecked || isDeletingEntry) return;
    setIsDeletingEntry(true);
    try {
      await onDeleteEntry(entryPendingDelete.id);
      setStatusBannerBn(
        `"${entryPendingDelete.itemName || entryPendingDelete.garmentType}" (${formatDateDDMMYYYY(
          entryPendingDelete.date,
          true
        )}) এন্ট্রিটি মুছে ফেলা হয়েছে।`
      );
      setEntryPendingDelete(null);
      setDeleteSafetyChecked(false);
    } finally {
      setIsDeletingEntry(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setFormErrorBn(null);

    const finalItemName = draft.itemName.trim();
    if (!finalItemName) {
      setFormErrorBn('অনুগ্রহ করে আইটেমের নাম লিখুন (যেমন: বাচ্চাদের গোলগোলা, হাফ হাতা শার্ট)।');
      return;
    }

    if (!draft.category) {
      setFormErrorBn('অনুগ্রহ করে ৪টি অপশন (কটি, গোলগোলা, শার্ট, প্যান্ট) থেকে একটি ক্যাটাগরি নির্বাচন করুন।');
      return;
    }

    if (draft.selectedSizes.length === 0) {
      setFormErrorBn('অনুগ্রহ করে অন্তত একটি সাইজ (১৪–৩২) নির্বাচন করুন।');
      return;
    }

    if (parsedPieces <= 0) {
      setFormErrorBn('অনুগ্রহ করে পিস অথবা ডজন সংখ্যা প্রদান করুন।');
      return;
    }

    if (draft.startWorkTime && draft.endWorkTime) {
      const dur = calculateDurationMinutes(draft.startWorkTime, draft.endWorkTime);
      if (dur !== null && dur < 0) {
        setFormErrorBn(
          'অবৈধ সময়ক্রম: কাজ শেষের সময় (End Work) কখনোই কাজ শুরুর সময়ের (Start Work) আগে হতে পারে না।'
        );
        return;
      }
    }

    const finalSettlementStatus: SettlementStatus = draft.settlementStatus;
    const finalReceivedWage =
      finalSettlementStatus === 'settled' ? calculatedEarnedWage : 0;
    const finalPendingWage =
      finalSettlementStatus === 'settled' ? 0 : calculatedEarnedWage;

    const record: ProductionEntry = {
      id: draft.id ?? `prod-${Date.now()}`,
      date: draft.date || getTodayDDMMYYYY(false),
      itemName: finalItemName,
      category: draft.category,
      garmentType: `${finalItemName} (${draft.category})`,
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

    setIsSaving(true);
    try {
      const saveResult = await onSaveEntry(record, draft.rawFiles);
      if (saveResult.errorBn && !saveResult.persistedToCloud) {
        setStatusBannerBn(
          `প্রোডাকশন এন্ট্রি সংরক্ষিত হয়েছে। নোট: ${saveResult.errorBn}`
        );
      } else {
        setStatusBannerBn(
          draft.id
            ? 'প্রোডাকশন এন্ট্রি সফলভাবে সুপাবেস ডাটাবেসে আপডেট করা হয়েছে।'
            : 'নতুন প্রোডাকশন এন্ট্রি সফলভাবে সুপাবেস ডাটাবেসে সংরক্ষিত হয়েছে।'
        );
      }
      setDraft(createEmptyDraft());
      setIsFormModalOpen(false);
      setShowInlineForm(false);
    } finally {
      setIsSaving(false);
    }
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

  // Distinct item names from existing user records for filter dropdown
  const filterItemOptions = useMemo(() => {
    const dynamicItems = entries.map((e) => e.itemName).filter(Boolean);
    return Array.from(new Set(dynamicItems));
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
      ? new Date(
          fromDt.getFullYear(),
          fromDt.getMonth(),
          fromDt.getDate(),
          0,
          0,
          0
        ).getTime()
      : null;
    const toTime = toDt
      ? new Date(
          toDt.getFullYear(),
          toDt.getMonth(),
          toDt.getDate(),
          23,
          59,
          59
        ).getTime()
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
          const haystack =
            `${entry.itemName} ${entry.category} ${entry.garmentType} ${entry.size} ${entry.color} ${entry.shortDescription} ${entry.date}`.toLowerCase();
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

  const sortedFilteredWithdrawals = useMemo(() => {
    const fromDt = parseAnyDateToDateObj(filters.dateFrom);
    const toDt = parseAnyDateToDateObj(filters.dateTo);
    const fromTime = fromDt
      ? new Date(
          fromDt.getFullYear(),
          fromDt.getMonth(),
          fromDt.getDate(),
          0,
          0,
          0
        ).getTime()
      : null;
    const toTime = toDt
      ? new Date(
          toDt.getFullYear(),
          toDt.getMonth(),
          toDt.getDate(),
          23,
          59,
          59
        ).getTime()
      : null;

    return (withdrawals || [])
      .filter((w) => {
        const dt = parseAnyDateToDateObj(w.date);
        const time = dt ? dt.getTime() : 0;
        if (fromTime !== null && time < fromTime) return false;
        if (toTime !== null && time > toTime) return false;
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const haystack = `${w.voucherNo} ${w.paymentMethod} ${w.remarks} ${w.date}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dtA = parseAnyDateToDateObj(a.date)?.getTime() ?? 0;
        const dtB = parseAnyDateToDateObj(b.date)?.getTime() ?? 0;
        return dtB - dtA;
      });
  }, [withdrawals, filters.dateFrom, filters.dateTo, filters.searchQuery]);

  type UnifiedLedgerFeedItem =
    | { kind: 'production'; entry: ProductionEntry; timestamp: number }
    | { kind: 'withdrawal'; record: PaymentWithdrawalRecord; timestamp: number };

  const unifiedLedgerFeed = useMemo((): UnifiedLedgerFeedItem[] => {
    if (ledgerTab === 'production') {
      return sortedFilteredEntries.map((entry) => ({
        kind: 'production',
        entry,
        timestamp: parseAnyDateToDateObj(entry.date)?.getTime() ?? 0,
      }));
    }
    if (ledgerTab === 'withdrawals') {
      return sortedFilteredWithdrawals.map((record) => ({
        kind: 'withdrawal',
        record,
        timestamp: parseAnyDateToDateObj(record.date)?.getTime() ?? 0,
      }));
    }
    const prods: UnifiedLedgerFeedItem[] = sortedFilteredEntries.map((entry) => ({
      kind: 'production',
      entry,
      timestamp: parseAnyDateToDateObj(entry.date)?.getTime() ?? 0,
    }));
    const withds: UnifiedLedgerFeedItem[] = sortedFilteredWithdrawals.map((record) => ({
      kind: 'withdrawal',
      record,
      timestamp: parseAnyDateToDateObj(record.date)?.getTime() ?? 0,
    }));
    return [...prods, ...withds].sort((a, b) => b.timestamp - a.timestamp);
  }, [ledgerTab, sortedFilteredEntries, sortedFilteredWithdrawals]);

  // Daily and Date-Range Production Summaries
  const filteredSummary = useMemo(() => {
    const todayStr = getTodayDDMMYYYY(false);
    const todayEntries = entries.filter(
      (e) => toAsciiDigits(e.date) === toAsciiDigits(todayStr)
    );
    const todayPieces = todayEntries.reduce((s, e) => s + (e.pieces ?? 0), 0);
    const todayDozens = calculateDozensFromPieces(todayPieces);
    const todayEarned = todayEntries.reduce((s, e) => s + (e.totalWage ?? 0), 0);

    const rangePieces = sortedFilteredEntries.reduce(
      (s, e) => s + (e.pieces ?? 0),
      0
    );
    const rangeDozens = Number(
      sortedFilteredEntries
        .reduce(
          (s, e) => s + (e.dozens ?? calculateDozensFromPieces(e.pieces ?? 0)),
          0
        )
        .toFixed(4)
    );
    const rangeEarned = Number(
      sortedFilteredEntries
        .reduce((s, e) => s + (e.totalWage ?? 0), 0)
        .toFixed(2)
    );
    const rangeSettled = Number(
      sortedFilteredEntries
        .reduce((s, e) => {
          if (e.settlementStatus === 'settled') return s + (e.totalWage ?? 0);
          return s;
        }, 0)
        .toFixed(2)
    );
    const rangeUnsettled = Number(
      Math.max(0, rangeEarned - rangeSettled).toFixed(2)
    );

    return {
      todayPieces,
      todayDozens,
      todayEarned,
      rangePieces,
      rangeDozens,
      rangeEarned,
      rangeSettled,
      rangeUnsettled,
    };
  }, [entries, sortedFilteredEntries]);

  const renderStructuredForm = (isModalContext: boolean) => (
    <form onSubmit={handleSubmitForm} className="space-y-6">
      {/* AI Voice Quick Banner inside Form */}
      <div className="rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/40 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs sm:text-sm font-bold text-teal-950 dark:text-teal-100 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <span>এআই ভয়েস এন্ট্রি (AI Voice Entry)</span>
          </p>
          <p className="text-xs text-teal-800 dark:text-teal-300">
            টাইপ করার বদলে মুখে বলুন: &ldquo;আজকে কটি, সাইজ ২৪, ২৫ ডজন কাজ করেছি, প্রতি ডজন ৩৫ টাকা রেট&rdquo;
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenVoiceEntry}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Mic className="w-4 h-4" />
          <span>ভয়েস দিয়ে পূরণ করুন</span>
        </button>
      </div>

      {formErrorBn && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 p-3.5 text-xs sm:text-sm font-medium text-rose-800 dark:text-rose-200">
          {formErrorBn}
        </div>
      )}

      {/* Section A: Production Information (Date, Custom Item Name, 4 Preset Categories) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            বিভাগ ক: প্রোডাকশন তথ্য (তারিখ, আইটেমের নাম ও ক্যাটাগরি)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            আইটেমের নাম নিজে লিখুন এবং নিচের ৪টি ক্যাটাগরি থেকে সঠিকটি নির্বাচন করুন
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DateInputDDMMYYYY
            id={isModalContext ? 'modal-prod-date' : 'inline-prod-date'}
            labelBn="প্রোডাকশন তারিখ (DD-MM-YYYY)"
            valueDDMMYYYY={draft.date}
            onChangeDDMMYYYY={(val) =>
              setDraft((prev) => ({ ...prev, date: val }))
            }
          />

          <FormInput
            id={isModalContext ? 'modal-item-name' : 'inline-item-name'}
            labelBn="আইটেমের নাম (বাংলা বা ইংরেজিতে লিখুন)"
            type="text"
            placeholder="যেমন: বাচ্চাদের গোলগলা / Half Sleeve T-Shirt"
            value={draft.itemName}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, itemName: e.target.value }))
            }
          />
        </div>

        {/* 4 Preset Categories Only: কটি, গোলগোলা, শার্ট, প্যান্ট */}
        <div className="space-y-2 pt-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            ক্যাটাগরি নির্বাচন করুন {draft.category ? `(${draft.category})` : '(যেকোনো ১টি নির্বাচন করুন)'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {GARMENT_CATEGORY_OPTIONS.map((cat) => {
              const isSelected = draft.category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      category: prev.category === cat ? '' : cat,
                    }))
                  }
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-teal-700 text-white border-teal-700 dark:bg-teal-600 dark:border-teal-500 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section B: Preset Sizes (14-32) and Color */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            বিভাগ খ: সাইজ ও রঙ নির্বাচন
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ট্যাপ করে এক বা একাধিক সাইজ (১৪–৩২) এবং পোশাকের রঙ নির্বাচন করুন
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* 11 Preset Sizes: ১৪, ১৬, ১৮, ২০, ২২, ২৪, ২৬, ২৮, ৩০, ৩১, ৩২ */}
          <div className="space-y-2.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              সাইজ নির্বাচন করুন{' '}
              {draft.selectedSizes.length > 0
                ? `(${draft.selectedSizes.join(', ')})`
                : '(এক বা একাধিক)'}
            </label>
            <div className="flex flex-wrap gap-2">
              {GARMENT_SIZE_OPTIONS.map((sz) => {
                const isSelected = draft.selectedSizes.includes(sz);
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => toggleSizeSelection(sz)}
                    className={`min-h-[40px] min-w-[46px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-700 dark:bg-teal-600 dark:border-teal-500 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colors */}
          <div className="space-y-2.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              রঙ নির্বাচন (ঐচ্ছিক){' '}
              {draft.selectedColors.length > 0
                ? `(${draft.selectedColors.join(', ')})`
                : ''}
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
                  setDraft((prev) => ({
                    ...prev,
                    customColorInput: e.target.value,
                  }))
                }
                placeholder="নতুন রঙ লিখুন (যেমন: স্কাই ব্লু)"
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

      {/* Section C: Quantity, Rate per Dozen, Automatic Wage & Rate Settlement Status */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            বিভাগ গ: পরিমাণ, প্রতি ডজনের দর ও স্বয়ংক্রিয় মজুরি হিসাব
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            পিস অথবা ডজন লিখলে অপরটি স্বয়ংক্রিয়ভাবে হিসাব হবে (১ ডজন = ১২ পিস) এবং মোট মজুরি = ডজন × দর
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormInput
            id={isModalContext ? 'modal-pieces' : 'inline-pieces'}
            labelBn="পিস সংখ্যা (Pieces)"
            type="text"
            inputMode="numeric"
            placeholder="যেমন: ৩০০"
            rightUnitBn="পিস"
            value={draft.pieces}
            onChange={(e) => handlePiecesChange(e.target.value)}
          />

          <FormInput
            id={isModalContext ? 'modal-dozens' : 'inline-dozens'}
            labelBn="ডজন সংখ্যা (Pieces ÷ 12)"
            type="text"
            inputMode="decimal"
            placeholder="যেমন: ২৫"
            rightUnitBn="ডজন"
            value={draft.dozensInput}
            onChange={(e) => handleDozensChange(e.target.value)}
          />

          <FormInput
            id={isModalContext ? 'modal-rate' : 'inline-rate'}
            labelBn="প্রতি ডজনের দর (Rate per Dozen)"
            type="text"
            inputMode="decimal"
            placeholder="যেমন: ৩৫"
            rightUnitBn="৳/ডজন"
            value={draft.ratePerDozen}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, ratePerDozen: e.target.value }))
            }
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              স্বয়ংক্রিয় অর্জিত মজুরি (মোট মজুরি)
            </label>
            <div className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 text-sm font-mono tabular-nums font-bold flex items-center justify-between">
              <span>{formatTaka(calculatedEarnedWage, true)}</span>
              <span className="text-xs font-sans font-medium text-teal-700 dark:text-teal-400">
                {formatDozensBn(calculatedDozens)} ডজন
              </span>
            </div>
          </div>
        </div>

        {/* Rate Settlement Status (Renamed from Wage Settlement Status; "প্রাপ্ত মজুরি" removed) */}
        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
          <FormSelect
            id={isModalContext ? 'modal-settlement' : 'inline-settlement'}
            labelBn="রেট নিষ্পত্তি স্ট্যাটাস (কাজের অবস্থা থেকে সম্পূর্ণ স্বাধীন)"
            value={draft.settlementStatus}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                settlementStatus: e.target.value as SettlementStatus,
              }))
            }
            options={[
              { value: 'pending', labelBn: 'রেট নিষ্পত্তি হয়নি' },
              { value: 'settled', labelBn: 'নিষ্পত্তি হয়েছে' },
            ]}
          />
        </div>
      </div>

      {/* Section D: Work Timing (Analog Clock Time Picker for Start Work & End Work) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              বিভাগ ঘ: কাজের সময় নির্ধারণ (অ্যানালগ ঘড়ি ও কাজের অবস্থা)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ঘড়ির কাঁটা ঘুরিয়ে ঘণ্টা ও মিনিট (AM/PM) নির্বাচন করুন অথবা সরাসরি বর্তমান সময় নিন
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFormStartWorkNow}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>এখন কাজ শুরু</span>
            </button>
            <button
              type="button"
              onClick={handleFormEndWorkNow}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>এখন কাজ শেষ</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnalogClockTimePicker
            id={isModalContext ? 'modal-start-time' : 'inline-start-time'}
            labelBn="কাজ শুরুর সময় (Start Work)"
            valueDateTimeLocal={draft.startWorkTime}
            defaultDateDDMMYYYY={draft.date}
            onChangeDateTimeLocal={(val) =>
              setDraft((prev) => ({
                ...prev,
                startWorkTime: val,
              }))
            }
            placeholderBn="শুরুর সময় (ঘড়ি খুলুন)"
          />

          <AnalogClockTimePicker
            id={isModalContext ? 'modal-end-time' : 'inline-end-time'}
            labelBn="কাজ শেষের সময় (End Work)"
            valueDateTimeLocal={draft.endWorkTime}
            defaultDateDDMMYYYY={draft.date}
            onChangeDateTimeLocal={(val) =>
              setDraft((prev) => ({
                ...prev,
                endWorkTime: val,
              }))
            }
            placeholderBn="শেষের সময় (ঘড়ি খুলুন)"
          />

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
              { value: 'in_progress', labelBn: 'কাজ চলছে (নীল)' },
              { value: 'completed', labelBn: 'কাজ সম্পন্ন' },
            ]}
          />
        </div>
      </div>

      {/* Section E: Additional Information */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            বিভাগ ঙ: অতিরিক্ত তথ্য ও ছবি (ঐচ্ছিক)
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
          disabled={isSaving}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>
            {isSaving
              ? 'ডাটাবেসে সংরক্ষণ হচ্ছে...'
              : draft.id
              ? 'প্রোডাকশন তথ্য আপডেট করুন'
              : 'প্রোডাকশন এন্ট্রি সংরক্ষণ করুন'}
          </span>
        </button>
      </div>
    </form>
  );

  // Count active dropdown filters (excluding search input)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.itemName !== 'ALL') count++;
    if (filters.category !== 'ALL') count++;
    if (filters.size !== 'ALL') count++;
    if (filters.color !== 'ALL') count++;
    if (filters.workStatus !== 'ALL') count++;
    if (filters.settlementStatus !== 'ALL') count++;
    return count;
  }, [filters]);

  return (
    <div className="space-y-3.5 w-full max-w-full overflow-x-hidden">
      {/* Compact Top Bar: Title + Quick Summary + Action Buttons */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                প্রোডাকশন খাতা
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono">
                মোট {toBengaliDigits(sortedFilteredEntries.length)}টি কাজ ·{' '}
                {toBengaliDigits(filteredSummary.rangePieces)} পিস (
                {formatDozensBn(filteredSummary.rangeDozens)} ডজন) ·{' '}
                <strong className="text-teal-700 dark:text-teal-300">
                  {formatTaka(filteredSummary.rangeEarned, true)}
                </strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSaveWithdrawal && (
            <button
              type="button"
              onClick={() => {
                setWithdrawalDraft({
                  id: '',
                  date: getTodayDDMMYYYY(),
                  amount: '4000',
                  paymentMethod: 'নগদ (Cash)',
                  voucherNo: `VCH-${Date.now().toString().slice(-4)}`,
                  remarks: 'মজুরি উত্তোলন',
                });
                setIsWithdrawalModalOpen(true);
              }}
              className="flex-1 sm:flex-initial min-h-[40px] px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <ArrowDownRight className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>+ বিল উত্তোলন (৪,০০০)</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenVoiceEntry}
            className="flex-1 sm:flex-initial min-h-[40px] px-3 py-1.5 rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Mic className="w-3.5 h-3.5 shrink-0" />
            <span>ভয়েস এন্ট্রি</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex-1 sm:flex-initial min-h-[40px] px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>নতুন প্রোডাকশন</span>
          </button>
        </div>
      </div>

      {/* Ledger View Tabs: All, Production Only, Bill Withdrawal Only */}
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
        <button
          type="button"
          onClick={() => setLedgerTab('all')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-center transition-colors cursor-pointer whitespace-nowrap ${
            ledgerTab === 'all'
              ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          সকল হিসাব ({toBengaliDigits(sortedFilteredEntries.length + sortedFilteredWithdrawals.length)})
        </button>
        <button
          type="button"
          onClick={() => setLedgerTab('production')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-center transition-colors cursor-pointer whitespace-nowrap ${
            ledgerTab === 'production'
              ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          শুধু প্রোডাকশন ({toBengaliDigits(sortedFilteredEntries.length)})
        </button>
        <button
          type="button"
          onClick={() => setLedgerTab('withdrawals')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-center transition-colors cursor-pointer whitespace-nowrap ${
            ledgerTab === 'withdrawals'
              ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          শুধু বিল উত্তোলন ({toBengaliDigits(sortedFilteredWithdrawals.length)})
        </button>
      </div>

      {statusBannerBn && (
        <div className="rounded-xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/40 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-teal-900 dark:text-teal-200">
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

      {/* Inline Structured Form (only if explicitly opened) */}
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
              প্রোডাকশন এন্ট্রি ফর্ম
            </h2>
          </div>
          {renderStructuredForm(false)}
        </section>
      )}

      {/* Compact Search Bar + Collapsible Filter Dropdown Menu */}
      <section
        aria-label="প্রোডাকশন ফিল্টার ও অনুসন্ধান"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 sm:p-3 space-y-2.5"
      >
        <div className="flex items-center gap-2">
          {/* Compact Search Input */}
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              id="prod-search-input"
              type="search"
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  searchQuery: e.target.value,
                }))
              }
              placeholder="আইটেম, ক্যাটাগরি, সাইজ বা তারিখ খুঁজুন..."
              className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs sm:text-sm"
            />
          </div>

          {/* Filter Dropdown Button */}
          <button
            type="button"
            onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              isFilterDropdownOpen || activeFilterCount > 0
                ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>ফিল্টার</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-teal-700 text-white text-[10px] font-mono">
                {toBengaliDigits(activeFilterCount)}
              </span>
            )}
            {isFilterDropdownOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Quick Reset Button when filters or search are active */}
          {(activeFilterCount > 0 || filters.searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={resetFilters}
              title="সকল ফিল্টার রিসেট করুন"
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">রিসেট</span>
            </button>
          )}
        </div>

        {/* Collapsible Dropdown Filter Menu */}
        {isFilterDropdownOpen && (
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              <FormSelect
                id="prod-filter-category"
                labelBn="ক্যাটাগরি"
                value={filters.category}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, category: e.target.value }))
                }
                options={[
                  { value: 'ALL', labelBn: 'সকল ক্যাটাগরি' },
                  ...filterCategoryOptions.map((cat) => ({
                    value: cat,
                    labelBn: cat,
                  })),
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
                  ...GARMENT_SIZE_OPTIONS.map((sz) => ({
                    value: sz,
                    labelBn: sz,
                  })),
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
                  { value: 'in_progress', labelBn: 'কাজ চলছে' },
                  { value: 'completed', labelBn: 'কাজ সম্পন্ন' },
                ]}
              />

              <FormSelect
                id="prod-filter-settlement-status"
                labelBn="রেট নিষ্পত্তি"
                value={filters.settlementStatus}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    settlementStatus: e.target.value as 'ALL' | SettlementStatus,
                  }))
                }
                options={[
                  { value: 'ALL', labelBn: 'সকল নিষ্পত্তি স্ট্যাটাস' },
                  { value: 'pending', labelBn: 'রেট নিষ্পত্তি হয়নি' },
                  { value: 'settled', labelBn: 'নিষ্পত্তি হয়েছে' },
                ]}
              />

              <FormSelect
                id="prod-filter-item"
                labelBn="আইটেমের নাম"
                value={filters.itemName}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, itemName: e.target.value }))
                }
                options={[
                  { value: 'ALL', labelBn: 'সকল আইটেম' },
                  ...filterItemOptions.map((item) => ({
                    value: item,
                    labelBn: item,
                  })),
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
                  ...availableColors.map((clr) => ({
                    value: clr,
                    labelBn: clr,
                  })),
                ]}
              />

              <DateInputDDMMYYYY
                id="prod-filter-date-from"
                labelBn="শুরুর তারিখ"
                valueDDMMYYYY={filters.dateFrom}
                onChangeDDMMYYYY={(val) =>
                  setFilters((prev) => ({ ...prev, dateFrom: val }))
                }
                placeholderBn="শুরুর তারিখ"
              />

              <DateInputDDMMYYYY
                id="prod-filter-date-to"
                labelBn="শেষের তারিখ"
                valueDDMMYYYY={filters.dateTo}
                onChangeDDMMYYYY={(val) =>
                  setFilters((prev) => ({ ...prev, dateTo: val }))
                }
                placeholderBn="শেষের তারিখ"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
              <button
                type="button"
                onClick={resetFilters}
                className="text-rose-600 dark:text-rose-400 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>সব ফিল্টার মুছুন</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-teal-700 text-white font-bold cursor-pointer"
              >
                ফিল্টার বন্ধ করুন ({toBengaliDigits(sortedFilteredEntries.length)}টি ফলাফল)
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Production History Section: Mobile Cards (< lg) + Desktop Table (>= lg) */}
      <section
        aria-labelledby="production-history-heading"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
      >
        <h2 id="production-history-heading" className="sr-only">
          প্রোডাকশন ইতিহাস
        </h2>

        {unifiedLedgerFeed.length === 0 ? (
          <EmptyDataState
            titleBn="কোনো হিসাব পাওয়া যায়নি"
            descriptionBn="নতুন প্রোডাকশন বা বিল উত্তোলন যোগ করুন, অথবা ফিল্টার রিসেট করুন।"
            tableNameHint="production_entries"
            actionLabelBn="নতুন প্রোডাকশন যোগ করুন"
            onActionClick={handleOpenAddModal}
            icon={<Scissors className="w-6 h-6" />}
          />
        ) : (
          <>
            {/* Mobile & Tablet Responsive Cards View (< lg) */}
            <div className="lg:hidden p-2.5 sm:p-4 space-y-2.5">
              {unifiedLedgerFeed.map((item) => {
                if (item.kind === 'withdrawal') {
                  const w = item.record;
                  return (
                    <div
                      key={w.id}
                      className="rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/25 p-3 space-y-2 transition-colors shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <ArrowDownRight className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                                বিল উত্তোলন
                              </span>
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                {formatDateDDMMYYYY(w.date, true)}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                              {w.voucherNo ? `ভাউচার: ${w.voucherNo}` : 'কোম্পানি থেকে মজুরি উত্তোলন'}
                            </p>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                              মাধ্যম: {w.paymentMethod || 'নগদ'} {w.remarks ? `· ${w.remarks}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-base sm:text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                            -{formatTaka(w.amount ?? 0, true)}
                          </p>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                            উত্তোলন সম্পন্ন
                          </span>
                        </div>
                      </div>

                      {onDeleteWithdrawal && (
                        <div className="flex justify-end pt-1 border-t border-emerald-100 dark:border-emerald-900/50">
                          <button
                            type="button"
                            onClick={() => onDeleteWithdrawal(w.id)}
                            className="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>মুছুন</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                const entry = item.entry;
                const visual = getEntryVisualCardStyle(entry);
                const validPhotos = (entry.photos || []).filter(
                  (p) => p.previewUrl || p.storagePath
                );
                const primaryPhotoUrl =
                  validPhotos[0]?.previewUrl || validPhotos[0]?.storagePath || null;

                const durMinutes =
                  entry.workDurationMinutes && entry.workDurationMinutes > 0
                    ? entry.workDurationMinutes
                    : calculateDurationMinutes(entry.startWorkTime, entry.endWorkTime);
                const durationBn = formatDurationBn(durMinutes);

                return (
                  <div
                    key={entry.id}
                    className={`rounded-xl border p-3 space-y-2.5 transition-colors shadow-2xs ${visual.cardBorderBg}`}
                  >
                    {/* Row 1: Left thumbnail + Item Details + Right: Total Earned Wage & Rate */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {primaryPhotoUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhotoModal({
                                url: primaryPhotoUrl,
                                title: entry.itemName || entry.garmentType,
                                subtitle: `তারিখ: ${formatDateDDMMYYYY(
                                  entry.date,
                                  true
                                )} · ${toBengaliDigits(entry.pieces ?? 0)} পিস`,
                              })
                            }
                            className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0 cursor-pointer bg-slate-100 dark:bg-slate-800"
                            title="ছবি বড় করে দেখতে ট্যাপ করুন"
                          >
                            <img
                              src={primaryPhotoUrl}
                              alt={entry.itemName || 'পোশাকের ছবি'}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {validPhotos.length > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-slate-900/80 text-white text-[9px] font-semibold">
                                +{toBengaliDigits(validPhotos.length - 1)}
                              </span>
                            )}
                          </button>
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                            <Scissors className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              {formatDateDDMMYYYY(entry.date, true)}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${visual.workTextColor}`}
                            >
                              {visual.workLabelBn}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                            {entry.itemName || entry.garmentType}
                          </h3>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                            {entry.category || '—'} · সাইজ: {entry.size || '—'}
                            {entry.color ? ` · রঙ: ${entry.color}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-base font-bold font-mono tabular-nums text-teal-700 dark:text-teal-300">
                          {formatTaka(entry.totalWage, true)}
                        </p>
                        <p className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          দর: {formatTaka(entry.ratePerDozen, true)}/ডজন
                        </p>
                      </div>
                    </div>

                    {/* Row 2: Pieces/Dozens + Formatted Duration ("১ দিন ৩ ঘণ্টা ২০ মিনিট") */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs bg-slate-50/70 dark:bg-slate-950/50 px-2.5 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60">
                      <div className="flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {toBengaliDigits(entry.pieces ?? 0)} পিস
                        </span>
                        <span className="text-slate-400">·</span>
                        <span>{formatDozensBn(entry.dozens)} ডজন</span>
                      </div>

                      {(durMinutes !== null || entry.startWorkTime || entry.endWorkTime) && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                          <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span>
                            সময়কাল:{' '}
                            <strong className="font-semibold text-slate-800 dark:text-slate-200">
                              {durationBn}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Additional Photo Strip if multiple photos uploaded */}
                    {validPhotos.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                        {validPhotos.map((photo, pIdx) => {
                          const url = photo.previewUrl || photo.storagePath || '';
                          return (
                            <button
                              key={photo.id || pIdx}
                              type="button"
                              onClick={() =>
                                setPreviewPhotoModal({
                                  url,
                                  title: `${entry.itemName || entry.garmentType} (ছবি ${toBengaliDigits(
                                    pIdx + 1
                                  )})`,
                                  subtitle: `তারিখ: ${formatDateDDMMYYYY(
                                    entry.date,
                                    true
                                  )}`,
                                })
                              }
                              className="w-10 h-10 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer"
                            >
                              <img
                                src={url}
                                alt={`ছবি ${pIdx + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Row 3: Action Buttons (Compact: Settlement, Edit, Delete) - NO Start/End Work buttons */}
                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => handleQuickToggleSettlementOnEntry(entry)}
                        className="min-h-[32px] px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>
                          {entry.settlementStatus === 'settled'
                            ? 'রেট নিষ্পত্তি হয়েছে'
                            : 'রেট নিষ্পত্তি হয়নি'}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(entry)}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>সম্পাদনা</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestSecureDelete(entry)}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-[11px] font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
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
                    <th className="py-3.5 px-4 whitespace-nowrap">তারিখ ও ছবি</th>
                    <th className="py-3.5 px-4">আইটেম ও ক্যাটাগরি</th>
                    <th className="py-3.5 px-4">সাইজ ও রঙ</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      পিস ও ডজন
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      দর ও অর্জিত মজুরি
                    </th>
                    <th className="py-3.5 px-4">কাজের সময় (শুরু - শেষ)</th>
                    <th className="py-3.5 px-4">কাজের ও রেট নিষ্পত্তি স্ট্যাটাস</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      কার্যক্রম
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {sortedFilteredEntries.map((entry) => {
                    const visual = getEntryVisualCardStyle(entry);
                    const validPhotos = (entry.photos || []).filter(
                      (p) => p.previewUrl || p.storagePath
                    );
                    const primaryPhotoUrl =
                      validPhotos[0]?.previewUrl ||
                      validPhotos[0]?.storagePath ||
                      null;

                    return (
                      <tr
                        key={entry.id}
                        className={`transition-colors ${visual.cardBorderBg}`}
                      >
                        <td className="py-3.5 px-4 font-mono tabular-nums whitespace-nowrap text-slate-800 dark:text-slate-200 align-top">
                          <div className="flex items-center gap-2.5">
                            {primaryPhotoUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhotoModal({
                                    url: primaryPhotoUrl,
                                    title: entry.itemName || entry.garmentType,
                                    subtitle: `তারিখ: ${formatDateDDMMYYYY(
                                      entry.date,
                                      true
                                    )} · ${toBengaliDigits(
                                      entry.pieces ?? 0
                                    )} পিস`,
                                  })
                                }
                                className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 cursor-pointer relative group"
                                title="ছবি বড় করে দেখুন"
                              >
                                <img
                                  src={primaryPhotoUrl}
                                  alt={entry.itemName || 'ছবি'}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </button>
                            ) : (
                              <div className="w-12 h-12 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            )}
                            <span>{formatDateDDMMYYYY(entry.date, true)}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          <p className="font-bold text-slate-900 dark:text-slate-100">
                            {entry.itemName || entry.garmentType}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            ক্যাটাগরি: {entry.category || '—'}
                            {entry.shortDescription
                              ? ` · ${entry.shortDescription}`
                              : ''}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300 align-top">
                          <p>সাইজ: {entry.size || '—'}</p>
                          {entry.color && (
                            <p className="text-slate-500 dark:text-slate-400">
                              রঙ: {entry.color}
                            </p>
                          )}
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
                          <p className="text-slate-600 dark:text-slate-400 font-medium mt-1">
                            সময়কাল:{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {formatDurationBn(
                                entry.workDurationMinutes && entry.workDurationMinutes > 0
                                  ? entry.workDurationMinutes
                                  : calculateDurationMinutes(
                                      entry.startWorkTime,
                                      entry.endWorkTime
                                    )
                              )}
                            </strong>
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs align-top">
                          <p className={`font-bold ${visual.workTextColor}`}>
                            {visual.workLabelBn}
                          </p>
                          <p
                            className={`font-semibold mt-0.5 ${visual.settlementTextColor}`}
                          >
                            {visual.settlementLabelBn}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap align-top">
                          <div className="flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickToggleSettlementOnEntry(entry)
                              }
                              className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs ${
                                entry.settlementStatus === 'settled'
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                  : 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
                              }`}
                            >
                              {entry.settlementStatus === 'settled' ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {entry.settlementStatus === 'settled'
                                  ? 'নিষ্পত্তি হয়েছে'
                                  : 'রেট নিষ্পত্তি হয়নি'}
                              </span>
                            </button>
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(entry)}
                                className="min-h-[32px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>সম্পাদনা</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestSecureDelete(entry)}
                                className="min-h-[32px] px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1 cursor-pointer"
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

      {/* Secure 2-Step Delete Confirmation Modal (Prevents Accidental Touch Deletion) */}
      <ModalDrawer
        isOpen={Boolean(entryPendingDelete)}
        onClose={() => {
          if (!isDeletingEntry) {
            setEntryPendingDelete(null);
            setDeleteSafetyChecked(false);
          }
        }}
        titleBn="এন্ট্রি মুছে ফেলার নিরাপত্তা নিশ্চিতকরণ"
        subtitleBn="ভুলবশত টাচ লেগে কোনো হিসাব যেন মুছে না যায় সেজন্য নিচের তথ্য যাচাই করুন"
        maxWidthClass="max-w-md"
      >
        {entryPendingDelete && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/80 bg-rose-50/70 dark:bg-rose-950/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <span>আপনি কি এই প্রোডাকশন হিসাবটি মুছে ফেলতে চান?</span>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/50 p-3 text-xs space-y-1">
                <p className="text-slate-500 dark:text-slate-400">
                  তারিখ: <strong>{formatDateDDMMYYYY(entryPendingDelete.date, true)}</strong>
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  আইটেম: {entryPendingDelete.itemName || entryPendingDelete.garmentType}
                </p>
                <p className="text-slate-700 dark:text-slate-300">
                  পরিমাণ: <strong>{toBengaliDigits(entryPendingDelete.pieces ?? 0)} পিস</strong> ({formatDozensBn(entryPendingDelete.dozens)} ডজন) · মজুরি:{' '}
                  <strong className="text-teal-700 dark:text-teal-300">
                    {formatTaka(entryPendingDelete.totalWage, true)}
                  </strong>
                </p>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs sm:text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deleteSafetyChecked}
                onChange={(e) => setDeleteSafetyChecked(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-rose-600 shrink-0"
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                হ্যাঁ, আমি জেনে-বুঝে এই প্রোডাকশন এন্ট্রিটি স্থায়ীভাবে মুছে ফেলতে চাই।
              </span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={isDeletingEntry}
                onClick={() => {
                  setEntryPendingDelete(null);
                  setDeleteSafetyChecked(false);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                না, রাখুন (বাতিল)
              </button>
              <button
                type="button"
                disabled={!deleteSafetyChecked || isDeletingEntry}
                onClick={handleConfirmSecureDelete}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {isDeletingEntry ? 'মুছে ফেলা হচ্ছে...' : 'স্থায়ীভাবে মুছে ফেলুন'}
                </span>
              </button>
            </div>
          </div>
        )}
      </ModalDrawer>

      {/* Full-Screen Garment Photo Preview Modal */}
      {previewPhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewPhotoModal(null)}
        >
          <div
            className="relative max-w-lg w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {previewPhotoModal.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {previewPhotoModal.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhotoModal(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-950 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img
                src={previewPhotoModal.url}
                alt={previewPhotoModal.title}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Form for Add / Edit Production Entry */}
      <ModalDrawer
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        titleBn={
          draft.id ? 'প্রোডাকশন এন্ট্রি সম্পাদনা করুন' : 'নতুন প্রোডাকশন যোগ করুন'
        }
        subtitleBn="কাস্টম আইটেমের নাম, ৪টি ক্যাটাগরি, ১১টি সাইজ, স্বয়ংক্রিয় মজুরি এবং অ্যানালগ ঘড়িতে কাজের সময় নির্ধারণ"
        maxWidthClass="max-w-3xl"
      >
        {renderStructuredForm(true)}
      </ModalDrawer>

      {/* AI Voice Entry Modal */}
      <AiVoiceEntryModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        defaultDateDDMMYYYY={draft.date || getTodayDDMMYYYY(false)}
        onApplyToForm={handleApplyVoiceDataToForm}
      />

      {/* Bill Withdrawal Quick Modal (Default 4,000, Editable) */}
      <ModalDrawer
        isOpen={isWithdrawalModalOpen}
        onClose={() => setIsWithdrawalModalOpen(false)}
        titleBn="কোম্পানি থেকে বিল উত্তোলন যোগ করুন"
        subtitleBn="ডিফল্টভাবে ৪,০০০ টাকা দেওয়া আছে, আপনি চাইলে যেকোনো পরিমাণ পরিবর্তন করতে পারেন"
        maxWidthClass="max-w-lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!onSaveWithdrawal) return;
            const amt = Number(withdrawalDraft.amount);
            if (!Number.isFinite(amt) || amt <= 0) return;
            onSaveWithdrawal({
              id: withdrawalDraft.id || `wd-${Date.now()}`,
              date: withdrawalDraft.date || getTodayDDMMYYYY(false),
              amount: amt,
              paymentMethod: withdrawalDraft.paymentMethod,
              weekReference: 'মজুরি উত্তোলন',
              approvedBy: 'অপারেটর',
              voucherNo:
                withdrawalDraft.voucherNo.trim() ||
                `VCH-${Date.now().toString().slice(-4)}`,
              remarks: withdrawalDraft.remarks.trim() || 'মজুরি উত্তোলন',
            });
            setIsWithdrawalModalOpen(false);
            setStatusBannerBn(
              `৳${toBengaliDigits(amt)} বিল উত্তোলন সফলভাবে যোগ করা হয়েছে।`
            );
          }}
          className="p-4 sm:p-6 space-y-4"
        >
          <DateInputDDMMYYYY
            id="modal-withdrawal-date"
            labelBn="উত্তোলনের তারিখ (DD-MM-YYYY)"
            valueDDMMYYYY={withdrawalDraft.date}
            onChangeDDMMYYYY={(val) =>
              setWithdrawalDraft((prev) => ({ ...prev, date: val }))
            }
          />

          <FormInput
            id="modal-withdrawal-amount"
            labelBn="উত্তোলনের পরিমাণ (টাকা / ৳)"
            type="number"
            value={withdrawalDraft.amount}
            onChange={(e) =>
              setWithdrawalDraft((prev) => ({
                ...prev,
                amount: e.target.value,
              }))
            }
            placeholder="৪০০০"
            required
          />
          <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
            💡 ডিফল্ট ৪,০০০ টাকা সেট করা আছে। প্রয়োজনে সম্পাদনা করুন।
          </p>

          <FormSelect
            id="modal-withdrawal-method"
            labelBn="পেমেন্ট মাধ্যম"
            value={withdrawalDraft.paymentMethod}
            onChange={(e) =>
              setWithdrawalDraft((prev) => ({
                ...prev,
                paymentMethod: e.target.value,
              }))
            }
            options={[
              { value: 'নগদ (Cash)', labelBn: 'নগদ (Cash)' },
              { value: 'বিকাশ (bKash)', labelBn: 'বিকাশ (bKash)' },
              { value: 'রকেট (Rocket)', labelBn: 'রকেট (Rocket)' },
              { value: 'নগদ (Nagad)', labelBn: 'নগদ মোবাইল ব্যাংকিং' },
              { value: 'ব্যাংক ট্রান্সফার', labelBn: 'ব্যাংক ট্রান্সফার' },
            ]}
          />

          <FormInput
            id="modal-withdrawal-voucher"
            labelBn="ভাউচার বা রিসিট নম্বর (ঐচ্ছিক)"
            type="text"
            value={withdrawalDraft.voucherNo}
            onChange={(e) =>
              setWithdrawalDraft((prev) => ({
                ...prev,
                voucherNo: e.target.value,
              }))
            }
            placeholder="যেমন: VCH-2026"
          />

          <FormInput
            id="modal-withdrawal-remarks"
            labelBn="নোট / বিবরণ (ঐচ্ছিক)"
            type="text"
            value={withdrawalDraft.remarks}
            onChange={(e) =>
              setWithdrawalDraft((prev) => ({
                ...prev,
                remarks: e.target.value,
              }))
            }
            placeholder="যেমন: চলতি সপ্তাহের বিল উত্তোলন"
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsWithdrawalModalOpen(false)}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              বাতিল করুন
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>বিল উত্তোলন সংরক্ষণ করুন</span>
            </button>
          </div>
        </form>
      </ModalDrawer>
    </div>
  );
};
