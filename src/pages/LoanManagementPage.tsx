import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Edit3,
  HandCoins,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { LoanRecord } from '../types/models';
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

export interface LoanManagementPageProps {
  loans: LoanRecord[];
  onSaveLoan: (loan: LoanRecord) => void;
  onDeleteLoan: (id: string) => void;
}

export const LoanManagementPage: React.FC<LoanManagementPageProps> = ({
  loans,
  onSaveLoan,
  onDeleteLoan,
}) => {
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'receivable' | 'payable'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loanDirection, setLoanDirection] = useState<'receivable' | 'payable'>('receivable');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [phone, setPhone] = useState('');
  const [issueDate, setIssueDate] = useState(getTodayDDMMYYYY(false));
  const [dueDate, setDueDate] = useState(getTodayDDMMYYYY(false));
  const [principalAmount, setPrincipalAmount] = useState('');
  const [settledAmount, setSettledAmount] = useState('');
  const [remainingBalance, setRemainingBalance] = useState('');
  const [statusLabel, setStatusLabel] = useState('চলমান');
  const [notes, setNotes] = useState('');

  const openAddModal = () => {
    setEditingId(null);
    setLoanDirection('receivable');
    setCounterpartyName('');
    setPhone('');
    setIssueDate(getTodayDDMMYYYY(false));
    setDueDate(getTodayDDMMYYYY(false));
    setPrincipalAmount('');
    setSettledAmount('');
    setRemainingBalance('');
    setStatusLabel('চলমান');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (loan: LoanRecord) => {
    setEditingId(loan.id);
    setLoanDirection(loan.loanDirection);
    setCounterpartyName(loan.counterpartyName);
    setPhone(loan.phone);
    setIssueDate(loan.issueDate);
    setDueDate(loan.dueDate);
    setPrincipalAmount(loan.principalAmount !== null ? String(loan.principalAmount) : '');
    setSettledAmount(loan.settledAmount !== null ? String(loan.settledAmount) : '');
    setRemainingBalance(
      loan.remainingBalance !== null ? String(loan.remainingBalance) : ''
    );
    setStatusLabel(loan.statusLabel);
    setNotes(loan.notes);
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

    onSaveLoan({
      id: editingId ?? `loan-${Date.now()}`,
      loanDirection,
      counterpartyName: counterpartyName.trim() || 'নাম উল্লেখ নেই',
      phone: phone.trim(),
      issueDate: issueDate || getTodayDDMMYYYY(false),
      dueDate: dueDate || getTodayDDMMYYYY(false),
      principalAmount: parseNum(principalAmount),
      settledAmount: parseNum(settledAmount),
      remainingBalance: parseNum(remainingBalance),
      statusLabel,
      notes: notes.trim(),
    });
    setIsModalOpen(false);
  };

  const filtered = loans.filter((l) => {
    if (directionFilter !== 'ALL' && l.loanDirection !== directionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !`${l.counterpartyName} ${l.phone} ${l.notes} ${l.issueDate}`
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
        moduleIndexBn="০৫. আর্থিক ব্যবস্থাপনা · ঋণের হিসাব"
        titleBn="ঋণের হিসাব (পাওনা ও দেনা)"
        subtitleBn="অন্যকে দেওয়া পাওনা ঋণ এবং নিজে গ্রহণ করা দেনা ঋণের কিস্তি, পরিশোধের তারিখ ও অবশিষ্ট স্থিতির খতিয়ান"
        primaryActionLabelBn="নতুন ঋণের হিসাব যোগ করুন"
        primaryActionIcon={<Plus className="w-4 h-4" />}
        onPrimaryAction={openAddModal}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          titleBn="মোট পাওনা ঋণ (Receivable)"
          amount={null}
          subtitleBn="অন্যের কাছে প্রদত্ত ফেরতযোগ্য টাকা"
          dbColumnHint="loan_receivable"
          icon={<ArrowDownLeft className="w-5 h-5" />}
          tone="positive"
        />
        <SummaryCard
          titleBn="মোট দেনা ঋণ (Payable)"
          amount={null}
          subtitleBn="নিজের পরিশোধযোগ্য গৃহীত ঋণ"
          dbColumnHint="loan_payable"
          icon={<ArrowUpRight className="w-5 h-5" />}
          tone="warning"
        />
        <SummaryCard
          titleBn="মোট ঋণ এন্ট্রি সংখ্যা"
          amount={null}
          customValueBn={`${toBengaliDigits(loans.length)} টি`}
          subtitleBn="পাওনা ও দেনা খতিয়ান সংখ্যা"
          dbColumnHint="loan_records"
          icon={<HandCoins className="w-5 h-5" />}
          tone="default"
        />
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setDirectionFilter('ALL')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              directionFilter === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            সকল ঋণ
          </button>
          <button
            type="button"
            onClick={() => setDirectionFilter('receivable')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              directionFilter === 'receivable'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            পাওনা ঋণ
          </button>
          <button
            type="button"
            onClick={() => setDirectionFilter('payable')}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              directionFilter === 'payable'
                ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            দেনা ঋণ
          </button>
        </div>

        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ব্যক্তির নাম, মোবাইল নম্বর বা তারিখ খুঁজুন..."
            className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Loans Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            পাওনা ও দেনা ঋণের তালিকা
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            টেবিল: loan_records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3.5 px-4 whitespace-nowrap">ঋণের ধরন</th>
                <th className="py-3.5 px-4 whitespace-nowrap">ব্যক্তির নাম ও ফোন</th>
                <th className="py-3.5 px-4 whitespace-nowrap">প্রদানের তারিখ</th>
                <th className="py-3.5 px-4 whitespace-nowrap">পরিশোধের শেষ তারিখ</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">মূল টাকা (৳)</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">পরিশোধিত (৳)</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">অবশিষ্ট স্থিতি (৳)</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyDataState
                      titleBn="কোনো ঋণের হিসাব তালিকাভুক্ত নেই"
                      descriptionBn="পাওনা ঋণ বা দেনা ঋণের তথ্য যুক্ত করলে এখানে তারিখ (DD-MM-YYYY) এবং অবশিষ্ট টাকার পরিমাণ প্রদর্শিত হবে।"
                      tableNameHint="loan_records"
                      actionLabelBn="নতুন ঋণের হিসাব যোগ করুন"
                      onActionClick={openAddModal}
                      icon={<HandCoins className="w-6 h-6" />}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((loan) => (
                  <tr
                    key={loan.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-semibold whitespace-nowrap">
                      {loan.loanDirection === 'receivable' ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          পাওনা ঋণ
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">
                          দেনা ঋণ
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {loan.counterpartyName}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {loan.phone || '—'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatDateDDMMYYYY(loan.issueDate, true)}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatDateDDMMYYYY(loan.dueDate, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatTaka(loan.principalAmount, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatTaka(loan.settledAmount, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatTaka(loan.remainingBalance, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(loan)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>সম্পাদনা</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteLoan(loan.id)}
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
        titleBn={editingId ? 'ঋণের তথ্য সম্পাদনা করুন' : 'নতুন ঋণের হিসাব যোগ করুন'}
        subtitleBn="পাওনা বা দেনা ঋণের বিস্তারিত তথ্য (DD-MM-YYYY)"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              id="loan-direction"
              labelBn="ঋণের ধরন নির্বাচন করুন"
              value={loanDirection}
              onChange={(e) =>
                setLoanDirection(e.target.value as 'receivable' | 'payable')
              }
              options={[
                { value: 'receivable', labelBn: 'পাওনা ঋণ (অন্যকে দেওয়া)' },
                { value: 'payable', labelBn: 'দেনা ঋণ (নিজে নেওয়া)' },
              ]}
            />
            <FormSelect
              id="loan-status"
              labelBn="বর্তমান অবস্থা"
              value={statusLabel}
              onChange={(e) => setStatusLabel(e.target.value)}
              options={[
                { value: 'চলমান', labelBn: 'চলমান' },
                { value: 'আংশিক পরিশোধিত', labelBn: 'আংশিক পরিশোধিত' },
                { value: 'সম্পূর্ণ পরিশোধিত', labelBn: 'সম্পূর্ণ পরিশোধিত' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              id="loan-person"
              labelBn="ব্যক্তি বা প্রতিষ্ঠানের নাম"
              placeholder="নাম লিখুন"
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(e.target.value)}
            />
            <FormInput
              id="loan-phone"
              labelBn="মোবাইল নম্বর"
              placeholder="০১৭XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInputDDMMYYYY
              id="loan-issue-date"
              labelBn="ঋণ গ্রহণ/প্রদানের তারিখ (DD-MM-YYYY)"
              valueDDMMYYYY={issueDate}
              onChangeDDMMYYYY={setIssueDate}
            />
            <DateInputDDMMYYYY
              id="loan-due-date"
              labelBn="পরিশোধের সম্ভাব্য তারিখ (DD-MM-YYYY)"
              valueDDMMYYYY={dueDate}
              onChangeDDMMYYYY={setDueDate}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput
              id="loan-principal"
              labelBn="মূল ঋণের পরিমাণ (৳)"
              placeholder="০.০০"
              rightUnitBn="৳"
              value={principalAmount}
              onChange={(e) => setPrincipalAmount(e.target.value)}
            />
            <FormInput
              id="loan-settled"
              labelBn="পরিশোধিত টাকা (৳)"
              placeholder="০.০০"
              rightUnitBn="৳"
              value={settledAmount}
              onChange={(e) => setSettledAmount(e.target.value)}
            />
            <FormInput
              id="loan-remaining"
              labelBn="অবশিষ্ট স্থিতি (৳)"
              placeholder="০.০০"
              rightUnitBn="৳"
              value={remainingBalance}
              onChange={(e) => setRemainingBalance(e.target.value)}
            />
          </div>

          <FormTextarea
            id="loan-notes"
            labelBn="সংক্ষিপ্ত বিবরণ বা শর্ত"
            placeholder="কিস্তি বা জামানত সংক্রান্ত নোট..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
