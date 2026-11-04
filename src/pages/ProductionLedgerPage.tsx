import React, { useState } from 'react';
import {
  Edit3,
  FilePlus2,
  Image as ImageIcon,
  Layers,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  Trash2,
} from 'lucide-react';
import {
  GARMENT_COLOR_OPTIONS,
  GARMENT_SIZE_OPTIONS,
  GARMENT_TYPE_OPTIONS,
} from '../config/navigation';
import {
  ProductionEntry,
  ProductionFilterState,
  UploadedPhotoPreview,
} from '../types/models';
import {
  formatDateDDMMYYYY,
  formatTaka,
  getTodayDDMMYYYY,
  toAsciiDigits,
  toBengaliDigits,
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
  onSaveEntry: (entry: ProductionEntry) => void;
  onDeleteEntry: (id: string) => void;
}

interface ProductionFormDraft {
  id: string | null;
  date: string;
  garmentType: string;
  size: string;
  color: string;
  dozens: string;
  pieces: string;
  ratePerDozen: string;
  totalWage: string;
  shortDescription: string;
  photos: UploadedPhotoPreview[];
}

function createEmptyDraft(): ProductionFormDraft {
  return {
    id: null,
    date: getTodayDDMMYYYY(false),
    garmentType: GARMENT_TYPE_OPTIONS[0],
    size: GARMENT_SIZE_OPTIONS[2], // M
    color: GARMENT_COLOR_OPTIONS[0],
    dozens: '',
    pieces: '',
    ratePerDozen: '',
    totalWage: '',
    shortDescription: '',
    photos: [],
  };
}

