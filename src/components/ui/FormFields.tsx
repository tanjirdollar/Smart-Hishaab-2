import React, { useRef } from 'react';
import { Calendar, ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { UploadedPhotoPreview } from '../../types/models';
import {
  ddMmYyyyToIsoInput,
  formatDateDDMMYYYY,
  isoInputToDDMMYYYY,
  toBengaliDigits,
} from '../../utils/formatters';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  labelBn: string;
  helperTextBn?: string;
  rightUnitBn?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  labelBn,
  helperTextBn,
  rightUnitBn,
  id,
  className = '',
  ...rest
}) => {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {labelBn}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition-colors ${
            rightUnitBn ? 'pr-14' : ''
          } ${className}`}
          {...rest}
        />
        {rightUnitBn && (
          <span className="absolute right-3.5 text-xs font-medium text-slate-500 dark:text-slate-400 pointer-events-none">
            {rightUnitBn}
          </span>
        )}
      </div>
      {helperTextBn && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{helperTextBn}</p>
      )}
    </div>
  );
};

export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  labelBn: string;
  options: { value: string; labelBn: string }[];
  helperTextBn?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  labelBn,
  options,
  helperTextBn,
  id,
  className = '',
  ...rest
}) => {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {labelBn}
      </label>
      <select
        id={id}
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition-colors ${className}`}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.labelBn}
          </option>
        ))}
      </select>
      {helperTextBn && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{helperTextBn}</p>
      )}
    </div>
  );
};

export interface FormTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  labelBn: string;
  helperTextBn?: string;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  labelBn,
  helperTextBn,
  id,
  className = '',
  ...rest
}) => {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {labelBn}
      </label>
      <textarea
        id={id}
        rows={3}
        className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition-colors ${className}`}
        {...rest}
      />
      {helperTextBn && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{helperTextBn}</p>
      )}
    </div>
  );
};

export interface DateInputDDMMYYYYProps {
  id: string;
  labelBn?: string;
  valueDDMMYYYY: string;
  onChangeDDMMYYYY: (newDateDDMMYYYY: string) => void;
  placeholderBn?: string;
  compact?: boolean;
}

/**
 * Date input enforcing DD-MM-YYYY display and selection.
 */
export const DateInputDDMMYYYY: React.FC<DateInputDDMMYYYYProps> = ({
  id,
  labelBn,
  valueDDMMYYYY,
  onChangeDDMMYYYY,
  placeholderBn = 'DD-MM-YYYY (দিন-মাস-বছর)',
  compact = false,
}) => {
  const nativeDateRef = useRef<HTMLInputElement | null>(null);
  const isoValue = ddMmYyyyToIsoInput(valueDDMMYYYY);

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIso = e.target.value;
    if (!newIso) {
      onChangeDDMMYYYY('');
      return;
    }
    onChangeDDMMYYYY(isoInputToDDMMYYYY(newIso));
  };

  return (
    <div className={compact ? '' : 'space-y-1.5'}>
      {labelBn && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {labelBn}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={valueDDMMYYYY ? formatDateDDMMYYYY(valueDDMMYYYY, true) : ''}
          onChange={(e) => onChangeDDMMYYYY(e.target.value)}
          placeholder={placeholderBn}
          className="w-full min-h-[44px] pl-3.5 pr-11 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono tabular-nums placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition-colors"
        />
        <button
          type="button"
          onClick={() => nativeDateRef.current?.showPicker?.()}
          aria-label="ক্যালেন্ডার থেকে তারিখ নির্বাচন করুন (DD-MM-YYYY)"
          className="absolute right-1.5 w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Calendar className="w-4 h-4" />
        </button>
        <input
          ref={nativeDateRef}
          type="date"
          value={isoValue}
          onChange={handleNativeChange}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
      </div>
    </div>
  );
};

export interface MultiPhotoUploadProps {
  photos: UploadedPhotoPreview[];
  onAddPhotos: (files: FileList) => void;
  onRemovePhoto: (photoId: string) => void;
}

/**
 * Reusable Multiple Photo Upload UI for Garment Production Entries.
 * Prepared for Supabase Storage bucket ('production-photos') integration.
 */
export const MultiPhotoUpload: React.FC<MultiPhotoUploadProps> = ({
  photos,
  onAddPhotos,
  onRemovePhoto,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddPhotos(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          প্রোডাকশনের ছবি (একাধিক ছবি আপলোড করা যাবে)
        </label>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          নির্বাচিত ছবি: {toBengaliDigits(photos.length)} টি
        </span>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-600 dark:hover:border-teal-500 rounded-2xl p-5 text-center bg-slate-50/70 dark:bg-slate-950/50 transition-colors cursor-pointer"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto mb-2.5">
          <UploadCloud className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          এখানে ট্যাপ করে সেলাইকৃত পোশাক বা জব কার্ডের একাধিক ছবি নির্বাচন করুন
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          JPG, PNG বা WEBP ফরম্যাট · সুপাবেস স্টোরেজ বাকেট: production-photos
        </p>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
            >
              <div className="aspect-4/3 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                <img
                  src={photo.previewUrl}
                  alt={photo.fileName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {photo.fileName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {toBengaliDigits(Math.max(1, Math.round(photo.fileSize / 1024)))} কেবি
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemovePhoto(photo.id)}
                  aria-label="ছবি মুছে ফেলুন"
                  className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[110px] rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-600 dark:hover:border-teal-500 flex flex-col items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors cursor-pointer p-3"
          >
            <ImagePlus className="w-5 h-5" />
            <span className="text-xs font-medium">আরও ছবি যোগ করুন</span>
          </button>
        </div>
      )}
    </div>
  );
};
