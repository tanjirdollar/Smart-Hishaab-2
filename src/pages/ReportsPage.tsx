import React, { useState } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  Filter,
  Printer,
} from 'lucide-react';
import { getTodayDDMMYYYY, toBengaliDigits } from '../utils/formatters';
import { EmptyDataState } from '../components/ui/EmptyDataState';
import { DateInputDDMMYYYY, FormSelect } from '../components/ui/FormFields';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/ui/SummaryCard';

export interface ReportsPageProps {
  productionCount: number;
  transactionCount: number;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  productionCount,
  transactionCount,
}) => {
  const [reportCategory, setReportCategory] = useState('production_summary');
  const [fromDate, setFromDate] = useState(getTodayDDMMYYYY(false));
  const [toDate, setToDate] = useState(getTodayDDMMYYYY(false));
  const [feedbackBn, setFeedbackBn] = useState<string | null>(null);

  const handleGenerateReport = () => {
    setFeedbackBn(
      'রিপোর্ট প্যারামিটার প্রস্তুত হয়েছে। পরবর্তী ধাপে সুপাবেস PostgreSQL ডাটাবেস সংযুক্ত হলে নির্বাচিত তারিখের (DD-MM-YYYY) প্রকৃত তথ্যের ভিত্তিতে রিপোর্ট ও পিডিএফ/সিএসভি তৈরি হবে।'
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        moduleIndexBn="০৮. বিশ্লেষণ ও সিস্টেম · রিপোর্ট"
        titleBn="প্রোডাকশন ও আর্থিক প্রতিবেদন (রিপোর্ট)"
        subtitleBn="তারিখ, সপ্তাহ এবং মাসভিত্তিক সেলাই প্রোডাকশন, মজুরি পাওনা, ঋণ এবং ব্যক্তিগত আয়-ব্যয়ের বিস্তারিত রিপোর্ট"
        primaryActionLabelBn="রিপোর্ট প্রস্তুত করুন"
        primaryActionIcon={<Filter className="w-4 h-4" />}
        onPrimaryAction={handleGenerateReport}
        secondaryActionLabelBn="প্রিন্ট লেআউট"
        secondaryActionIcon={<Printer className="w-4 h-4" />}
        onSecondaryAction={() => window.print()}
      />

      {feedbackBn && (
        <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/50 px-4 py-3 text-sm text-teal-900 dark:text-teal-200 flex items-center justify-between gap-3">
          <span>{feedbackBn}</span>
          <button
            type="button"
            onClick={() => setFeedbackBn(null)}
            className="text-xs font-semibold underline cursor-pointer shrink-0"
          >
            বন্ধ করুন
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          titleBn="প্রোডাকশন এন্ট্রি সংখ্যা"
          amount={null}
          customValueBn={`${toBengaliDigits(productionCount)} টি`}
          subtitleBn="রিপোর্টযোগ্য প্রোডাকশন রেকর্ড"
          dbColumnHint="production_entries"
          icon={<BarChart3 className="w-5 h-5" />}
          tone="accent"
        />
        <SummaryCard
          titleBn="আর্থিক লেনদেন সংখ্যা"
          amount={null}
          customValueBn={`${toBengaliDigits(transactionCount)} টি`}
          subtitleBn="রিপোর্টযোগ্য আয়-ব্যয় রেকর্ড"
          dbColumnHint="income_expense"
          icon={<FileSpreadsheet className="w-5 h-5" />}
          tone="positive"
        />
        <SummaryCard
          titleBn="নিট সঞ্চয় / উদ্বৃত্ত"
          amount={null}
          subtitleBn="সুপাবেস কোয়েরি দ্বারা গণনাযোগ্য"
          dbColumnHint="net_summary"
          icon={<Calendar className="w-5 h-5" />}
          tone="default"
        />
      </div>

      {/* Report Filter Parameters */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          রিপোর্ট ফিল্টার ও তারিখ নির্বাচন (DD-MM-YYYY)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormSelect
            id="report-category"
            labelBn="রিপোর্টের ধরন"
            value={reportCategory}
            onChange={(e) => setReportCategory(e.target.value)}
            options={[
              {
                value: 'production_summary',
                labelBn: 'দৈনিক ও মাসিক প্রোডাকশন হিসাব রিপোর্ট',
              },
              {
                value: 'wage_outstanding',
                labelBn: 'গার্মেন্টস মজুরি ও বকেয়া পাওনা রিপোর্ট',
              },
              {
                value: 'income_expense_statement',
                labelBn: 'ব্যক্তিগত আয়-ব্যয় খতিয়ান রিপোর্ট',
              },
              {
                value: 'loan_and_fund_status',
                labelBn: 'ঋণ ও ফান্ড ব্যালেন্স বিবরণী',
              },
            ]}
          />

          <DateInputDDMMYYYY
            id="report-from-date"
            labelBn="শুরুর তারিখ (DD-MM-YYYY)"
            valueDDMMYYYY={fromDate}
            onChangeDDMMYYYY={setFromDate}
          />

          <DateInputDDMMYYYY
            id="report-to-date"
            labelBn="শেষের তারিখ (DD-MM-YYYY)"
            valueDDMMYYYY={toDate}
            onChangeDDMMYYYY={setToDate}
          />
        </div>
      </div>

      {/* Report Preview Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              রিপোর্ট ফলাফল টেবিল
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              নির্বাচিত মেয়াদের সারসংক্ষেপ ও খাতওয়ারি বিভাজন
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerateReport}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>সিএসভি (CSV) কাঠামো</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3.5 px-4 whitespace-nowrap">তারিখ / মাস (DD-MM-YYYY)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">বিবরণ / খাত</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">পরিমাণ / ডজন</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">মোট টাকা (৳)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">মন্তব্য</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5}>
                  <EmptyDataState
                    titleBn="রিপোর্ট প্রদর্শনের জন্য ডাটাবেস সংযোগের অপেক্ষায়"
                    descriptionBn="এই পাতাটি সুপাবেস ডাটাবেসের প্রকৃত প্রোডাকশন ও লেনদেন কোয়েরি প্রদর্শনের জন্য প্রস্তুত করা হয়েছে। কোনো কাল্পনিক বা ভুয়া আর্থিক গণনা এখানে দেখানো হয়নি।"
                    tableNameHint="supabase_views_and_reports"
                    actionLabelBn="রিপোর্ট কোয়েরি পরীক্ষা করুন"
                    onActionClick={handleGenerateReport}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
