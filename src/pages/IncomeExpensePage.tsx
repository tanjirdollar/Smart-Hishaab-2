import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { DatePickerInput } from '../components/ui/DatePickerInput';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { IncomeExpenseRecord } from '../types/models';
import {
  formatCurrencyBDT,
  formatNumberBn,
  getTodayDDMMYYYY,
} from '../utils/formatters';

interface IncomeExpensePageProps {
  transactions: IncomeExpenseRecord[];
  onSaveTransaction: (tx: IncomeExpenseRecord) => void;
  onDeleteTransaction: (id: string) => void;
}

const PRESET_TX_CATEGORIES = [
  'পরিবার',
  'খাবার',
  'ইন্টারনেট বিল',
  'সার্ভিসিং',
  'চিকিৎসা',
  'যাতায়াত',
  'মোবাইল রিচার্জ',
  'বাসা ভাড়া',
  'অন্যান্য',
];

export const IncomeExpensePage: React.FC<IncomeExpensePageProps> = ({
  transactions,
  onSaveTransaction,
  onDeleteTransaction,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<IncomeExpenseRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>('ALL');

  const [date, setDate] = useState(getTodayDDMMYYYY());
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>(
    'expense'
  );
  const [category, setCategory] = useState('পরিবার');
  const [paymentMethod, setPaymentMethod] = useState('নগদ (Cash)');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const summary = useMemo(() => {
    const totalExpense = transactions
      .filter((t) => t.transactionType === 'expense')
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const totalIncome = transactions
      .filter((t) => t.transactionType === 'income')
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const categories = Array.from(
      new Set(transactions.map((t) => t.category).filter(Boolean))
    );
    return {
      totalExpense,
      totalIncome,
      count: transactions.length,
      categories,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (selectedCategoryFilter === 'ALL') return transactions;
    return transactions.filter((t) => t.category === selectedCategoryFilter);
  }, [transactions, selectedCategoryFilter]);

  const openCreateModal = () => {
    setEditingTx(null);
    setDate(getTodayDDMMYYYY());
    setTransactionType('expense');
    setCategory('পরিবার');
    setPaymentMethod('নগদ (Cash)');
    setAmount('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: IncomeExpenseRecord) => {
    setEditingTx(item);
    setDate(item.date);
    setTransactionType(item.transactionType);
    setCategory(item.category);
    setPaymentMethod(item.paymentMethod);
    setAmount(item.amount !== null ? String(item.amount) : '');
    setDescription(item.description);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveTransaction({
      id: editingTx ? editingTx.id : `tx-${Date.now()}`,
      date: date || getTodayDDMMYYYY(),
      transactionType,
      category: category.trim() || 'অন্যান্য',
      paymentMethod: paymentMethod.trim() || 'নগদ (Cash)',
      amount: amount !== '' ? Number(amount) : null,
      description: description.trim() || category.trim(),
    });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        titleBn="ব্যক্তিগত আয় ও ব্যয়"
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-teal-700 hover:bg-teal-800 text-white shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            নতুন ব্যয় / আয় যোগ করুন
          </button>
        }
      />

      {/* Minimal Unified Summary Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
        <div className="grid grid-cols-3 gap-3 divide-x divide-slate-200 dark:divide-slate-800">
          <div className="pr-2">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              মোট ব্যক্তিগত ব্যয়
            </p>
            <p className="text-base sm:text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {formatCurrencyBDT(summary.totalExpense)}
            </p>
          </div>
          <div className="px-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              মোট ব্যক্তিগত আয়
            </p>
            <p className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {formatCurrencyBDT(summary.totalIncome)}
            </p>
          </div>
          <div className="pl-3">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              মোট লেনদেন সংখ্যা
            </p>
            <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {formatNumberBn(summary.count)}টি
            </p>
          </div>
        </div>

        {/* Compact Category Filter Chips */}
        {summary.categories.length > 1 && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer ${
                selectedCategoryFilter === 'ALL'
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              সব খাত ({formatNumberBn(transactions.length)})
            </button>
            {summary.categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer ${
                  selectedCategoryFilter === cat
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Transactions List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        {filteredTransactions.length === 0 ? (
          <p className="text-xs text-slate-500 py-10 text-center">
            কোনো আয় বা ব্যয়ের হিসাব নেই।
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTransactions.map((row) => (
              <div
                key={row.id}
                className="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {row.category}
                    </span>
                    <StatusBadge
                      label={
                        row.transactionType === 'income' ? 'আয়' : 'ব্যয়'
                      }
                      variant={
                        row.transactionType === 'income' ? 'success' : 'danger'
                      }
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {row.date}
                    {row.description && row.description !== row.category
                      ? ` · ${row.description}`
                      : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-sm sm:text-base font-bold ${
                      row.transactionType === 'income'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {row.transactionType === 'income' ? '+' : '-'}
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
                            onDeleteTransaction(row.id);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingTx ? 'লেনদেন সম্পাদনা করুন' : 'নতুন ব্যয় / আয় যোগ করুন'}
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
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTransactionType('expense')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold cursor-pointer ${
                    transactionType === 'expense'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  ব্যয় (খরচ)
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType('income')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold cursor-pointer ${
                    transactionType === 'income'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  আয় (জমা)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  খাত নির্বাচন করুন
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_TX_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                        category === cat
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="অথবা নিজে খাত লিখুন"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DatePickerInput
                  label="তারিখ"
                  value={date}
                  onChange={setDate}
                  required
                />
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    টাকার পরিমাণ (৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="যেমন: 500"
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  সংক্ষিপ্ত বিবরণ
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="লেনদেনের সংক্ষিপ্ত নোট"
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