export const ProductionLedgerPage: React.FC<ProductionLedgerPageProps> = ({
  entries,
  onSaveEntry,
  onDeleteEntry,
}) => {
  const [filters, setFilters] = useState<ProductionFilterState>({
    searchQuery: '',
    date: '',
    garmentType: 'ALL',
    size: 'ALL',
    color: 'ALL',
  });

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [showInlineForm, setShowInlineForm] = useState(true);
  const [draft, setDraft] = useState<ProductionFormDraft>(createEmptyDraft);
  const [statusBannerBn, setStatusBannerBn] = useState<string | null>(null);

  const handleOpenAddModal = () => {
    setDraft(createEmptyDraft());
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (entry: ProductionEntry) => {
    setDraft({
      id: entry.id,
      date: entry.date,
      garmentType: entry.garmentType,
      size: entry.size,
      color: entry.color,
      dozens: entry.dozens !== null ? String(entry.dozens) : '',
      pieces: entry.pieces !== null ? String(entry.pieces) : '',
      ratePerDozen: entry.ratePerDozen !== null ? String(entry.ratePerDozen) : '',
      totalWage: entry.totalWage !== null ? String(entry.totalWage) : '',
      shortDescription: entry.shortDescription,
      photos: entry.photos,
    });
    setIsFormModalOpen(true);
  };

  const handleAddPhotos = (fileList: FileList) => {
    const added: UploadedPhotoPreview[] = Array.from(fileList).map((file, idx) => ({
      id: `photo-${Date.now()}-${idx}`,
      fileName: file.name,
      fileSize: file.size,
      previewUrl: URL.createObjectURL(file),
      mimeType: file.type || 'image/jpeg',
    }));
    setDraft((prev) => ({
      ...prev,
      photos: [...prev.photos, ...added],
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
    const parseNum = (val: string): number | null => {
      const normalized = toAsciiDigits(val).trim();
      if (!normalized) return null;
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const record: ProductionEntry = {
      id: draft.id ?? `prod-${Date.now()}`,
      date: draft.date || getTodayDDMMYYYY(false),
      garmentType: draft.garmentType,
      size: draft.size,
      color: draft.color,
      dozens: parseNum(draft.dozens),
      pieces: parseNum(draft.pieces),
      ratePerDozen: parseNum(draft.ratePerDozen),
      totalWage: parseNum(draft.totalWage),
      shortDescription: draft.shortDescription.trim(),
      photos: draft.photos,
    };

    onSaveEntry(record);
    setStatusBannerBn(
      draft.id
        ? 'প্রোডাকশন এন্ট্রি হালনাগাদ করা হয়েছে (সুপাবেস ডাটাবেস সংযোগের জন্য প্রস্তুত)।'
        : 'নতুন প্রোডাকশন এন্ট্রি তালিকায় যুক্ত হয়েছে (স্থায়ী সংরক্ষণের জন্য সুপাবেস ডাটাবেস সংযুক্ত হবে)।'
    );
    setDraft(createEmptyDraft());
    setIsFormModalOpen(false);
  };

  const resetFilters = () => {
    setFilters({
      searchQuery: '',
      date: '',
      garmentType: 'ALL',
      size: 'ALL',
      color: 'ALL',
    });
  };

  const filteredEntries = entries.filter((entry) => {
    if (filters.date && toAsciiDigits(entry.date) !== toAsciiDigits(filters.date)) {
      return false;
    }
    if (filters.garmentType !== 'ALL' && entry.garmentType !== filters.garmentType) {
      return false;
    }
    if (filters.size !== 'ALL' && entry.size !== filters.size) {
      return false;
    }
    if (filters.color !== 'ALL' && entry.color !== filters.color) {
      return false;
    }
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      const haystack =
        `${entry.garmentType} ${entry.size} ${entry.color} ${entry.shortDescription} ${entry.date}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const renderFormFields = (isModalContext: boolean) => (
    <form onSubmit={handleSubmitForm} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Date (DD-MM-YYYY) */}
        <DateInputDDMMYYYY
          id={isModalContext ? 'modal-prod-date' : 'inline-prod-date'}
          labelBn="তারিখ (DD-MM-YYYY)"
          valueDDMMYYYY={draft.date}
          onChangeDDMMYYYY={(val) => setDraft((prev) => ({ ...prev, date: val }))}
        />

        {/* 2. Garment Type */}
        <FormSelect
          id={isModalContext ? 'modal-prod-type' : 'inline-prod-type'}
          labelBn="পোশাকের ধরন"
          value={draft.garmentType}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, garmentType: e.target.value }))
          }
          options={GARMENT_TYPE_OPTIONS.map((item) => ({
            value: item,
            labelBn: item,
          }))}
        />

        {/* 3. Size */}
        <FormSelect
          id={isModalContext ? 'modal-prod-size' : 'inline-prod-size'}
          labelBn="সাইজ"
          value={draft.size}
          onChange={(e) => setDraft((prev) => ({ ...prev, size: e.target.value }))}
          options={GARMENT_SIZE_OPTIONS.map((item) => ({
            value: item,
            labelBn: item,
          }))}
        />

        {/* 4. Color */}
        <FormSelect
          id={isModalContext ? 'modal-prod-color' : 'inline-prod-color'}
          labelBn="রঙ"
          value={draft.color}
          onChange={(e) => setDraft((prev) => ({ ...prev, color: e.target.value }))}
          options={GARMENT_COLOR_OPTIONS.map((item) => ({
            value: item,
            labelBn: item,
          }))}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 5. Dozens */}
        <FormInput
          id={isModalContext ? 'modal-prod-dozens' : 'inline-prod-dozens'}
          labelBn="ডজন (Dozens)"
          type="text"
          inputMode="decimal"
          placeholder="যেমন: ১২"
          rightUnitBn="ডজন"
          value={draft.dozens}
          onChange={(e) => setDraft((prev) => ({ ...prev, dozens: e.target.value }))}
        />

        {/* 6. Pieces */}
        <FormInput
          id={isModalContext ? 'modal-prod-pieces' : 'inline-prod-pieces'}
          labelBn="পিস (Pieces)"
          type="text"
          inputMode="numeric"
          placeholder="যেমন: ৬"
          rightUnitBn="পিস"
          value={draft.pieces}
          onChange={(e) => setDraft((prev) => ({ ...prev, pieces: e.target.value }))}
        />

        {/* 7. Rate per dozen */}
        <FormInput
          id={isModalContext ? 'modal-prod-rate' : 'inline-prod-rate'}
          labelBn="প্রতি ডজনের দর (৳)"
          type="text"
          inputMode="decimal"
          placeholder="যেমন: ১২০.০০"
          rightUnitBn="৳/ডজন"
          value={draft.ratePerDozen}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, ratePerDozen: e.target.value }))
          }
        />

        {/* 8. Total wage */}
        <FormInput
          id={isModalContext ? 'modal-prod-total-wage' : 'inline-prod-total-wage'}
          labelBn="মোট মজুরি (৳)"
          type="text"
          inputMode="decimal"
          placeholder="ডাটাবেস/সার্ভিস কর্তৃক নির্ধারিত বা ইনপুট দিন"
          rightUnitBn="৳"
          value={draft.totalWage}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, totalWage: e.target.value }))
          }
        />
      </div>

      {/* 9. Short description */}
      <FormTextarea
        id={isModalContext ? 'modal-prod-desc' : 'inline-prod-desc'}
        labelBn="সংক্ষিপ্ত বিবরণ"
        placeholder="বায়ারের নাম, স্টাইল নম্বর, অপারেশন (যেমন: কলার জয়েন্ট, হ্যামিং, সাইড সিম) বা লট নম্বর লিখুন..."
        value={draft.shortDescription}
        onChange={(e) =>
          setDraft((prev) => ({ ...prev, shortDescription: e.target.value }))
        }
      />

      {/* 10. Production photos (multiple images supported) */}
      <MultiPhotoUpload
        photos={draft.photos}
        onAddPhotos={handleAddPhotos}
        onRemovePhoto={handleRemovePhoto}
      />

      <div className="pt-2 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            setDraft(createEmptyDraft());
            if (isModalContext) setIsFormModalOpen(false);
          }}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
        >
          {isModalContext ? 'বাতিল করুন' : 'ফর্ম রিসেট করুন'}
        </button>
        <button
          type="submit"
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>
            {draft.id ? 'প্রোডাকশন তথ্য আপডেট করুন' : 'প্রোডাকশন হিসাব সংরক্ষণ করুন'}
          </span>
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        moduleIndexBn="০২. প্রধান মডিউল · প্রোডাকশন হিসাব"
        titleBn="প্রোডাকশন হিসাব ও সেলাই খতিয়ান"
        subtitleBn="প্রতিদিনের সেলাইকৃত পোশাকের ধরন, সাইজ, রঙ, ডজন, পিস, প্রতি ডজনের দর এবং প্রোডাকশনের ছবি সংরক্ষণ ও অনুসন্ধান"
        primaryActionLabelBn="নতুন প্রোডাকশন যোগ করুন"
        primaryActionIcon={<Plus className="w-4 h-4" />}
        onPrimaryAction={handleOpenAddModal}
        secondaryActionLabelBn={
          showInlineForm ? 'ফর্ম প্যানেল লুকান' : 'ফর্ম প্যানেল দেখুন'
        }
        secondaryActionIcon={<FilePlus2 className="w-4 h-4" />}
        onSecondaryAction={() => setShowInlineForm((prev) => !prev)}
      />

      {statusBannerBn && (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/40 px-4 py-3 flex items-center justify-between gap-3 text-sm text-teal-900 dark:text-teal-200">
          <span>{statusBannerBn}</span>
          <button
            type="button"
            onClick={() => setStatusBannerBn(null)}
            className="text-xs font-semibold underline cursor-pointer shrink-0"
          >
            বন্ধ করুন
          </button>
        </div>
      )}

      {/* Summary Cards for Production Page */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          titleBn="তালিকাভুক্ত প্রোডাকশন এন্ট্রি"
          amount={null}
          customValueBn={`${toBengaliDigits(entries.length)} টি`}
          subtitleBn="চলমান সেশন / ডাটাবেস এন্ট্রি সংখ্যা"
          dbColumnHint="COUNT(id)"
          icon={<Scissors className="w-5 h-5" />}
          tone="accent"
        />
        <SummaryCard
          titleBn="ফিল্টারকৃত ফলাফল"
          amount={null}
          customValueBn={`${toBengaliDigits(filteredEntries.length)} টি`}
          subtitleBn="বর্তমান অনুসন্ধান ও ফিল্টার অনুযায়ী"
          dbColumnHint="filtered_rows"
          icon={<Layers className="w-5 h-5" />}
          tone="default"
        />
        <SummaryCard
          titleBn="মোট প্রোডাকশন মজুরি"
          amount={null}
          subtitleBn="সুপাবেস ডাটাবেস সংযুক্ত হলে স্বয়ংক্রিয়ভাবে গণনা হবে"
          dbColumnHint="SUM(total_wage)"
          icon={<ImageIcon className="w-5 h-5" />}
          tone="positive"
        />
      </div>

      {/* Clean Production Entry Form Section (Inspectable on Page + Modal) */}
      {showInlineForm && (
        <section
          aria-labelledby="production-form-heading"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2
                id="production-form-heading"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                নতুন প্রোডাকশন এন্ট্রি ফর্ম (উৎপাদন তথ্য ও একাধিক ছবি আপলোড)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                তারিখ (DD-MM-YYYY), পোশাকের ধরন, সাইজ, রঙ, ডজন, পিস, প্রতি ডজনের দর (৳), মোট মজুরি, সংক্ষিপ্ত বিবরণ ও ছবি
              </p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              টেবিল: production_entries
            </span>
          </div>

          {renderFormFields(false)}
        </section>
      )}

      {/* Search & Multi-Filter Toolbar */}
      <section
        aria-label="প্রোডাকশন ফিল্টার ও অনুসন্ধান"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            প্রোডাকশন ইতিহাস অনুসন্ধান ও ফিল্টার
          </h2>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>সব ফিল্টার মুছুন</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Search field */}
          <div className="space-y-1.5">
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
                placeholder="বিবরণ, পোশাক বা স্টাইল খুঁজুন..."
                className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600"
              />
            </div>
          </div>

          {/* 2. Date filter (DD-MM-YYYY) */}
          <DateInputDDMMYYYY
            id="prod-filter-date"
            labelBn="তারিখ ফিল্টার (DD-MM-YYYY)"
            valueDDMMYYYY={filters.date}
            onChangeDDMMYYYY={(val) =>
              setFilters((prev) => ({ ...prev, date: val }))
            }
            placeholderBn="সকল তারিখ (DD-MM-YYYY)"
          />

          {/* 3. Garment type filter */}
          <FormSelect
            id="prod-filter-garment"
            labelBn="পোশাকের ধরন ফিল্টার"
            value={filters.garmentType}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, garmentType: e.target.value }))
            }
            options={[
              { value: 'ALL', labelBn: 'সকল ধরনের পোশাক' },
              ...GARMENT_TYPE_OPTIONS.map((item) => ({
                value: item,
                labelBn: item,
              })),
            ]}
          />

          {/* 4. Size filter */}
          <FormSelect
            id="prod-filter-size"
            labelBn="সাইজ ফিল্টার"
            value={filters.size}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, size: e.target.value }))
            }
            options={[
              { value: 'ALL', labelBn: 'সকল সাইজ' },
              ...GARMENT_SIZE_OPTIONS.map((item) => ({
                value: item,
                labelBn: item,
              })),
            ]}
          />

          {/* 5. Color filter */}
          <FormSelect
            id="prod-filter-color"
            labelBn="রঙ ফিল্টার"
            value={filters.color}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, color: e.target.value }))
            }
            options={[
              { value: 'ALL', labelBn: 'সকল রঙ' },
              ...GARMENT_COLOR_OPTIONS.map((item) => ({
                value: item,
                labelBn: item,
              })),
            ]}
          />
        </div>
      </section>

      {/* Production History Table */}
      <section
        aria-labelledby="production-table-heading"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="production-table-heading"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              প্রোডাকশন ইতিহাস টেবিল
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              প্রতিটি এন্ট্রি সম্পাদনা (Edit) ও মুছে ফেলার (Delete) সুবিধা সহ
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন প্রোডাকশন যোগ করুন</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3.5 px-4 whitespace-nowrap">তারিখ (DD-MM-YYYY)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">পোশাকের ধরন</th>
                <th className="py-3.5 px-4 whitespace-nowrap">সাইজ ও রঙ</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">ডজন</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">পিস</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  প্রতি ডজনের দর (৳)
                </th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">
                  মোট মজুরি (৳)
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap">সংক্ষিপ্ত বিবরণ ও ছবি</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyDataState
                      titleBn="কোনো প্রোডাকশন ইতিহাস পাওয়া যায়নি"
                      descriptionBn="উপরের 'নতুন প্রোডাকশন যোগ করুন' বাটনে ক্লিক করে অথবা ফর্মের মাধ্যমে প্রোডাকশন তথ্য যুক্ত করুন। সুপাবেস সংযুক্ত হলে ডাটাবেসের সকল এন্ট্রি এখানে লোড হবে।"
                      tableNameHint="production_entries"
                      actionLabelBn="নতুন প্রোডাকশন যোগ করুন"
                      onActionClick={handleOpenAddModal}
                      icon={<Scissors className="w-6 h-6" />}
                    />
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono tabular-nums whitespace-nowrap text-slate-800 dark:text-slate-200">
                      {formatDateDDMMYYYY(entry.date, true)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {entry.garmentType}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <span>{entry.size}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>{entry.color}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {toBengaliDigits(entry.dozens ?? 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {toBengaliDigits(entry.pieces ?? 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {formatTaka(entry.ratePerDozen, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatTaka(entry.totalWage, true)}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-slate-700 dark:text-slate-300 truncate">
                        {entry.shortDescription || '—'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        ছবি: {toBengaliDigits(entry.photos.length)} টি
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(entry)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>সম্পাদনা</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteEntry(entry.id)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>মুছে ফেলুন</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Form for Add / Edit Production Entry */}
      <ModalDrawer
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        titleBn={
          draft.id ? 'প্রোডাকশন এন্ট্রি সম্পাদনা করুন' : 'নতুন প্রোডাকশন যোগ করুন'
        }
        subtitleBn="তারিখ (DD-MM-YYYY), পোশাকের বিবরণ, দর ও একাধিক ছবি যুক্ত করুন"
        maxWidthClass="max-w-3xl"
      >
        {renderFormFields(true)}
      </ModalDrawer>
    </div>
  );
};
