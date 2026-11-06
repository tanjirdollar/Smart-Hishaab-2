import React from 'react';
import { ddMmYyyyToIsoInput, isoInputToDDMMYYYY } from '../../utils/formatters';

interface DatePickerInputProps {
  label?: string;
  value: string;
  onChange: (ddMmYyyy: string) => void;
  required?: boolean;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  value,
  onChange,
  required,
}) => {
  const isoVal = ddMmYyyyToIsoInput(value);

  return (
    <div>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {label} {required ? '*' : ''}
        </label>
      )}
      <div className="relative flex items-center gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="DD-MM-YYYY"
          required={required}
          className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
        />
        <input
          type="date"
          value={isoVal}
          onChange={(e) => {
            if (e.target.value) {
              onChange(isoInputToDDMMYYYY(e.target.value));
            }
          }}
          className="w-9 h-9 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer shrink-0"
          title="ক্যালেন্ডার থেকে তারিখ নির্বাচন করুন"
        />
      </div>
    </div>
  );
};
