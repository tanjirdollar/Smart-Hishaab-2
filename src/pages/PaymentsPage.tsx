import React, { useState } from 'react';
import {
  Banknote,
  Calendar,
  Edit3,
  FileText,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { PAYMENT_METHOD_OPTIONS } from '../config/navigation';
import { PaymentWithdrawalRecord } from '../types/models';
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
} from '../components/ui/FormFields';
import { ModalDrawer } from '../components/ui/ModalDrawer';
import { PageHeader } from '../components/ui/PageHeader';
import { SummaryCard } from '../components/ui/SummaryCard';

export interface PaymentsPageProps {
  withdrawals: PaymentWithdrawalRecord[];
  onSaveWithdrawal: (record: PaymentWithdrawalRecord) => void;
  onDeleteWithdrawal: (id: string) => void;
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({
  withdrawals,
  onSaveWithdrawal,
  onDeleteWithdrawal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayDDMMYYYY(false));
  const [voucherNo, setVoucherNo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD_OPTIONS[0]);
  const [weekReference, setWeekReference] = useState('');
  const [amount, setAmount] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [remarks, setRemarks] = useState('');

  const openAddModal = () => {
    setEditingId(null);
    setDate(getTodayDDMMYYYY(false));
    setVoucherNo('');
    setPaymentMethod(PAYMENT_METHOD_OPTIONS[0]);
    setWeekReference('');
    setAmount('');
    setApprovedBy('');
    setRemarks('');
    setIsModalOpen(true);
  };

  const openEditModal = (rec: PaymentWithdrawalRecord) => {
    setEditingId(rec.id);
    setDate(rec.date);
    setVoucherNo(rec.voucherNo);
    setPaymentMethod(rec.paymentMethod);
    setWeekReference(rec.weekReference);
    setAmount(rec.amount !== null ? String(rec.amount) : '');
    setApprovedBy(rec.approvedBy);
    setRemarks(rec.remarks);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmt = toAsciiDigits(amount).trim();
    const parsedAmt = cleanAmt && Number.isFinite(Number(cleanAmt)) ? Number(cleanAmt) : null;

    onSaveWithdrawal({
      id: editingId ?? `pay-${Date.now()}`,
      date: date || getTodayDDMMYYYY(false),
      voucherNo: voucherNo.trim() || 'SLIP-01',
      paymentMethod,
      weekReference: weekReference.trim() || 'সাপ্তাহিক উত্তোলন',
      amount: parsedAmt,
      approvedBy: approvedBy.trim() || 'হিসাব শাখা',
      remarks: remarks.trim(),
    });
    setIsModalOpen(false);
  };

  const filtered = withdrawals.filter((w) => {
    if (methodFilter !== 'ALL' && w.paymentMethod !== methodFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !`${w.voucherNo} ${w.weekReference} ${w.remarks} ${w.date}`
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
        moduleIndexBn="০৪. প্রধান মডিউল · টাকা উত্তোলন"
        titleBn="টাকা উত্তোলন ও পেমেন্ট রেকর্ড"
        subtitleBn="গার্মেন্টস কোম্পানি থেকে সাপ্তাহিক বা মাসিক মজুরি বাবদ নগদ, বিকাশ বা ব্যাংকে উত্তোলিত টাকার হিসাব"
        primaryActionLabelBn="নতুন টাকা উত্তোলন যোগ করুন"
        primaryActionIcon={<Plus className="w-4 h-4" />}
        onPrimaryAction={openAddModal}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          titleBn="এই সপ্তাহের মোট উত্তোলন"
          amount={null}
          subtitleBn="চলতি সপ্তাহে গার্মেন্টস হতে প্রাপ্ত টাকা"
          dbColumnHint="weekly_withdrawals"
          icon={<Banknote className="w-5 h-5" />}
          tone="accent"
        />
        <SummaryCard
          titleBn="এই মাসের মোট উত্তোলন"
          amount={null}
          subtitleBn="চলতি মাসের সর্বমোট উত্তোলিত মজুরি"
          dbColumnHint="monthly_withdrawals"
          icon={<Calendar className="w-5 h-5" />}
          tone="positive"
        />
        <SummaryCard
          titleBn="মোট ভাউচার / স্লিপ সংখ্যা"
          amount={null}
          customValueBn={`${toBengaliDigits(withdrawals.length)} টি`}
          subtitleBn="সংরক্ষিত পেমেন্ট উত্তোলন রসিদ"
          dbColumnHint="payment_withdrawals"
          icon={<FileText className="w-5 h-5" />}
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
            placeholder="ভাউচার নম্বর, সপ্তাহ বা তারিখ (DD-MM-YYYY) খুঁজুন..."
            className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
        <FormSelect
          id="payment-method-filter"
          labelBn=""
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          options={[
            { value: 'ALL', labelBn: 'সকল পেমেন্ট মাধ্যম' },
            ...PAYMENT_METHOD_OPTIONS.map((m) => ({ value: m, labelBn: m })),
          ]}
        />
      </div>

      {/* Withdrawals Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            টাকা উত্তোলনের ইতিহাস
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            টেবিল: payment_withdrawals
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3.5 px-4 whitespace-nowrap">তারিখ (DD-MM-YYYY)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">ভাউচার / স্লিপ নম্বর</th>
                <th className="py-3.5 px-4 whitespace-nowrap">সপ্তাহ / রেফারেন্স</th>
                <th className="py-3.5 px-4 whitespace-nowrap">পেমেন্ট মাধ্যম</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">উত্তোলিত টাকা (৳)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">মন্তব্য</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyDataState
                      titleBn="কোনো টাকা উত্তোলনের রেকর্ড নেই"
                      descriptionBn="গার্মেন্টস থেকে মজুরি বা অগ্রিম টাকা উত্তোলন করলে তার তারিখ, ভাউচার নম্বর ও পরিমাণ এখানে তালিকাভুক্ত থাকবে।"
                      tableNameHint="payment_withdrawals"
                      actionLabelBn="নতুন টাকা উত্তোলন যোগ করুন"
                      onActionClick={openAddModal}
                      icon={<Banknote className="w-6 h-6" />}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {formatDateDDMMYYYY(rec.date, true)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {rec.voucherNo}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {rec.weekReference}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {rec.paymentMethod}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatTaka(rec.amount, true)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {rec.remarks || '—'}
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
                          onClick={() => onDeleteWithdrawal(rec.id)}
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

      <ModalDrawer
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        titleBn={
          editingId ? 'টাকা উত্তোলন তথ্য সম্পাদনা' : 'নতুন টাকা উত্তোলন এন্ট্রি'
        }
        subtitleBn="উত্তোলনের তারিখ (DD-MM-YYYY), পেমেন্ট মাধ্যম এবং টাকার পরিমাণ"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInputDDMMYYYY
              id="pay-date"
              labelBn="উত্তোলনের তারিখ (DD-MM-YYYY)"
              valueDDMMYYYY={date}
              onChangeDDMMYYYY={setDate}
            />
            <FormInput
              id="pay-voucher"
              labelBn="ভাউচার / স্লিপ নম্বর"
              placeholder="যেমন: VCH-২০২৬-০১"
              value={voucherNo}
              onChange={(e) => setVoucherNo(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              id="pay-method"
              labelBn="পেমেন্ট মাধ্যম"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              options={PAYMENT_METHOD_OPTIONS.map((m) => ({ value: m, labelBn: m }))}
            />
            <FormInput
              id="pay-amount"
              labelBn="উত্তোলিত টাকার পরিমাণ (৳)"
              placeholder="০.০০"
              rightUnitBn="৳"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              id="pay-week-ref"
              labelBn="সপ্তাহ বা মাসের রেফারেন্স"
              placeholder="যেমন: ২য় সপ্তাহের মজুরি"
              value={weekReference}
              onChange={(e) => setWeekReference(e.target.value)}
            />
            <FormInput
              id="pay-approved-by"
              labelBn="প্রদানকারী কর্মকর্তা / সুপারভাইজার"
              placeholder="যেমন: ক্যাশ সেকশন"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
            />
          </div>

          <FormTextarea
            id="pay-remarks"
            labelBn="সংক্ষিপ্ত মন্তব্য"
            placeholder="প্রয়োজনীয় নোট লিখুন..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
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
