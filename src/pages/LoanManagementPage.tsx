import React, { useMemo, useState } from 'react';
import { CheckCircle2, Edit2, HandCoins, Plus, Trash2, X } from 'lucide-react';
import { DatePickerInput } from '../components/ui/DatePickerInput';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoanRecord } from '../types/models';
import {
  formatCurrencyBDT,
  formatNumberBn,
  getTodayDDMMYYYY,
} from '../utils/formatters';

interface LoanManagementPageProps {
  loans: LoanRecord[];
  onSaveLoan: (loan: LoanRecord) => void;
  onDeleteLoan: (id: string) => void;
}

export const LoanManagementPage: React.FC<LoanManagementPageProps> = ({
  loans,
  onSaveLoan,
  onDeleteLoan,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Quick installment repayment modal state
  const [repayLoan, setRepayLoan] = useState<LoanRecord | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(getTodayDDMMYYYY());
  const [repayNote, setRepayNote] = useState('');

  // Create / Edit Loan state
  const [loanDirection, setLoanDirection] = useState<'receivable' | 'payable'>(
    'payable'
  );
  const [counterpartyName, setCounterpartyName] = useState('');
  const [issueDate, setIssueDate] = useState(getTodayDDMMYYYY());
  const [principalAmount, setPrincipalAmount] = useState('');
  const [settledAmount, setSettledAmount] = useState('');
  const [notes, setNotes] = useState('');

  const summary = useMemo(() => {
    const totalPrincipal = loans.reduce(
      (sum, l) => sum + (l.principalAmount ?? 0),
      0
    );
    const totalSettled = loans.reduce(
      (sum, l) => sum + (l.settledAmount ?? 0),
      0
    );
    const totalRemaining = loans.reduce(
      (sum, l) => sum + (l.remainingBalance ?? 0),
      0
    );
    return {
      totalPrincipal,
      totalSettled,
      totalRemaining,
      count: loans.length,
    };
  }, [loans]);

  const openCreateModal = () => {
    setEditingLoan(null);
    setLoanDirection('payable');
    setCounterpartyName('');
    setIssueDate(getTodayDDMMYYYY());
    setPrincipalAmount('');
    setSettledAmount('0');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: LoanRecord) => {
    setEditingLoan(item);
    setLoanDirection(item.loanDirection);
    setCounterpartyName(item.counterpartyName);
    setIssueDate(item.issueDate);
    setPrincipalAmount(
      item.principalAmount !== null ? String(item.principalAmount) : ''
    );
    setSettledAmount(
      item.settledAmount !== null ? String(item.settledAmount) : '0'
    );
    setNotes(item.notes);
    setIsModalOpen(true);
  };

  const openRepayModal = (loan: LoanRecord) => {
    setRepayLoan(loan);
    setRepayAmount(
      loan.remainingBalance && loan.remainingBalance > 0
        ? String(loan.remainingBalance)
        : ''
    );
    setRepayDate(getTodayDDMMYYYY());
    setRepayNote('');
  };

  const handleSaveRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayLoan) return;
    const amt = Number(repayAmount);
    if (!amt || amt <= 0) return;

    const prevSettled = repayLoan.settledAmount ?? 0;
    const prevRem =
      repayLoan.remainingBalance ??
      Math.max(0, (repayLoan.principalAmount ?? 0) - prevSettled);
    const nextSettled = Number((prevSettled + amt).toFixed(2));
    const nextRem = Number(Math.max(0, prevRem - amt).toFixed(2));
    const logEntry = `[${repayDate}] কিস্তি পরিশোধ: ৳${amt}${
      repayNote.trim() ? ` (${repayNote.trim()})` : ''
    }`;

    onSaveLoan({
      ...repayLoan,
      settledAmount: nextSettled,
      remainingBalance: nextRem,
      statusLabel: nextRem === 0 ? 'পরিশোধিত' : 'আংশিক বাকি',
      notes: repayLoan.notes ? `${logEntry} | ${repayLoan.notes}` : logEntry,
    });
    setRepayLoan(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = principalAmount !== '' ? Number(principalAmount) : 0;
    const s = settledAmount !== '' ? Number(settledAmount) : 0;
    const rem = Math.max(0, Number((p - s).toFixed(2)));

    onSaveLoan({
      id: editingLoan ? editingLoan.id : `loan-${Date.now()}`,
      loanDirection,
      counterpartyName: counterpartyName.trim() || 'লোন হিসাব',
      phone: editingLoan?.phone || '',
      issueDate: issueDate || getTodayDDMMYYYY(),
      dueDate: editingLoan?.dueDate || issueDate || getTodayDDMMYYYY(),
      principalAmount: p,
      settledAmount: s,
      remainingBalance: rem,
      statusLabel: rem === 0 ? 'পরিশোধিত' : 'আংশিক বাকি',
      notes: notes.trim(),
    });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        titleBn="লোন ও কিস্তি পরিশোধ"
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-teal-700 hover:bg-teal-800 text-white shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            নতুন লোন যোগ করুন
          </button>
        }
      />

      {/* Minimal Unified Summary Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
        <div className="grid grid-cols-3 gap-3 divide-x divide-slate-200 dark:divide-slate-800">
          <div className="pr-2">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              মোট মূল লোন ({formatNumberBn(summary.count)}টি)
            </p>
            <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {formatCurrencyBDT(summary.totalPrincipal)}
            </p>
          </div>
          <div className="px-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              মোট পরিশোধিত
            </p>
            <p className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {formatCurrencyBDT(summary.totalSettled)}
            </p>
          </div>
          <div className="pl-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              বর্তমান লোন বাকি
            </p>
            <p className="text-base sm:text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
              {formatCurrencyBDT(summary.totalRemaining)}
            </p>
          </div>
        </div>
      </div>

      {/* Loans List */}
      <div className="space-y-3">
        {loans.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
            কোনো লোন হিসাব নেই।
          </div>
        ) : (
          loans.map((row) => {
            const isPaidOff = (row.remainingBalance ?? 0) <= 0;
            return (
              <div
                key={row.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {row.counterpartyName}
                    </h3>
                    <StatusBadge
                      label={isPaidOff ? 'পরিশোধিত' : 'বাকি আছে'}
                      variant={isPaidOff ? 'success' : 'warning'}
                    />
                    <span className="text-[11px] text-slate-500">
                      তারিখ: {row.issueDate}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="text-slate-600 dark:text-slate-300">
                      মূল লোন:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {formatCurrencyBDT(row.principalAmount)}
                      </strong>
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      পরিশোধিত:{' '}
                      <strong>{formatCurrencyBDT(row.settledAmount)}</strong>
                    </span>
                    <span className="text-amber-700 dark:text-amber-400 font-bold">
                      বাকি: {formatCurrencyBDT(row.remainingBalance)}
                    </span>
                  </div>

                  {row.notes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                      {row.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                  {!isPaidOff ? (
                    <button
                      type="button"
                      onClick={() => openRepayModal(row)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer"
                    >
                      <HandCoins className="w-3.5 h-3.5" />
                      কিস্তি পরিশোধ
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      সম্পূর্ণ পরিশোধিত
                    </span>
                  )}

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
                            onDeleteLoan(row.id);
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
            );
          })
        )}
      </div>

      {/* Quick Loan Repayment Modal */}
      {repayLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {repayLoan.counterpartyName} — কিস্তি পরিশোধ
              </h3>
              <button
                type="button"
                onClick={() => setRepayLoan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveRepayment} className="p-5 space-y-3.5">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-xs flex items-center justify-between">
                <span className="text-amber-800 dark:text-amber-300">
                  বর্তমান বকেয়া:
                </span>
                <span className="font-bold text-amber-800 dark:text-amber-300">
                  {formatCurrencyBDT(repayLoan.remainingBalance)}
                </span>
              </div>
              <DatePickerInput
                label="পরিশোধের তারিখ"
                value={repayDate}
                onChange={setRepayDate}
                required
              />
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  পরিশোধের পরিমাণ (৳) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={repayNote}
                  onChange={(e) => setRepayNote(e.target.value)}
                  placeholder="যেমন: বিকাশ কিস্তি পরিশোধ"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRepayLoan(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-700 hover:bg-teal-800 text-white cursor-pointer"
                >
                  পরিশোধ সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Loan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingLoan ? 'লোন হিসাব সম্পাদনা' : 'নতুন লোন যোগ করুন'}
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ব্যক্তি বা প্রতিষ্ঠানের নাম *
                </label>
                <input
                  type="text"
                  value={counterpartyName}
                  onChange={(e) => setCounterpartyName(e.target.value)}
                  placeholder="যেমন: বিকাশ লোন"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DatePickerInput
                  label="তারিখ"
                  value={issueDate}
                  onChange={setIssueDate}
                />
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    মূল লোনের টাকা (৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ইতিমধ্যে পরিশোধিত টাকা (৳)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settledAmount}
                  onChange={(e) => setSettledAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  নোট
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="সংক্ষিপ্ত বিবরণ"
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
