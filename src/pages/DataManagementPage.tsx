import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Database,
  FileJson,
  FolderArchive,
  HardDriveDownload,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { getSupabaseConnectionState } from '../lib/supabase/client';
import { SUPABASE_SCHEMA_BLUEPRINTS } from '../services/financialDomainService';
import { SUPABASE_SETUP_SQL_SCRIPT } from '../services/supabaseDataService';
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
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  const handleCopySqlScript = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SETUP_SQL_SCRIPT);
      setCopiedSql(true);
      setNoticeBn(
        'SQL কোড সফলভাবে কপি হয়েছে! এখন আপনার Supabase Dashboard → SQL Editor → New Query-তে পেস্ট করে "Run" বাটনে ক্লিক করুন।'
      );
      setTimeout(() => setCopiedSql(false), 4000);
    } catch {
      setNoticeBn('নিচের বক্স থেকে সম্পূর্ণ SQL কোডটি সিলেক্ট করে কপি করুন।');
    }
  };

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
        titleBn="ডেটা ম্যানেজমেন্ট ও সুপাবেস টেবিল সেটআপ (SQL)"
        subtitleBn="আপনার সুপাবেস প্রজেক্টে public.production_entries টেবিল তৈরির ১-ক্লিক SQL কোড এবং ডাটাবেস কাঠামো"
        primaryActionLabelBn="SQL কোড কপি করুন"
        primaryActionIcon={<Copy className="w-4 h-4" />}
        onPrimaryAction={handleCopySqlScript}
        secondaryActionLabelBn="স্কিমা ব্লুপ্রিন্ট ডাউনলোড (JSON)"
        secondaryActionIcon={<HardDriveDownload className="w-4 h-4" />}
        onSecondaryAction={handleExportStructureJson}
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

      {/* Step-by-Step SQL Table Creation Section */}
      <div className="rounded-2xl border-2 border-teal-600/80 dark:border-teal-500/80 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
              <span>
                সুপাবেস টেবিল সেটআপ: <code>public.production_entries</code> তৈরি করুন
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              যদি <em>&ldquo;Could not find the table &apos;public.production_entries&apos; in the schema cache&rdquo;</em> মেসেজ আসে, তার মানে আপনার সুপাবেস প্রজেক্টে এখনও টেবিলটি তৈরি করা হয়নি। নিচের ৩টি ধাপ অনুসরণ করুন:
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopySqlScript}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            {copiedSql ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>SQL কপি হয়েছে!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>১-ক্লিকে SQL কোড কপি করুন</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <strong className="text-teal-700 dark:text-teal-400 block mb-1">
              ধাপ ১: SQL কপি করুন
            </strong>
            উপরের <strong>&ldquo;১-ক্লিকে SQL কোড কপি করুন&rdquo;</strong> বাটনে ট্যাপ করে নিচের সম্পূর্ণ SQL কোডটি কপি করুন।
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <strong className="text-teal-700 dark:text-teal-400 block mb-1">
              ধাপ ২: Supabase SQL Editor খুলুন
            </strong>
            আপনার Supabase প্রজেক্ট ড্যাশবোর্ডে বাম পাশের মেনু থেকে <strong>SQL Editor</strong> → <strong>New query</strong>-তে যান।
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <strong className="text-teal-700 dark:text-teal-400 block mb-1">
              ধাপ ৩: পেস্ট করে Run চাপুন
            </strong>
            কোডটি পেস্ট করে সবুজ <strong>Run</strong> বাটনে ক্লিক করুন। সাথে সাথে টেবিল ও RLS পলিসি তৈরি হয়ে যাবে!
          </div>
        </div>

        <textarea
          readOnly
          rows={12}
          value={SUPABASE_SETUP_SQL_SCRIPT}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed border border-slate-800"
          aria-label="Supabase SQL Setup Script"
        />
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
          customValueBn="সক্রিয়"
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
              সকল মডিউলের টেবিল ও কলামের কাঠামো
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onResetSessionPreviewData();
              setNoticeBn('চলমান সেশনের ক্যাশ পরিষ্কার করা হয়েছে।');
            }}
            className="text-xs text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
          >
            ক্যাশ রিসেট
          </button>
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
