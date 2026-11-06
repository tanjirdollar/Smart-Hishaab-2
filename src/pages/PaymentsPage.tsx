import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { DatePickerInput } from '../components/ui/DatePickerInput';
import { PageHeader } from '../components/ui/PageHeader';
import { PaymentWithdrawalRecord } from '../types/models';
import {
  formatCurrencyBDT,
  formatNumberBn,
  getTodayDDMMYYYY,
} from '../utils/formatters';

interface PaymentsPageProps {
  withdrawals: PaymentWithdrawalRecord[];
  onSaveWithdrawal: (record: PaymentWithdrawalRecord) => void;
  onDeleteWithdrawal: (id: string) => void;
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({
  withdrawals,
  onSaveWithdrawal,
  onDeleteWithdrawal,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] =
    useState<PaymentWithdrawalRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [date, setDate] = useState(getTodayDDMMYYYY());
  const [voucherNo, setVoucherNo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('নগদ (Cash)');
  const [weekReference, setWeekReference] = useState('');
  const [amount, setAmount] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [remarks, setRemarks] = useState('');

  const summary = useMemo(() => {
    const totalWithdrawn = withdrawals.reduce(
      (sum, w) => sum + (w.amount ?? 0),
      0
    );
    const latest = withdrawals[0];
    return {
      totalWithdrawn,
      count: withdrawals.length,
      latestAmount: latest?.amount ?? 0,
      latestDate: latest?.date ?? '—',
    };
  }, [withdrawals]);

  const openCreateModal = () => {
    setEditingItem(null);
    setDate(getTodayDDMMYYYY());
    setVoucherNo(`VCH-${Date.now().toString().slice(-4)}`);
    setPaymentMethod('নগদ (Cash)');
    setWeekReference('');
    setAmount('');
    setApprovedBy('');
    setRemarks('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: PaymentWithdrawalRecord) => {
    setEditingItem(item);
    setDate(item.date);
    setVoucherNo(item.voucherNo);
    setPaymentMethod(item.paymentMethod);
    setWeekReference(item.weekReference);
    setAmount(item.amount !== null ? String(item.amount) : '');
    setApprovedBy(item.approvedBy);
    setRemarks(item.remarks);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveWithdrawal({
      id: editingItem ? editingItem.id : `wd-${Date.now()}`,
      date: date || getTodayDDMMYYYY(),
      voucherNo: voucherNo.trim() || '—',
      paymentMethod: paymentMethod.trim() || 'নগদ (Cash)',
      weekReference: weekReference.trim() || 'মজুরি উত্তোলন',
      amount: amount !== '' ? Number(amount) : null,
      approvedBy: approvedBy.trim() || 'স্ব-এন্ট্রি',
      remarks: remarks.trim() || 'বিল উত্তোলন',
    });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        titleBn="বিল ও মজুরি উত্তোলন"
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-teal-700 hover:bg-teal-800 text-white shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            বিল উত্তোলন যোগ করুন
          </button>
        }
      />

      {/* Single Minimal Summary Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
        <div className="grid grid-cols-3 gap-3 divide-x divide-slate-200 dark:divide-slate-800">
          <div className="pr-2">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              সর্বমোট উত্তোলন
            </p>
            <p className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {formatCurrencyBDT(summary.totalWithdrawn)}
            </p>
          </div>
          <div className="px-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              মোট কিস্তি সংখ্যা
            </p>
            <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {formatNumberBn(summary.count)}টি
            </p>
          </div>
          <div className="pl-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              সর্বশেষ উত্তোলন ({summary.latestDate})
            </p>
            <p className="text-base sm:text-xl font-bold text-teal-700 dark:text-teal-300 mt-0.5">
              {formatCurrencyBDT(summary.latestAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Withdrawals List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        {withdrawals.length === 0 ? (
          <p className="text-xs text-slate-500 py-10 text-center">
            কোনো বিল উত্তোলনের রেকর্ড নেই।
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {withdrawals.map((row) => (
              <div
                key={row.id}
                className="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {row.weekReference || row.remarks || 'বিল উত্তোলন'}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {row.paymentMethod}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    তারিখ: {row.date}
                    {row.remarks && row.remarks !== row.weekReference
                      ? ` · ${row.remarks}`
                      : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrencyBDT(row.amount)}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(row)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/50 cursor-pointer"
                      title="সম্পাদনা"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {confirmDeleteId === row.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteWithdrawal(row.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 text-[10px] font-bold rounded-lg bg-rose-600 text-white cursor-pointer"
                        >
                          নিশ্চিত?
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-1 text-[10px] font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          না
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(row.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingItem ? 'উত্তোলন সম্পাদনা করুন' : 'নতুন বিল উত্তোলন যোগ করুন'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DatePickerInput
                  label="তারিখ (DD-MM-YYYY)"
                  value={date}
                  onChange={setDate}
                  required
                />
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    উত্তোলিত টাকা (৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="যেমন: 3000"
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    কিস্তি / সপ্তাহ রেফারেন্স
                  </label>
                  <input
                    type="text"
                    value={weekReference}
                    onChange={(e) => setWeekReference(e.target.value)}
                    placeholder="যেমন: ১৭তম কিস্তি"
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    পেমেন্ট মাধ্যম
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="নগদ (Cash)">নগদ (Cash)</option>
                    <option value="বিকাশ">বিকাশ</option>
                    <option value="নগদ (Nagad)">নগদ (Nagad)</option>
                    <option value="ব্যাংক ট্রান্সফার">ব্যাংক ট্রান্সফার</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  মন্তব্য
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="সংক্ষিপ্ত নোট"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-700 hover:bg-teal-800 text-white cursor-pointer"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
