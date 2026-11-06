import React, { useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Edit2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { DatePickerInput } from '../components/ui/DatePickerInput';
import { PageHeader } from '../components/ui/PageHeader';
import { FundRecord } from '../types/models';
import {
  formatCurrencyBDT,
  formatNumberBn,
  getTodayDDMMYYYY,
} from '../utils/formatters';

interface FundManagementPageProps {
  funds: FundRecord[];
  onSaveFund: (fund: FundRecord) => void;
  onDeleteFund: (id: string) => void;
}

export const FundManagementPage: React.FC<FundManagementPageProps> = ({
  funds,
  onSaveFund,
  onDeleteFund,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<FundRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Quick Deposit / Expense modal for a specific fund
  const [txFund, setTxFund] = useState<FundRecord | null>(null);
  const [txMode, setTxMode] = useState<'deposit' | 'expense'>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(getTodayDDMMYYYY());
  const [txReason, setTxReason] = useState('');

  // Create / Edit Fund fields
  const [fundName, setFundName] = useState('');
  const [fundType, setFundType] = useState('জরুরি তহবিল');
  const [openingDate, setOpeningDate] = useState(getTodayDDMMYYYY());
  const [currentBalance, setCurrentBalance] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [notes, setNotes] = useState('');

  const summary = useMemo(() => {
    const totalBalance = funds.reduce(
      (sum, f) => sum + (f.currentBalance ?? 0),
      0
    );
    const totalTarget = funds.reduce(
      (sum, f) => sum + (f.targetAmount ?? 0),
      0
    );
    return {
      totalBalance,
      totalTarget,
      count: funds.length,
    };
  }, [funds]);

  const openCreateModal = () => {
    setEditingFund(null);
    setFundName('');
    setFundType('জরুরি তহবিল');
    setOpeningDate(getTodayDDMMYYYY());
    setCurrentBalance('');
    setTargetAmount('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: FundRecord) => {
    setEditingFund(item);
    setFundName(item.fundName);
    setFundType(item.fundType);
    setOpeningDate(item.openingDate);
    setCurrentBalance(
      item.currentBalance !== null ? String(item.currentBalance) : ''
    );
    setTargetAmount(
      item.targetAmount !== null ? String(item.targetAmount) : ''
    );
    setNotes(item.notes);
    setIsModalOpen(true);
  };

  const openFundTransaction = (
    fund: FundRecord,
    mode: 'deposit' | 'expense'
  ) => {
    setTxFund(fund);
    setTxMode(mode);
    setTxAmount('');
    setTxDate(getTodayDDMMYYYY());
    setTxReason('');
  };

  const handleSaveFundTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txFund) return;
    const amt = Number(txAmount);
    if (!amt || amt <= 0) return;

    const prev = txFund.currentBalance ?? 0;
    const nextBalance =
      txMode === 'deposit'
        ? Number((prev + amt).toFixed(2))
        : Number(Math.max(0, prev - amt).toFixed(2));
    const entryTag =
      txMode === 'deposit' ? `+৳${amt} জমা` : `-৳${amt} খরচ`;
    const logItem = `[${txDate}] ${entryTag}${
      txReason.trim() ? `: ${txReason.trim()}` : ''
    }`;

    onSaveFund({
      ...txFund,
      currentBalance: nextBalance,
      notes: txFund.notes ? `${logItem} | ${txFund.notes}` : logItem,
    });
    setTxFund(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveFund({
      id: editingFund ? editingFund.id : `fund-${Date.now()}`,
      fundName: fundName.trim() || 'তহবিল',
      fundType: fundType.trim() || 'জরুরি তহবিল',
      openingDate: openingDate || getTodayDDMMYYYY(),
      monthlyContribution: null,
      targetAmount: targetAmount !== '' ? Number(targetAmount) : null,
      currentBalance: currentBalance !== '' ? Number(currentBalance) : 0,
      institutionOrMethod: 'নগদ / মোবাইল ব্যাংকিং',
      notes: notes.trim(),
    });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        titleBn="ফান্ড ও সঞ্চয় ব্যবস্থাপনা"
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-teal-700 hover:bg-teal-800 text-white shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            নতুন ফান্ড তৈরি করুন
          </button>
        }
      />

      {/* Minimal Unified Summary Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 divide-x divide-slate-200 dark:divide-slate-800">
          <div className="pr-2">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              বর্তমান মোট ফান্ড ব্যালেন্স
            </p>
            <p className="text-base sm:text-xl font-bold text-teal-700 dark:text-teal-300 mt-0.5">
              {formatCurrencyBDT(summary.totalBalance)}
            </p>
          </div>
          <div className="pl-3 sm:px-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              সক্রিয় ফান্ড সংখ্যা
            </p>
            <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {formatNumberBn(summary.count)}টি
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 pt-2 sm:pt-0 sm:pl-3 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              মোট জমা / লক্ষ্যমাত্রা
            </p>
            <p className="text-sm sm:text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {formatCurrencyBDT(summary.totalTarget)}
            </p>
          </div>
        </div>
      </div>

      {/* Fund Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {funds.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
            কোনো ফান্ড হিসাব পাওয়া যায়নি।
          </div>
        ) : (
          funds.map((row) => (
            <div
              key={row.id}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {row.fundName}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {row.fundType} · শুরুর তারিখ: {row.openingDate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium text-slate-400">
                      বর্তমান ব্যালেন্স
                    </p>
                    <p className="text-base font-extrabold text-teal-700 dark:text-teal-300">
                      {formatCurrencyBDT(row.currentBalance)}
                    </p>
                  </div>
                </div>

                {row.notes && (
                  <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-100 dark:border-slate-800 leading-relaxed">
                    {row.notes}
                  </p>
                )}
              </div>

              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openFundTransaction(row, 'expense')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200/70 dark:border-rose-800/60 cursor-pointer"
                  >
                    <ArrowDownCircle className="w-3.5 h-3.5" />
                    নতুন খরচ (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => openFundTransaction(row, 'deposit')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/70 dark:border-emerald-800/60 cursor-pointer"
                  >
                    <ArrowUpCircle className="w-3.5 h-3.5" />
                    টাকা যোগ (+)
                  </button>
                </div>

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
                          onDeleteFund(row.id);
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
          ))
        )}
      </div>

      {/* Quick Fund Expense / Deposit Modal */}
      {txFund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {txFund.fundName} —{' '}
                {txMode === 'deposit' ? 'ফান্ডে টাকা জমা (+)' : 'ফান্ডের নতুন খরচ (-)'}
              </h3>
              <button
                type="button"
                onClick={() => setTxFund(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveFundTransaction} className="p-5 space-y-3.5">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs flex items-center justify-between">
                <span className="text-slate-500">বর্তমান ব্যালেন্স:</span>
                <span className="font-bold text-teal-700 dark:text-teal-300">
                  {formatCurrencyBDT(txFund.currentBalance)}
                </span>
              </div>
              <DatePickerInput
                label="তারিখ (DD-MM-YYYY)"
                value={txDate}
                onChange={setTxDate}
                required
              />
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {txMode === 'deposit' ? 'জমার পরিমাণ (৳) *' : 'খরচের পরিমাণ (৳) *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="যেমন: 500"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  খাত বা বিবরণ
                </label>
                <input
                  type="text"
                  value={txReason}
                  onChange={(e) => setTxReason(e.target.value)}
                  placeholder={
                    txMode === 'deposit'
                      ? 'যেমন: ফান্ডে জমা'
                      : 'যেমন: ওষুধ কেনা বা গাড়ি ভাড়া'
                  }
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTxFund(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-bold rounded-xl text-white cursor-pointer ${
                    txMode === 'deposit'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Fund Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingFund ? 'ফান্ড সম্পাদনা করুন' : 'নতুন ফান্ড তৈরি করুন'}
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
                  ফান্ডের নাম *
                </label>
                <input
                  type="text"
                  value={fundName}
                  onChange={(e) => setFundName(e.target.value)}
                  placeholder="যেমন: চিকিৎসা ফান্ড"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DatePickerInput
                  label="শুরুর তারিখ"
                  value={openingDate}
                  onChange={setOpeningDate}
                />
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    বর্তমান ব্যালেন্স (৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentBalance}
                    onChange={(e) => setCurrentBalance(e.target.value)}
                    placeholder="0"
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  নোট / বিবরণ
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ফান্ডের সংক্ষিপ্ত বিবরণ"
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
