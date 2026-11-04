import React, { useState } from 'react';
import {
  Edit3,
  Landmark,
  PiggyBank,
  Plus,
  Search,
  Target,
  Trash2,
} from 'lucide-react';
import { FundRecord } from '../types/models';
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

export interface FundManagementPageProps {
  funds: FundRecord[];
  onSaveFund: (fund: FundRecord) => void;
  onDeleteFund: (id: string) => void;
}

const FUND_TYPE_OPTIONS = [
  'জরুরি চিকিৎসা ও বিপদ তহবিল',
  'ব্যাংক ডিপিএস (DPS) সঞ্চয়',
  'ঈদ ও উৎসব সঞ্চয় তহবিল',
  'পারিবারিক ভবিষ্যৎ তহবিল',
  'জমি / ঘর নির্মাণ তহবিল',
];

export const FundManagementPage: React.FC<FundManagementPageProps> = ({
  funds,
  onSaveFund,
  onDeleteFund,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [fundName, setFundName] = useState('');
  const [fundType, setFundType] = useState(FUND_TYPE_OPTIONS[0]);
  const [openingDate, setOpeningDate] = useState(getTodayDDMMYYYY(false));
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [institutionOrMethod, setInstitutionOrMethod] = useState('');
  const [notes, setNotes] = useState('');

  const openAddModal = () => {
    setEditingId(null);
    setFundName('');
    setFundType(FUND_TYPE_OPTIONS[0]);
    setOpeningDate(getTodayDDMMYYYY(false));
    setMonthlyContribution('');
    setTargetAmount('');
    setCurrentBalance('');
    setInstitutionOrMethod('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (fund: FundRecord) => {
    setEditingId(fund.id);
    setFundName(fund.fundName);
    setFundType(fund.fundType);
    setOpeningDate(fund.openingDate);
    setMonthlyContribution(
      fund.monthlyContribution !== null ? String(fund.monthlyContribution) : ''
    );
    setTargetAmount(fund.targetAmount !== null ? String(fund.targetAmount) : '');
    setCurrentBalance(fund.currentBalance !== null ? String(fund.currentBalance) : '');
    setInstitutionOrMethod(fund.institutionOrMethod);
    setNotes(fund.notes);
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

    onSaveFund({
      id: editingId ?? `fund-${Date.now()}`,
      fundName: fundName.trim() || 'ব্যক্তিগত সঞ্চয় তহবিল',
      fundType,
      openingDate: openingDate || getTodayDDMMYYYY(false),
      monthlyContribution: parseNum(monthlyContribution),
      targetAmount: parseNum(targetAmount),
      currentBalance: parseNum(currentBalance),
      institutionOrMethod: institutionOrMethod.trim() || 'নগদ / ব্যাংক',
      notes: notes.trim(),
    });
    setIsModalOpen(false);
  };

  const filtered = funds.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return `${f.fundName} ${f.fundType} ${f.institutionOrMethod}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        moduleIndexBn="০৬. আর্থিক ব্যবস্থাপনা · ফান্ড ম্যানেজমেন্ট"
        titleBn="ফান্ড ম্যানেজমেন্ট ও সঞ্চয় তহবিল"
        subtitleBn="ভবিষ্যৎ নিরাপত্তা, ডিপিএস, জরুরি চিকিৎসা এবং পারিবারিক সঞ্চয় ফান্ডের স্থিতি ও লক্ষ্যমাত্রা ব্যবস্থাপনা"
        primaryActionLabelBn="নতুন ফান্ড তৈরি করুন"
        primaryActionIcon={<Plus className="w-4 h-4" />}
        onPrimaryAction={openAddModal}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          titleBn="মোট ফান্ড ব্যালেন্স"
          amount={null}
          subtitleBn="সকল তহবিলের বর্তমান সঞ্চিত টাকা"
          dbColumnHint="current_balance"
          icon={<PiggyBank className="w-5 h-5" />}
          tone="accent"
        />
        <SummaryCard
          titleBn="মোট সঞ্চয় লক্ষ্যমাত্রা"
          amount={null}
          subtitleBn="সকল ফান্ডের নির্ধারিত লক্ষ্যমাত্রা"
          dbColumnHint="target_amount"
          icon={<Target className="w-5 h-5" />}
          tone="positive"
        />
        <SummaryCard
          titleBn="সক্রিয় ফান্ড সংখ্যা"
          amount={null}
          customValueBn={`${toBengaliDigits(funds.length)} টি`}
          subtitleBn="চলমান সঞ্চয় ও ডিপিএস হিসাব"
          dbColumnHint="fund_accounts"
          icon={<Landmark className="w-5 h-5" />}
          tone="default"
        />
      </div>

      {/* Search Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ফান্ডের নাম, ধরন বা ব্যাংক/বিকাশ মাধ্যম দিয়ে খুঁজুন..."
            className="w-full min-h-[44px] pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Funds Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            তহবিল ও সঞ্চয় ফান্ডের তালিকা
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            টেবিল: fund_accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3.5 px-4 whitespace-nowrap">ফান্ডের নাম ও ধরন</th>
                <th className="py-3.5 px-4 whitespace-nowrap">শুরুর তারিখ (DD-MM-YYYY)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">সংরক্ষণ মাধ্যম</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">মাসিক জমা (৳)</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">লক্ষ্যমাত্রা (৳)</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">বর্তমান ব্যালেন্স (৳)</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyDataState
                      titleBn="কোনো সঞ্চয় বা ফান্ড অ্যাকাউন্ট যুক্ত করা হয়নি"
                      descriptionBn="জরুরি তহবিল, ব্যাংক ডিপিএস বা পারিবারিক সঞ্চয় ফান্ড তৈরি করলে এখানে বর্তমান ব্যালেন্স ও লক্ষ্যমাত্রা দেখা যাবে।"
                      tableNameHint="fund_accounts"
                      actionLabelBn="নতুন ফান্ড তৈরি করুন"
                      onActionClick={openAddModal}
                      icon={<PiggyBank className="w-6 h-6" />}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((fund) => (
                  <tr
                    key={fund.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {fund.fundName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {fund.fundType}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatDateDDMMYYYY(fund.openingDate, true)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {fund.institutionOrMethod}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatTaka(fund.monthlyContribution, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatTaka(fund.targetAmount, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-teal-700 dark:text-teal-400 whitespace-nowrap">
                      {formatTaka(fund.currentBalance, true)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(fund)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>সম্পাদনা</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteFund(fund.id)}
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
        titleBn={editingId ? 'ফান্ড তথ্য সম্পাদনা' : 'নতুন ফান্ড তৈরি করুন'}
        subtitleBn="সঞ্চয় তহবিলের নাম, লক্ষ্যমাত্রা ও বর্তমান ব্যালেন্স"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              id="fund-name"
              labelBn="ফান্ডের নাম"
              placeholder="যেমন: জরুরি পরিবার তহবিল"
              value={fundName}
              onChange={(e) => setFundName(e.target.value)}
            />
            <FormSelect
              id="fund-type"
              labelBn="ফান্ডের ধরন"
              value={fundType}
              onChange={(e) => setFundType(e.target.value)}
              options={FUND_TYPE_OPTIONS.map((t) => ({ value: t, labelBn: t }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInputDDMMYYYY
              id="fund-open-date"
              labelBn="শুরুর তারিখ (DD-MM-YYYY)"
              valueDDMMYYYY={openingDate}
              onChangeDDMMYYYY={setOpeningDate}
            />
            <FormInput
              id="fund-institution"
              labelBn="সংরক্ষণ মাধ্যম (ব্যাংক / বিকাশ / ক্যাশ)"
              placeholder="যেমন: ইসলামী ব্যাংক ডিপিএস"
              value={institutionOrMethod}
              onChange={(e) => setInstitutionOrMethod(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput
              id="fund-monthly"
              labelBn="মাসিক জমা (৳)"
              placeholder="০.০০"
              rightUnitBn="৳"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
            />
            <FormInput
              id="fund-target"
              labelBn="লক্ষ্যমাত্রা (৳)"
              placeholder="০.০০"
              rightUnitBn="৳"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
            />
            <FormInput
              id="fund-balance"
              labelBn="বর্তমান ব্যালেন্স (৳)"
              placeholder="০.০০"
              rightUnitBn="৳"
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
            />
          </div>

          <FormTextarea
            id="fund-notes"
            labelBn="সংক্ষিপ্ত বিবরণ"
            placeholder="ফান্ডের মেয়াদ বা শর্তাবলী লিখুন..."
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
