import React, { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  Plus,
  Search,
  Trash2,
  Wallet,
} from 'lucide-react';
import { WageLedgerRecord } from '../types/models';
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
} from '../components/ui/FormFields';
import { ModalDrawer } from '../components/ui/ModalDrawer';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/ui/SummaryCard';

export interface WageLedgerPageProps {
  records: WageLedgerRecord[];
  onSaveRecord: (record: WageLedgerRecord) => void;
  onDeleteRecord: (id: string) => void;
}

export const WageLedgerPage: React.FC<WageLedgerPageProps> = ({
  records,
  onSaveRecord,
  onDeleteRecord,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState('');
  const [startDate, setStartDate] = useState(getTodayDDMMYYYY(false));
  const [endDate, setEndDate] = useState(getTodayDDMMYYYY(false));
  const [lineNumber, setLineNumber] = useState('');
  const [totalDozens, setTotalDozens] = useState('');
  const [totalPieces, setTotalPieces] = useState('');
  const [earnedWage, setEarnedWage] = useState('');
  const [paidWage, setPaidWage] = useState('');
  const [outstandingWage, setOutstandingWage] = useState('');
  const [statusLabel, setStatusLabel] = useState('আংশিক বকেয়া');

  const openNewModal = () => {
    setEditingId(null);
    setPeriodLabel('');
    setStartDate(getTodayDDMMYYYY(false));
    setEndDate(getTodayDDMMYYYY(false));
    setLineNumber('');
    setTotalDozens('');
    setTotalPieces('');
    setEarnedWage('');
    setPaidWage('');
    setOutstandingWage('');
    setStatusLabel('আংশিক বকেয়া');
    setIsModalOpen(true);
  };

  const openEditModal = (rec: WageLedgerRecord) => {
    setEditingId(rec.id);
    setPeriodLabel(rec.periodLabel);
    setStartDate(rec.startDate);
    setEndDate(rec.endDate);
    setLineNumber(rec.lineNumber);
    setTotalDozens(rec.totalDozens !== null ? String(rec.totalDozens) : '');
    setTotalPieces(rec.totalPieces !== null ? String(rec.totalPieces) : '');
    setEarnedWage(rec.earnedWage !== null ? String(rec.earnedWage) : '');
    setPaidWage(rec.paidWage !== null ? String(rec.paidWage) : '');
    setOutstandingWage(rec.outstandingWage !== null ? String(rec.outstandingWage) : '');
    setStatusLabel(rec.statusLabel);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parseNum = (v: string) => {
      const clean = toAsciiDigits(v).trim();
      if (!clean) return null;
      const n = Number(clean);
      return Number.isFinite(n) ? n : null;
    };

    onSaveRecord({
      id: editingId ?? `wage-${Date.now()}`,
      periodLabel: periodLabel.trim() || 'সাপ্তাহিক মজুরি হিসাব',
      startDate: startDate || getTodayDDMMYYYY(false),
      endDate: endDate || getTodayDDMMYYYY(false),
      lineNumber: lineNumber.trim() || 'লাইন-০১',
      totalDozens: parseNum(totalDozens),
      totalPieces: parseNum(totalPieces),
      earnedWage: parseNum(earnedWage),
      paidWage: parseNum(paidWage),
      outstandingWage: parseNum(outstandingWage),
      statusLabel,
    });
    setIsModalOpen(false);
  };

  const filteredRecords = records.filter((rec) => {
    if (statusFilter !== 'ALL' && rec.statusLabel !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !`${rec.periodLabel} ${rec.lineNumber} ${rec.startDate} ${rec.endDate}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        moduleIndexBn="০৩. প্রধান মডিউল · মজুরি ও পাওনা"
        titleBn="মজুরি ও পাওনা খতিয়ান"
        subtitleBn="গার্মেন্টস কোম্পানি থেকে সাপ্তাহিক ও মাসিক অর্জিত মজুরি, পরিশোধিত টাকা এবং অবশিষ্ট বকেয়া পাওনার হিসাব"
        primaryActionLabelBn="নতুন মজুরি এন্ট্রি"
        primaryActionIcon={<Plus className="w-4 h-4" />}
        onPrimaryAction={openNewModal}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          titleBn="মোট অর্জিত মজুরি"
          amount={null}
          subtitleBn="সকল মেয়াদের মোট অর্জিত মজুরি"
          dbColumnHint="earned_wage"
          icon={<ClipboardCheck className="w-5 h-5" />}
          tone="accent"
        />
        <SummaryCard
          titleBn="মোট প্রাপ্ত মজুরি"
          amount={null}
          subtitleBn="গার্মেন্টস কর্তৃক পরিশোধিত টাকা"
          dbColumnHint="paid_wage"
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="positive"
        />
        <SummaryCard
          titleBn="গার্মেন্টস থেকে মোট পাওনা"
          amount={null}
          subtitleBn="বর্তমান বকেয়া অপরিশোধিত মজুরি"
          dbColumnHint="outstanding_wage"
          icon={<Clock className="w-5 h-5" />}
          tone="warning"
        />
        <SummaryCard
          titleBn="মজুরি মেয়াদ সংখ্যা"
          amount={null}
          customValueBn={`${toBengaliDigits(records.length)} টি`}
          subtitleBn="সংরক্ষিত সাপ্তাহিক/মাসিক খতিয়ান"
          dbColumnHint="wage_periods"
          icon={<Wallet className="w-5 h-5" />}
          tone="default"
        />
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="মেয়াদের নাম, লাইন নম্বর বা তারিখ (DD-MM-YYYY) দিয়ে খুঁজুন..."
            className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
        <FormSelect
          id="wage-status-filter"
          labelBn=""
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: 'ALL', labelBn: 'সকল পরিশোধ অবস্থা' },
            { value: 'পূর্ণ পরিশোধিত', labelBn: 'পূর্ণ পরিশোধিত' },
            { value: 'আংশিক বকেয়া', labelBn: 'আংশিক বকেয়া' },
            { value: 'অপরিশোধিত', labelBn: 'অপরিশোধিত' },
          ]}
        />
      </div>

      {/* Wage Ledger Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            মজুরি ও বকেয়া পাওনার তালিকা
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            টেবিল: wage_periods
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3.5 px-4 whitespace-nowrap">মজুরি মেয়াদ ও লাইন</th>
                <th className="py-3.5 px-4 whitespace-nowrap">সময়কাল (DD-MM-YYYY)</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">ডজন ও পিস</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">অর্জিত মজুরি (৳)</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">প্রাপ্ত টাকা (৳)</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">বকেয়া পাওনা (৳)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">অবস্থা</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyDataState
                      titleBn="কোনো মজুরি ও পাওনার হিসাব পাওয়া যায়নি"
                      descriptionBn="সুপাবেস ডাটাবেস সংযুক্ত হলে বা নতুন মজুরি মেয়াদ যুক্ত করলে এখানে অর্জিত মজুরি ও কোম্পানির নিকট পাওনা টাকার খতিয়ান দেখা যাবে।"
                      tableNameHint="wage_periods"
                      actionLabelBn="নতুন মজুরি এন্ট্রি যোগ করুন"
                      onActionClick={openNewModal}
                    />
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {rec.periodLabel} · {rec.lineNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDateDDMMYYYY(rec.startDate, true)} হতে{' '}
                      {formatDateDDMMYYYY(rec.endDate, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {toBengaliDigits(rec.totalDozens ?? 0)} ডজন ·{' '}
                      {toBengaliDigits(rec.totalPieces ?? 0)} পিস
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatTaka(rec.earnedWage, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {formatTaka(rec.paidWage, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                      {formatTaka(rec.outstandingWage, true)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {rec.statusLabel}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(rec)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>সম্পাদনা</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(rec.id)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1 cursor-pointer"
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
      </div>

      {/* Add / Edit Wage Record Modal */}
      <ModalDrawer
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        titleBn={editingId ? 'মজুরি হিসাব সম্পাদনা করুন' : 'নতুন মজুরি ও পাওনা এন্ট্রি'}
        subtitleBn="সাপ্তাহিক বা মাসিক প্রোডাকশন মজুরি এবং বকেয়া পাওনার তথ্য"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              id="wage-period-label"
              labelBn="মজুরি মেয়াদের নাম"
              placeholder="যেমন: নভেম্বর ১ম সপ্তাহ"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
            />
            <FormInput
              id="wage-line-number"
              labelBn="ফ্লোর / লাইন নম্বর"
              placeholder="যেমন: লাইন-০৪ (সুইং)"
              value={lineNumber}
              onChange={(e) => setLineNumber(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInputDDMMYYYY
              id="wage-start-date"
              labelBn="শুরুর তারিখ (DD-MM-YYYY)"
              valueDDMMYYYY={startDate}
              onChangeDDMMYYYY={setStartDate}
            />
            <DateInputDDMMYYYY
              id="wage-end-date"
              labelBn="শেষের তারিখ (DD-MM-YYYY)"
              valueDDMMYYYY={endDate}
              onChangeDDMMYYYY={setEndDate}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              id="wage-dozens"
              labelBn="মোট ডজন"
              placeholder="যেমন: ৪৫"
              rightUnitBn="ডজন"
              value={totalDozens}
              onChange={(e) => setTotalDozens(e.target.value)}
            />
            <FormInput
              id="wage-pieces"
              labelBn="মোট পিস"
              placeholder="যেমন: ৮"
              rightUnitBn="পিস"
              value={totalPieces}
              onChange={(e) => setTotalPieces(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput
              id="wage-earned"
              labelBn="অর্জিত মজুরি (৳)"
              placeholder="০.০০"
              rightUnitBn="৳"
              value={earnedWage}
              onChange={(e) => setEarnedWage(e.target.value)}
            />
            <FormInput
              id="wage-paid"
              labelBn="প্রাপ্ত মজুরি (৳)"
              placeholder="০.০০"
              rightUnitBn="৳"
              value={paidWage}
              onChange={(e) => setPaidWage(e.target.value)}
            />
            <FormInput
              id="wage-outstanding"
              labelBn="বকেয়া পাওনা (৳)"
              placeholder="০.০০"
              rightUnitBn="৳"
              value={outstandingWage}
              onChange={(e) => setOutstandingWage(e.target.value)}
            />
          </div>

          <FormSelect
            id="wage-status-select"
            labelBn="পরিশোধের অবস্থা"
            value={statusLabel}
            onChange={(e) => setStatusLabel(e.target.value)}
            options={[
              { value: 'আংশিক বকেয়া', labelBn: 'আংশিক বকেয়া' },
              { value: 'অপরিশোধিত', labelBn: 'অপরিশোধিত' },
              { value: 'পূর্ণ পরিশোধিত', labelBn: 'পূর্ণ পরিশোধিত' },
            ]}
          />

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium cursor-pointer"
            >
              বাতিল করুন
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold cursor-pointer"
            >
              সংরক্ষণ করুন
            </button>
          </div>
        </form>
      </ModalDrawer>
    </div>
  );
};
