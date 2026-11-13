import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  LogIn,
  Moon,
  Save,
  Smartphone,
  Sun,
  User,
} from 'lucide-react';
import { ModuleId, ThemeMode } from '../types/models';
import { FormInput, FormSelect } from '../components/ui/FormFields';
import { PageHeader } from '../components/ui/PageHeader';
import { PWAInstallButton } from '../components/ui/PWAInstallButton';

export interface SettingsPageProps {
  theme: ThemeMode;
  onSelectTheme: (theme: ThemeMode) => void;
  onOpenLoginView: () => void;
  onOpenExportModal?: () => void;
  onNavigate?: (module: ModuleId) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  theme,
  onSelectTheme,
  onOpenLoginView,
  onOpenExportModal,
  onNavigate,
}) => {
  const [operatorName, setOperatorName] = useState('');
  const [factoryName, setFactoryName] = useState('');
  const [machineType, setMachineType] = useState('সিঙ্গেল নিডেল লকস্টিচ (Single Needle)');
  const [lineNo, setLineNo] = useState('');
  const [savedNoticeBn, setSavedNoticeBn] = useState<string | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNoticeBn(
      'অপারেটর প্রোফাইল সেটিংস ফর্মটি প্রস্তুত। সুপাবেস সংযুক্ত হলে এটি `operator_profiles` টেবিলে সংরক্ষিত হবে।'
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        titleBn="সেটিংস, ডেটা ব্যাকআপ ও অ্যাপ ইনস্টল"
        subtitleBn="লাইট/ডার্ক থিম, সমস্ত হিসাব ব্যাকআপ/এক্সপোর্ট, স্প্রেডশিট ইমপোর্ট এবং ফোনে অ্যাপ ইনস্টল"
        primaryActionLabelBn="Google লগইন পৃষ্ঠা দেখুন"
        primaryActionIcon={<LogIn className="w-4 h-4" />}
        onPrimaryAction={onOpenLoginView}
      />

      {savedNoticeBn && (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/50 px-4 py-3 text-sm text-teal-900 dark:text-teal-200 flex items-center justify-between gap-3">
          <span>{savedNoticeBn}</span>
          <button
            type="button"
            onClick={() => setSavedNoticeBn(null)}
            className="text-xs font-semibold underline cursor-pointer shrink-0"
          >
            বন্ধ করুন
          </button>
        </div>
      )}

      {/* Data Backup / Export, Import & Mobile App Install Section */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            ডেটা ব্যাকআপ, ইমপোর্ট ও মোবাইল অ্যাপ ইনস্টল
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            আপনার সমস্ত হিসাব নিরাপদে ডাউনলোড/ব্যাকআপ করুন, পুরাতন ফাইল ইমপোর্ট করুন অথবা ফোনে অ্যাপ হিসেবে ইনস্টল করুন
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Backup / Export Card */}
          {onOpenExportModal && (
            <div className="rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/50 dark:bg-teal-950/25 p-4 flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    ডেটা ব্যাকআপ ও এক্সপোর্ট (Export)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    সকল প্রোডাকশন, মজুরি, ফান্ড ও আয়-ব্যয়ের হিসাব JSON ব্যাকআপ, Excel (.xlsx) বা CSV ফাইলে ডাউনলোড করুন।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenExportModal}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>ব্যাকআপ / এক্সপোর্ট ফাইল ডাউনলোড করুন</span>
              </button>
            </div>
          )}

          {/* Spreadsheet / Backup Import Card */}
          {onNavigate && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 p-4 flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    স্প্রেডশিট বা ব্যাকআপ ইমপোর্ট (Import)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Google Sheets, Excel (.xlsx), CSV অথবা JSON ব্যাকআপ ফাইল থেকে আপনার হিসাব ইমপোর্ট করুন।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(ModuleId.IMPORT_DATA)}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                <span>ডেটা ইমপোর্ট পেজে যান →</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile App Install (PWA) */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              মোবাইল অ্যাপ ইনস্টল (হোম স্ক্রিনে যুক্ত করুন)
            </span>
          </div>
          <PWAInstallButton variant="button" />
        </div>
      </div>

      {/* Theme Switcher Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            অ্যাপ্লিকেশন থিম (লাইট ও ডার্ক মোড)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            আপনার নির্বাচিত মোড ব্রাউজারে স্থায়ীভাবে সংরক্ষিত থাকবে, রিফ্রেশ করলেও পরিবর্তন হবে না
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelectTheme('light')}
            className={`min-h-[56px] p-4 rounded-2xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
              theme === 'light'
                ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200 font-semibold'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sun className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  লাইট মোড (Light Mode)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  উজ্জ্বল সাদা পটভূমি ও স্পষ্ট কালো অক্ষর
                </p>
              </div>
            </div>
            <span className="text-xs font-mono">
              {theme === 'light' ? 'সক্রিয়' : 'নির্বাচন করুন'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTheme('dark')}
            className={`min-h-[56px] p-4 rounded-2xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
              theme === 'dark'
                ? 'border-teal-500 bg-teal-950/60 text-teal-200 font-semibold'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-teal-400" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  ডার্ক মোড (Dark Mode)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  কম আলোতে চোখের আরাম ও ব্যাটারি সাশ্রয়ী
                </p>
              </div>
            </div>
            <span className="text-xs font-mono">
              {theme === 'dark' ? 'সক্রিয়' : 'নির্বাচন করুন'}
            </span>
          </button>
        </div>
      </div>

      {/* Operator Profile Form */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <User className="w-5 h-5 text-teal-700 dark:text-teal-400" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              সুইং মেশিন অপারেটর প্রোফাইল কনফিগারেশন
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              গার্মেন্টস কারখানার নাম, মেশিনের ধরন ও লাইন নম্বর (`operator_profiles` টেবিল)
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              id="settings-operator-name"
              labelBn="অপারেটরের পূর্ণ নাম"
              placeholder="আপনার নাম লিখুন"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
            />
            <FormInput
              id="settings-factory-name"
              labelBn="গার্মেন্টস কারখানার নাম"
              placeholder="কারখানার নাম লিখুন"
              value={factoryName}
              onChange={(e) => setFactoryName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              id="settings-machine-type"
              labelBn="সুইং মেশিনের ধরন"
              value={machineType}
              onChange={(e) => setMachineType(e.target.value)}
              options={[
                {
                  value: 'সিঙ্গেল নিডেল লকস্টিচ (Single Needle)',
                  labelBn: 'সিঙ্গেল নিডেল লকস্টিচ (Single Needle)',
                },
                {
                  value: 'ওভারলক মেশিন (Overlock Machine)',
                  labelBn: 'ওভারলক মেশিন (Overlock Machine)',
                },
                {
                  value: 'ফ্ল্যাটলক মেশিন (Flatlock Machine)',
                  labelBn: 'ফ্ল্যাটলক মেশিন (Flatlock Machine)',
                },
                {
                  value: 'ফিড অব দ্য আর্ম (Feed of the Arm)',
                  labelBn: 'ফিড অব দ্য আর্ম (Feed of the Arm)',
                },
                {
                  value: 'বারট্যাক / কানসাই মেশিন',
                  labelBn: 'বারট্যাক / কানসাই মেশিন',
                },
              ]}
            />
            <FormInput
              id="settings-line-no"
              labelBn="ফ্লোর ও লাইন নম্বর"
              placeholder="যেমন: ৩য় তলা, লাইন-০৭"
              value={lineNo}
              onChange={(e) => setLineNo(e.target.value)}
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>প্রোফাইল সেটিংস সংরক্ষণ করুন</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
