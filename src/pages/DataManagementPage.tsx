import React, { useState } from 'react';
import {
  CloudOff,
  Database,
  FileJson,
  FolderArchive,
  HardDriveDownload,
  ShieldCheck,
} from 'lucide-react';
import { getSupabaseConnectionState } from '../lib/supabase/client';
import { SUPABASE_SCHEMA_BLUEPRINTS } from '../services/financialDomainService';
import { toBengaliDigits } from '../utils/formatters';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/ui/SummaryCard';

export interface DataManagementPageProps {
  onResetSessionPreviewData: () => void;
}

export const DataManagementPage: React.FC<DataManagementPageProps> = ({
  onResetSessionPreviewData,
}) => {
  const supabaseState = getSupabaseConnectionState();
  const [noticeBn, setNoticeBn] = useState<string | null>(null);

  const handleExportStructureJson = () => {
    const schemaPayload = {
      appName: 'Smart Hisab — স্মার্ট হিসাব',
      phase: 'Phase 2 Enhanced Production, Weekly Report & Import',
      currency: 'BDT (৳)',
      dateFormat: 'DD-MM-YYYY',
      weeklyCalendar: 'Saturday to Thursday (Friday excluded)',
      supabaseConfigured: supabaseState.isConfigured,
      storageBucket: supabaseState.storageBucket,
      tables: SUPABASE_SCHEMA_BLUEPRINTS,
    };
    const blob = new Blob([JSON.stringify(schemaPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'smart-hisab-supabase-schema.json';
    link.click();
    URL.revokeObjectURL(url);
    setNoticeBn('সুপাবেস ডাটাবেস স্কিমা ব্লুপ্রিন্ট (JSON) ডাউনলোড হয়েছে।');
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <PageHeader
        moduleIndexBn="১১. বিশ্লেষণ ও সিস্টেম · ডেটা ম্যানেজমেন্ট"
        titleBn="ডেটা ম্যানেজমেন্ট ও সুপাবেস ডাটাবেস আর্কিটেকচার"
        subtitleBn="সুপাবেস (Supabase) ক্লাউড ডাটাবেস, মাইগ্রেশন স্ক্রিপ্ট, অথেনটিকেশন এবং ফটো স্টোরেজ বাকেটের কাঠামো"
        primaryActionLabelBn="স্কিমা ব্লুপ্রিন্ট ডাউনলোড (JSON)"
        primaryActionIcon={<HardDriveDownload className="w-4 h-4" />}
        onPrimaryAction={handleExportStructureJson}
        secondaryActionLabelBn="সেশন প্রিভিউ ডেটা রিসেট"
        onSecondaryAction={() => {
          onResetSessionPreviewData();
          setNoticeBn('চলমান সেশনের পরীক্ষামূলক ফর্ম এন্ট্রিগুলো পরিষ্কার করা হয়েছে।');
        }}
      />

      {noticeBn && (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/50 px-4 py-3 text-sm text-teal-900 dark:text-teal-200 flex items-center justify-between gap-3">
          <span>{noticeBn}</span>
          <button
            type="button"
            onClick={() => setNoticeBn(null)}
            className="text-xs font-semibold underline cursor-pointer shrink-0"
          >
            বন্ধ করুন
          </button>
        </div>
      )}

      {/* Honest Cloud Status Notice */}
      <div className="rounded-2xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/70 dark:bg-amber-950/30 p-4 sm:p-5 flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
          <CloudOff className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            ক্লাউড সিঙ্ক্রোনাইজেশন স্ট্যাটাস: {supabaseState.statusMessageBn}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            এই প্রথম ডেভেলপমেন্ট ধাপে অ্যাপ্লিকেশনের পূর্ণাঙ্গ ইউজার ইন্টারফেস, রেসপনসিভ লেআউট এবং সুপাবেস ইন্টিগ্রেশন আর্কিটেকচার প্রস্তুত করা হয়েছে। স্থায়ী আর্থিক ডাটাবেস হিসেবে ব্রাউজারের localStorage ব্যবহার করা হয়নি এবং সুপাবেস সংযুক্ত না হওয়া পর্যন্ত কোনো ভুয়া ক্লাউড সিঙ্ক দাবি করা হচ্ছে না।
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          titleBn="প্রস্তুতকৃত সুপাবেস টেবিল"
          amount={null}
          customValueBn={`${toBengaliDigits(SUPABASE_SCHEMA_BLUEPRINTS.length)} টি`}
          subtitleBn="PostgreSQL রিলেশনাল টেবিল স্কিমা"
          dbColumnHint="public.*"
          icon={<Database className="w-5 h-5" />}
          tone="accent"
        />
        <SummaryCard
          titleBn="ফটো স্টোরেজ বাকেট"
          amount={null}
          customValueBn="production-photos"
          subtitleBn="একাধিক প্রোডাকশন ছবি সংরক্ষণের বাকেট"
          dbColumnHint="Supabase Storage"
          icon={<FolderArchive className="w-5 h-5" />}
          tone="positive"
        />
        <SummaryCard
          titleBn="নিরাপত্তা নীতিমালা (RLS)"
          amount={null}
          customValueBn="প্রস্তুত"
          subtitleBn="Google OAuth ও Row Level Security"
          dbColumnHint="auth.uid()"
          icon={<ShieldCheck className="w-5 h-5" />}
          tone="default"
        />
      </div>

      {/* Supabase Schema Blueprints Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              সুপাবেস ডাটাবেস টেবিল ও কলাম আর্কিটেকচার
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              পরবর্তী ধাপে সরাসরি সুপাবেস প্রজেক্টে যুক্ত করার জন্য প্রস্তুতকৃত টেবিল কাঠামো
            </p>
          </div>
          <FileJson className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3.5 px-4 whitespace-nowrap">টেবিলের নাম (PostgreSQL)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">মডিউল ও উদ্দেশ্য</th>
                <th className="py-3.5 px-4">প্রধান কলামসমূহ</th>
                <th className="py-3.5 px-4 whitespace-nowrap">নিরাপত্তা নীতি (RLS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {SUPABASE_SCHEMA_BLUEPRINTS.map((table) => (
                <tr
                  key={table.tableName}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-4 px-4 font-mono text-xs font-bold text-teal-700 dark:text-teal-400 whitespace-nowrap align-top">
                    {table.tableName}
                  </td>
                  <td className="py-4 px-4 align-top">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {table.titleBn}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {table.purposeBn}
                    </p>
                  </td>
                  <td className="py-4 px-4 font-mono text-xs text-slate-600 dark:text-slate-300 align-top">
                    {table.columns.join(' · ')}
                  </td>
                  <td className="py-4 px-4 text-xs text-slate-600 dark:text-slate-400 align-top">
                    {table.rlsPolicyBn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
