import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Edit3,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  EXPENSE_CATEGORY_OPTIONS,
  INCOME_CATEGORY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
} from '../config/navigation';
import { IncomeExpenseRecord } from '../types/models';
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

export interface IncomeExpensePageProps {
  transactions: IncomeExpenseRecord[];
  onSaveTransaction: (tx: IncomeExpenseRecord) => void;
  onDeleteTransaction: (id: string) => void;
}

export const IncomeExpensePage: React.FC<IncomeExpensePageProps> = ({
  transactions,
  onSaveTransaction,
  onDeleteTransaction,
}) => {
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'income' | 'expense'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(getTodayDDMMYYYY(false));
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState(EXPENSE_CATEGORY_OPTIONS[0]);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD_OPTIONS[0]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const openAddModal = (initialType: 'income' | 'expense' = 'expense') => {
    setEditingId(null);
    setDate(getTodayDDMMYYYY(false));
    setTransactionType(initialType);
    setCategory(
      initialType === 'income'
        ? INCOME_CATEGORY_OPTIONS[0]
        : EXPENSE_CATEGORY_OPTIONS[0]
    );
    setPaymentMethod(PAYMENT_METHOD_OPTIONS[0]);
    setAmount('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (tx: IncomeExpenseRecord) => {
    setEditingId(tx.id);
    setDate(tx.date);
    setTransactionType(tx.transactionType);
    setCategory(tx.category);
    setPaymentMethod(tx.paymentMethod);
    setAmount(tx.amount !== null ? String(tx.amount) : '');
    setDescription(tx.description);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = toAsciiDigits(amount).trim();
    const parsed = clean && Number.isFinite(Number(clean)) ? Number(clean) : null;

    onSaveTransaction({
      id: editingId ?? `tx-${Date.now()}`,
      date: date || getTodayDDMMYYYY(false),
      transactionType,
      category,
      paymentMethod,
      amount: parsed,
      description: description.trim(),
    });
    setIsModalOpen(false);
  };

  const filtered = transactions.filter((tx) => {
    if (typeFilter !== 'ALL' && tx.transactionType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !`${tx.category} ${tx.description} ${tx.paymentMethod} ${tx.date}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const categoryOptions =
    transactionType === 'income'
      ? INCOME_CATEGORY_OPTIONS
      : EXPENSE_CATEGORY_OPTIONS;

  return (
    <div className="space-y-6">
      <PageHeader
        moduleIndexBn="০৭. আর্থিক ব্যবস্থাপনা · আয়-ব্যয়"
        titleBn="দৈনিক আয় ও ব্যক্তিগত ব্যয়ের হিসাব"
        subtitleBn="মজুরি ও বোনাস হতে প্রাপ্ত আয় এবং ঘর ভাড়া, বাজার, যাতায়াত ও পরিবারে পাঠানো খরচের খাতওয়ারি তালিকা"
        primaryActionLabelBn="নতুন ব্যয় যোগ করুন"
        primaryActionIcon={<Plus className="w-4 h-4" />}
        onPrimaryAction={() => openAddModal('expense')}
        secondaryActionLabelBn="নতুন আয় যোগ করুন"
        secondaryActionIcon={<Plus className="w-4 h-4" />}
        onSecondaryAction={() => openAddModal('income')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          titleBn="মোট তালিকাভুক্ত আয়"
          amount={null}
          subtitleBn="মজুরি, ওভারটাইম ও বোনাস হতে আয়"
          dbColumnHint="income_sum"
          icon={<ArrowDownLeft className="w-5 h-5" />}
          tone="positive"
        />
        <SummaryCard
          titleBn="মোট ব্যক্তিগত ব্যয়"
          amount={null}
          subtitleBn="দৈনন্দিন জীবনযাত্রা ও পারিবারিক খরচ"
          dbColumnHint="expense_sum"
          icon={<ArrowUpRight className="w-5 h-5" />}
          tone="danger"
        />
        <SummaryCard
          titleBn="মোট লেনদেন সংখ্যা"
          amount={null}
          customValueBn={`${toBengaliDigits(transactions.length)} টি`}
          subtitleBn="সংরক্ষিত আয় ও ব্যয় ভাউচার"
          dbColumnHint="income_expense"
          icon={<ArrowLeftRight className="w-5 h-5" />}
          tone="default"
        />
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setTypeFilter('ALL')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              typeFilter === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            সকল লেনদেন
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('income')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              typeFilter === 'income'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            শুধু আয়
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('expense')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              typeFilter === 'expense'
                ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            শুধু ব্যয়
          </button>
        </div>

        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="খাত, বিবরণ বা তারিখ (DD-MM-YYYY) দিয়ে খুঁজুন..."
            className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            আয় ও ব্যয়ের খতিয়ান টেবিল
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            টেবিল: income_expense_transactions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3.5 px-4 whitespace-nowrap">তারিখ (DD-MM-YYYY)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">ধরন</th>
                <th className="py-3.5 px-4 whitespace-nowrap">খাত / ক্যাটাগরি</th>
                <th className="py-3.5 px-4 whitespace-nowrap">মাধ্যম</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">পরিমাণ (৳)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">বিবরণ</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyDataState
                      titleBn="কোনো আয় বা ব্যয়ের এন্ট্রি নেই"
                      descriptionBn="নতুন আয় বা ব্যক্তিগত খরচ যোগ করলে এখানে তারিখ, খাত ও টাকার পরিমাণ তালিকাভুক্ত হবে।"
                      tableNameHint="income_expense_transactions"
                      actionLabelBn="নতুন ব্যয় যোগ করুন"
                      onActionClick={() => openAddModal('expense')}
                      icon={<ArrowLeftRight className="w-6 h-6" />}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {formatDateDDMMYYYY(tx.date, true)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                      {tx.transactionType === 'income' ? (
                        <span className="text-emerald-700 dark:text-emerald-400">আয়</span>
                      ) : (
                        <span className="text-rose-700 dark:text-rose-400">ব্যয়</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {tx.category}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {tx.paymentMethod}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatTaka(tx.amount, true)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {tx.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(tx)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>সম্পাদনা</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx.id)}
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
          editingId ? 'আয়-ব্যয় তথ্য সম্পাদনা' : 'নতুন আয় বা ব্যয় এন্ট্রি'
        }
        subtitleBn="তারিখ (DD-MM-YYYY), খাত এবং টাকার পরিমাণ (৳) নির্ধারণ করুন"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              id="tx-type"
              labelBn="লেনদেনের ধরন"
              value={transactionType}
              onChange={(e) => {
                const nextType = e.target.value as 'income' | 'expense';
                setTransactionType(nextType);
                setCategory(
                  nextType === 'income'
                    ? INCOME_CATEGORY_OPTIONS[0]
                    : EXPENSE_CATEGORY_OPTIONS[0]
                );
              }}
              options={[
                { value: 'expense', labelBn: 'ব্যয় (খরচ)' },
                { value: 'income', labelBn: 'আয় (জমা)' },
              ]}
            />
            <DateInputDDMMYYYY
              id="tx-date"
              labelBn="তারিখ (DD-MM-YYYY)"
              valueDDMMYYYY={date}
              onChangeDDMMYYYY={setDate}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              id="tx-category"
              labelBn="খাত / ক্যাটাগরি"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={categoryOptions.map((c) => ({ value: c, labelBn: c }))}
            />
            <FormSelect
              id="tx-method"
              labelBn="লেনদেন মাধ্যম"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              options={PAYMENT_METHOD_OPTIONS.map((m) => ({ value: m, labelBn: m }))}
            />
          </div>

          <FormInput
            id="tx-amount"
            labelBn="টাকার পরিমাণ (৳)"
            placeholder="০.০০"
            rightUnitBn="৳"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <FormTextarea
            id="tx-desc"
            labelBn="সংক্ষিপ্ত বিবরণ"
            placeholder="লেনদেন সংক্রান্ত বিস্তারিত নোট..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
