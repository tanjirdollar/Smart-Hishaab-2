import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Save,
  X,
  CheckCircle2,
  Database,
  ArrowRight,
} from 'lucide-react';
import { ApplicationRepositoryState } from '../../services/financialDomainService';
import {
  exportStateToExcelWorkbook,
  exportStateToJsonBackup,
  exportProductionEntriesToCsv,
} from '../../services/dataExportService';
import { toBengaliDigits } from '../../utils/formatters';

interface DataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  repo: ApplicationRepositoryState;
}

export const DataExportModal: React.FC<DataExportModalProps> = ({
  isOpen,
  onClose,
  repo,
}) => {
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleJsonExport = () => {
    exportStateToJsonBackup(repo);
    setDownloadSuccessMessage('সম্পূর্ণ JSON ব্যাকআপ ফাইল ডাউনলোড সম্পন্ন হয়েছে!');
  };

  const handleExcelExport = () => {
    exportStateToExcelWorkbook(repo);
    setDownloadSuccessMessage('মাল্টি-শিট Excel (.xlsx) ফাইল ডাউনলোড সম্পন্ন হয়েছে!');
  };

  const handleCsvExport = () => {
    exportProductionEntriesToCsv(repo.productionEntries);
    setDownloadSuccessMessage('প্রোডাকশন CSV ফাইল ডাউনলোড সম্পন্ন হয়েছে!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                ডেটা ব্যাকআপ ও এক্সপোর্ট
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                যেকোনো ডিভাইসে ট্রান্সফার বা এক্সেল অ্যাপে বিশ্লেষণের জন্য ডাউনলোড করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {downloadSuccessMessage && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{downloadSuccessMessage}</span>
          </div>
        )}

        {/* Current Data Overview */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">মোট প্রোডাকশন:</span>
            <strong className="text-slate-900 dark:text-white font-mono">
              {toBengaliDigits(repo.productionEntries.length)} টি এন্ট্রি
            </strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">বিল উত্তোলন:</span>
            <strong className="text-slate-900 dark:text-white font-mono">
              {toBengaliDigits(repo.paymentWithdrawals.length)} টি কিস্তি
            </strong>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">আয় ও ব্যয়:</span>
            <strong className="text-slate-900 dark:text-white font-mono">
              {toBengaliDigits(repo.incomeExpenseRecords.length)} টি রেকর্ড
            </strong>
          </div>
        </div>

        {/* Export Options */}
        <div className="space-y-3">
          {/* 1. Full JSON Backup */}
          <button
            type="button"
            onClick={handleJsonExport}
            className="w-full p-4 rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/50 dark:bg-teal-950/30 hover:bg-teal-100/60 dark:hover:bg-teal-900/40 text-left transition-colors flex items-center justify-between gap-3 group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    ১. সম্পূর্ণ ব্যাকআপ (JSON ফাইল)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-700 text-white">
                    প্রস্তাবিত
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  সব হিসাব (প্রোডাকশন, উত্তোলন, লোন, ফান্ড) হুবহু অন্য ফোন বা অ্যাপে রিস্টোর করতে
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* 2. Excel (.xlsx) Analysis Workbook */}
          <button
            type="button"
            onClick={handleExcelExport}
            className="w-full p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 text-left transition-colors flex items-center justify-between gap-3 group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  ২. এক্সেল স্প্রেডশিট অ্যানালাইসিস (.xlsx)
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Excel বা Google Sheets-এ ৫টি আলাদা ট্যাবে হিসাব বিশ্লেষণ ও প্রিন্ট করার জন্য
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* 3. CSV File */}
          <button
            type="button"
            onClick={handleCsvExport}
            className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-left transition-colors flex items-center justify-between gap-3 group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ৩. প্রোডাকশন CSV ফাইল
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  সহজ কমা-সেপারেটেড টেক্সট ফরম্যাট
                </p>
              </div>
            </div>
            <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
          </button>
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
