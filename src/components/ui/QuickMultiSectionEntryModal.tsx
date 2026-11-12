import React, { useEffect, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  HandCoins,
  PiggyBank,
  Scissors,
  X,
} from 'lucide-react';
import {
  FundRecord,
  IncomeExpenseRecord,
  LoanRecord,
  PaymentWithdrawalRecord,
  ProductionEntry,
  SettlementStatus,
  WorkStatus,
} from '../../types/models';

const PRESET_CATEGORIES: string[] = ['কটি', 'গোলগোলা', 'শার্ট', 'প্যান্ট'];
const PRESET_SIZES: string[] = [
  '১৪',
  '১৬',
  '১৮',
  '২০',
  '২২',
  '২৪',
  '২৬',
  '২৮',
  '৩০',
  '৩১',
  '৩২',
];
import {
  formatCurrencyBDT,
  formatNumberBn,
  getTodayDDMMYYYY,
} from '../../utils/formatters';
import { DatePickerInput } from './DatePickerInput';

export type QuickEntrySectionType =
  | 'withdrawal'
  | 'fund'
  | 'loan'
  | 'expense'
  | 'production';

interface QuickMultiSectionEntryModalProps {
  isOpen: boolean;
  initialSection?: QuickEntrySectionType;
  onClose: () => void;
  funds: FundRecord[];
  loans: LoanRecord[];
  onSaveProduction: (
    entry: ProductionEntry
  ) => Promise<{ persistedToCloud: boolean; errorBn: string | null }>;
  onSaveWithdrawal: (record: PaymentWithdrawalRecord) => void;
  onSaveFund: (fund: FundRecord) => void;
  onSaveLoan: (loan: LoanRecord) => void;
  onSaveTransaction: (tx: IncomeExpenseRecord) => void;
}

const SECTION_TABS: {
  id: QuickEntrySectionType;
  labelBn: string;
  shortDescBn: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'withdrawal',
    labelBn: 'বিল উত্তোলন',
    shortDescBn: 'কোম্পানি থেকে মজুরি/বিল গ্রহণ',
    icon: <Banknote className="w-4 h-4" />,
  },
  {
    id: 'fund',
    labelBn: 'ফান্ড জমা / খরচ',
    shortDescBn: 'ফান্ডের নতুন খরচ বা টাকা যোগ',
    icon: <PiggyBank className="w-4 h-4" />,
  },
  {
    id: 'loan',
    labelBn: 'লোন পরিশোধ / ঋণ',
    shortDescBn: 'লোনের কিস্তি পরিশোধ বা নতুন লোন',
    icon: <HandCoins className="w-4 h-4" />,
  },
  {
    id: 'expense',
    labelBn: 'ব্যক্তিগত ব্যয় / আয়',
    shortDescBn: 'পরিবার, খাবার, বিল বা অন্যান্য খরচ',
    icon: <CreditCard className="w-4 h-4" />,
  },
  {
    id: 'production',
    labelBn: 'প্রোডাকশন কাজ',
    shortDescBn: 'নতুন সেলাই বা প্রোডাকশন এন্ট্রি',
    icon: <Scissors className="w-4 h-4" />,
  },
];

const EXPENSE_CATEGORIES = [
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

export const QuickMultiSectionEntryModal: React.FC<
  QuickMultiSectionEntryModalProps
> = ({
  isOpen,
  initialSection = 'withdrawal',
  onClose,
  funds,
  loans,
  onSaveProduction,
  onSaveWithdrawal,
  onSaveFund,
  onSaveLoan,
  onSaveTransaction,
}) => {
  const [activeSection, setActiveSection] =
    useState<QuickEntrySectionType>(initialSection);
  const [date, setDate] = useState<string>(getTodayDDMMYYYY());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 1. Bill Withdrawal state (Default 4,000 as requested, editable by user)
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('4000');
  const [withdrawalMethod, setWithdrawalMethod] = useState<string>('নগদ (Cash)');
  const [withdrawalWeekRef, setWithdrawalWeekRef] = useState<string>('');
  const [withdrawalRemarks, setWithdrawalRemarks] = useState<string>('');

  // 2. Fund state
  const [fundActionMode, setFundActionMode] = useState<
    'expense' | 'deposit' | 'new_fund'
  >(funds.length > 0 ? 'expense' : 'new_fund');
  const [selectedFundId, setSelectedFundId] = useState<string>(
    funds[0]?.id || ''
  );
  const [fundAmount, setFundAmount] = useState<string>('');
  const [fundNote, setFundNote] = useState<string>('');
  const [newFundName, setNewFundName] = useState<string>('');
  const [newFundType, setNewFundType] = useState<string>('জরুরি তহবিল');

  // 3. Loan state
  const [loanActionMode, setLoanActionMode] = useState<'repay' | 'new_loan'>(
    loans.length > 0 ? 'repay' : 'new_loan'
  );
  const [selectedLoanId, setSelectedLoanId] = useState<string>(
    loans[0]?.id || ''
  );
  const [loanAmount, setLoanAmount] = useState<string>('');
  const [loanNote, setLoanNote] = useState<string>('');
  const [newLoanCounterparty, setNewLoanCounterparty] = useState<string>('');
  const [newLoanDirection, setNewLoanDirection] = useState<
    'payable' | 'receivable'
  >('payable');

  // 4. Personal Expense / Income state
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [txCategory, setTxCategory] = useState<string>('পরিবার');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txMethod, setTxMethod] = useState<string>('নগদ (Cash)');
  const [txDescription, setTxDescription] = useState<string>('');

  // 5. Production state
  const [prodItemName, setProdItemName] = useState<string>('');
  const [prodCategory, setProdCategory] = useState<string>('');
  const [prodSizes, setProdSizes] = useState<string[]>([]);
  const [prodPieces, setProdPieces] = useState<string>('');
  const [prodRatePerDozen, setProdRatePerDozen] = useState<string>('');
  const [prodWorkStatus, setProdWorkStatus] =
    useState<WorkStatus>('completed');
  const [prodSettlementStatus, setProdSettlementStatus] =
    useState<SettlementStatus>('settled');
  const [prodNotes, setProdNotes] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialSection);
      setDate(getTodayDDMMYYYY());
      setErrorMsg(null);
      setSuccessMsg(null);
      setWithdrawalAmount((prev) => (prev ? prev : '4000'));
      if (funds.length > 0 && !selectedFundId) {
        setSelectedFundId(funds[0].id);
      }
      if (loans.length > 0 && !selectedLoanId) {
        setSelectedLoanId(loans[0].id);
      }
    }
  }, [isOpen, initialSection, funds, loans, selectedFundId, selectedLoanId]);

  if (!isOpen) return null;

  const selectedFund = funds.find((f) => f.id === selectedFundId) || funds[0];
  const selectedLoan = loans.find((l) => l.id === selectedLoanId) || loans[0];

  const handleToggleSize = (sz: string) => {
    setProdSizes((prev) =>
      prev.includes(sz) ? prev.filter((s) => s !== sz) : [...prev, sz]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (activeSection === 'withdrawal') {
      const amt = Number(withdrawalAmount);
      if (!amt || amt <= 0) {
        setErrorMsg('অনুগ্রহ করে উত্তোলিত টাকার সঠিক পরিমাণ লিখুন।');
        return;
      }
      onSaveWithdrawal({
        id: `wd-${Date.now()}`,
        date: date || getTodayDDMMYYYY(),
        voucherNo: `VCH-${Date.now().toString().slice(-4)}`,
        paymentMethod: withdrawalMethod,
        weekReference: withdrawalWeekRef.trim() || 'মজুরি উত্তোলন',
        amount: amt,
        approvedBy: 'স্ব-এন্ট্রি',
        remarks: withdrawalRemarks.trim() || 'বিল উত্তোলন',
      });
      setWithdrawalAmount('4000');
      setWithdrawalWeekRef('');
      setWithdrawalRemarks('');
      setSuccessMsg('বিল উত্তোলন সফলভাবে সংরক্ষিত হয়েছে!');
      setTimeout(onClose, 700);
      return;
    }

    if (activeSection === 'fund') {
      const amt = Number(fundAmount);
      if (!amt || amt <= 0) {
        setErrorMsg('অনুগ্রহ করে টাকার সঠিক পরিমাণ লিখুন।');
        return;
      }

      if (fundActionMode === 'new_fund' || !selectedFund) {
        if (!newFundName.trim()) {
          setErrorMsg('অনুগ্রহ করে নতুন ফান্ডের নাম লিখুন।');
          return;
        }
        onSaveFund({
          id: `fund-${Date.now()}`,
          fundName: newFundName.trim(),
          fundType: newFundType,
          openingDate: date || getTodayDDMMYYYY(),
          monthlyContribution: null,
          targetAmount: amt,
          currentBalance: amt,
          institutionOrMethod: 'নগদ / মোবাইল ব্যাংকিং',
          notes: fundNote.trim() || `প্রারম্ভিক জমা: ৳${amt}`,
        });
        setNewFundName('');
        setFundAmount('');
        setFundNote('');
        setSuccessMsg('নতুন ফান্ড সফলভাবে তৈরি হয়েছে!');
        setTimeout(onClose, 700);
        return;
      }

      const prevBalance = selectedFund.currentBalance ?? 0;
      const nextBalance =
        fundActionMode === 'deposit'
          ? Number((prevBalance + amt).toFixed(2))
          : Number(Math.max(0, prevBalance - amt).toFixed(2));

      const actionTag =
        fundActionMode === 'deposit'
          ? `+৳${amt} জমা`
          : `-৳${amt} খরচ`;
      const noteEntry = `[${date}] ${actionTag}${
        fundNote.trim() ? `: ${fundNote.trim()}` : ''
      }`;
      const combinedNotes = selectedFund.notes
        ? `${noteEntry} | ${selectedFund.notes}`
        : noteEntry;

      onSaveFund({
        ...selectedFund,
        currentBalance: nextBalance,
        notes: combinedNotes,
      });

      setFundAmount('');
      setFundNote('');
      setSuccessMsg(
        fundActionMode === 'deposit'
          ? `"${selectedFund.fundName}" ফান্ডে জমা যোগ হয়েছে!`
          : `"${selectedFund.fundName}" ফান্ড থেকে খরচ বাদ দেওয়া হয়েছে!`
      );
      setTimeout(onClose, 700);
      return;
    }

    if (activeSection === 'loan') {
      const amt = Number(loanAmount);
      if (!amt || amt <= 0) {
        setErrorMsg('অনুগ্রহ করে টাকার সঠিক পরিমাণ লিখুন।');
        return;
      }

      if (loanActionMode === 'new_loan' || !selectedLoan) {
        if (!newLoanCounterparty.trim()) {
          setErrorMsg('অনুগ্রহ করে লোন দাতা বা গ্রহীতার নাম লিখুন।');
          return;
        }
        onSaveLoan({
          id: `loan-${Date.now()}`,
          loanDirection: newLoanDirection,
          counterpartyName: newLoanCounterparty.trim(),
          phone: '',
          issueDate: date || getTodayDDMMYYYY(),
          dueDate: date || getTodayDDMMYYYY(),
          principalAmount: amt,
          settledAmount: 0,
          remainingBalance: amt,
          statusLabel: 'চলমান',
          notes: loanNote.trim() || 'নতুন লোন এন্ট্রি',
        });
        setNewLoanCounterparty('');
        setLoanAmount('');
        setLoanNote('');
        setSuccessMsg('নতুন লোন হিসাব সংরক্ষিত হয়েছে!');
        setTimeout(onClose, 700);
        return;
      }

      const prevSettled = selectedLoan.settledAmount ?? 0;
      const prevRemaining =
        selectedLoan.remainingBalance ??
        Math.max(0, (selectedLoan.principalAmount ?? 0) - prevSettled);
      const nextSettled = Number((prevSettled + amt).toFixed(2));
      const nextRemaining = Number(Math.max(0, prevRemaining - amt).toFixed(2));
      const noteEntry = `[${date}] কিস্তি পরিশোধ: ৳${amt}${
        loanNote.trim() ? ` (${loanNote.trim()})` : ''
      }`;

      onSaveLoan({
        ...selectedLoan,
        settledAmount: nextSettled,
        remainingBalance: nextRemaining,
        statusLabel: nextRemaining === 0 ? 'পরিশোধিত' : 'আংশিক বাকি',
        notes: selectedLoan.notes
          ? `${noteEntry} | ${selectedLoan.notes}`
          : noteEntry,
      });

      setLoanAmount('');
      setLoanNote('');
      setSuccessMsg(
        `"${selectedLoan.counterpartyName}" লোনের কিস্তি পরিশোধ সংরক্ষিত হয়েছে!`
      );
      setTimeout(onClose, 700);
      return;
    }

    if (activeSection === 'expense') {
      const amt = Number(txAmount);
      if (!amt || amt <= 0) {
        setErrorMsg('অনুগ্রহ করে টাকার সঠিক পরিমাণ লিখুন।');
        return;
      }
      onSaveTransaction({
        id: `tx-${Date.now()}`,
        date: date || getTodayDDMMYYYY(),
        transactionType: txType,
        category: txCategory.trim() || 'অন্যান্য',
        paymentMethod: txMethod,
        amount: amt,
        description: txDescription.trim() || txCategory,
      });
      setTxAmount('');
      setTxDescription('');
      setSuccessMsg(
        txType === 'expense'
          ? 'ব্যক্তিগত ব্যয় সংরক্ষিত হয়েছে!'
          : 'ব্যক্তিগত আয় সংরক্ষিত হয়েছে!'
      );
      setTimeout(onClose, 700);
      return;
    }

    if (activeSection === 'production') {
      if (!prodItemName.trim()) {
        setErrorMsg('অনুগ্রহ করে আইটেমের নাম লিখুন।');
        return;
      }
      const pcs = Number(prodPieces);
      if (!pcs || pcs <= 0) {
        setErrorMsg('অনুগ্রহ করে পিস সংখ্যা লিখুন।');
        return;
      }
      const rate = prodRatePerDozen ? Number(prodRatePerDozen) : 0;
      const totalWage = Number(((pcs / 12) * rate).toFixed(2));

      setIsSaving(true);
      try {
        await onSaveProduction({
          id: `prod-${Date.now()}`,
          date: date || getTodayDDMMYYYY(),
          itemName: prodItemName.trim(),
          category: prodCategory,
          garmentType: prodCategory || prodItemName.trim(),
          size: prodSizes.join(', '),
          sizes: prodSizes,
          color: '',
          colors: [],
          pieces: pcs,
          dozens: Number((pcs / 12).toFixed(2)),
          ratePerDozen: rate,
          totalWage,
          receivedWage: 0,
          pendingWage: totalWage,
          workStatus: prodWorkStatus,
          settlementStatus:
            rate > 0 ? prodSettlementStatus : 'pending',
          startWorkTime: null,
          endWorkTime: null,
          workDurationMinutes: null,
          shortDescription:
            prodNotes.trim() || `${prodItemName.trim()} (${pcs} পিস)`,
          photos: [],
        });
        setSuccessMsg('প্রোডাকশন এন্ট্রি সংরক্ষিত হয়েছে!');
        setTimeout(onClose, 700);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              নতুন হিসাব যোগ করুন
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              সেকশন নির্বাচন করে সরাসরি হিসাব সংরক্ষণ করুন
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Selector Chips */}
        <div className="px-4 py-3 bg-slate-50/40 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            কোন সেকশনে যোগ করতে চান?
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {SECTION_TABS.map((tab) => {
              const active = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(tab.id);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                    active
                      ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-500'
                  }`}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span className="truncate">{tab.labelBn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-4 space-y-3.5 overflow-y-auto flex-1"
        >
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Common Date Field */}
          <DatePickerInput
            label="তারিখ (DD-MM-YYYY)"
            value={date}
            onChange={setDate}
            required
          />

          {/* 1. BILL WITHDRAWAL */}
          {activeSection === 'withdrawal' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    উত্তোলিত টাকার পরিমাণ (৳) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={withdrawalAmount}
                    onChange={(e) => setWithdrawalAmount(e.target.value)}
                    placeholder="যেমন: 3000"
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    কিস্তি নং / সপ্তাহ রেফারেন্স
                  </label>
                  <input
                    type="text"
                    value={withdrawalWeekRef}
                    onChange={(e) => setWithdrawalWeekRef(e.target.value)}
                    placeholder="যেমন: ১৭তম কিস্তি বা চলতি সপ্তাহ"
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    পেমেন্ট মাধ্যম
                  </label>
                  <select
                    value={withdrawalMethod}
                    onChange={(e) => setWithdrawalMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="নগদ (Cash)">নগদ (Cash)</option>
                    <option value="বিকাশ">বিকাশ</option>
                    <option value="নগদ (Nagad)">নগদ (Nagad)</option>
                    <option value="ব্যাংক ট্রান্সফার">ব্যাংক ট্রান্সফার</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    মন্তব্য (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={withdrawalRemarks}
                    onChange={(e) => setWithdrawalRemarks(e.target.value)}
                    placeholder="যেমন: সাপ্তাহিক বিল উত্তোলন"
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. FUND DEPOSIT / EXPENSE */}
          {activeSection === 'fund' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFundActionMode('expense')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    fundActionMode === 'expense'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  ফান্ড থেকে খরচ (-)
                </button>
                <button
                  type="button"
                  onClick={() => setFundActionMode('deposit')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    fundActionMode === 'deposit'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  ফান্ডে জমা (+)
                </button>
                <button
                  type="button"
                  onClick={() => setFundActionMode('new_fund')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    fundActionMode === 'new_fund'
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  নতুন ফান্ড
                </button>
              </div>

              {fundActionMode !== 'new_fund' && funds.length > 0 ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    কোন ফান্ড নির্বাচন করবেন? *
                  </label>
                  <select
                    value={selectedFundId}
                    onChange={(e) => setSelectedFundId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.fundName} (ব্যালেন্স:{' '}
                        {formatCurrencyBDT(f.currentBalance ?? 0)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      নতুন ফান্ডের নাম *
                    </label>
                    <input
                      type="text"
                      value={newFundName}
                      onChange={(e) => setNewFundName(e.target.value)}
                      placeholder="যেমন: চিকিৎসা ফান্ড"
                      className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ফান্ডের ধরন
                    </label>
                    <input
                      type="text"
                      value={newFundType}
                      onChange={(e) => setNewFundType(e.target.value)}
                      placeholder="জরুরি তহবিল / সঞ্চয়"
                      className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {fundActionMode === 'expense'
                      ? 'খরচের পরিমাণ (৳) *'
                      : 'জমার পরিমাণ (৳) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="যেমন: 500"
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    বিবরণ / খাত
                  </label>
                  <input
                    type="text"
                    value={fundNote}
                    onChange={(e) => setFundNote(e.target.value)}
                    placeholder={
                      fundActionMode === 'expense'
                        ? 'যেমন: ওষুধ কেনা বা গাড়ি ভাড়া'
                        : 'যেমন: মাসিক জমা'
                    }
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. LOAN REPAYMENT / NEW LOAN */}
          {activeSection === 'loan' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setLoanActionMode('repay')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    loanActionMode === 'repay'
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  লোন কিস্তি পরিশোধ
                </button>
                <button
                  type="button"
                  onClick={() => setLoanActionMode('new_loan')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    loanActionMode === 'new_loan'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  নতুন লোন যোগ
                </button>
              </div>

              {loanActionMode === 'repay' && loans.length > 0 ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    কোন লোন পরিশোধ করছেন? *
                  </label>
                  <select
                    value={selectedLoanId}
                    onChange={(e) => setSelectedLoanId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  >
                    {loans.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.counterpartyName} (বাকি:{' '}
                        {formatCurrencyBDT(l.remainingBalance ?? 0)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ব্যক্তি বা প্রতিষ্ঠানের নাম *
                    </label>
                    <input
                      type="text"
                      value={newLoanCounterparty}
                      onChange={(e) => setNewLoanCounterparty(e.target.value)}
                      placeholder="যেমন: বিকাশ লোন বা মহাজন"
                      className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      লোনের ধরন
                    </label>
                    <select
                      value={newLoanDirection}
                      onChange={(e) =>
                        setNewLoanDirection(
                          e.target.value as 'payable' | 'receivable'
                        )
                      }
                      className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="payable">দেনা (পরিশোধযোগ্য)</option>
                      <option value="receivable">পাওনা (আদায়যোগ্য)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {loanActionMode === 'repay'
                      ? 'পরিশোধের পরিমাণ (৳) *'
                      : 'মূল লোনের পরিমাণ (৳) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="যেমন: 500"
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    মন্তব্য / নোট
                  </label>
                  <input
                    type="text"
                    value={loanNote}
                    onChange={(e) => setLoanNote(e.target.value)}
                    placeholder="যেমন: কিস্তি পরিশোধ"
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. PERSONAL EXPENSE / INCOME */}
          {activeSection === 'expense' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTxType('expense')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    txType === 'expense'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  ব্যয় (খরচ)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('income')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    txType === 'income'
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
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTxCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                        txCategory === cat
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    টাকার পরিমাণ (৳) *
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
                    পেমেন্ট মাধ্যম
                  </label>
                  <select
                    value={txMethod}
                    onChange={(e) => setTxMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="নগদ (Cash)">নগদ (Cash)</option>
                    <option value="বিকাশ">বিকাশ</option>
                    <option value="নগদ (Nagad)">নগদ (Nagad)</option>
                    <option value="ব্যাংক">ব্যাংক</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  সংক্ষিপ্ত বিবরণ
                </label>
                <input
                  type="text"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="যেমন: বাসায় বাজার বা রাউটার বিল"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 5. PRODUCTION ENTRY */}
          {activeSection === 'production' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  আইটেমের নাম (নিজে লিখুন) *
                </label>
                <input
                  type="text"
                  value={prodItemName}
                  onChange={(e) => setProdItemName(e.target.value)}
                  placeholder="যেমন: বাচ্চাদের গোলগলা বা শার্ট"
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ক্যাটাগরি নির্বাচন করুন
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESET_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setProdCategory((prev) => (prev === cat ? '' : cat))
                      }
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        prodCategory === cat
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  সাইজ নির্বাচন করুন
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SIZES.map((sz) => {
                    const active = prodSizes.includes(sz);
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => handleToggleSize(sz)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                          active
                            ? 'bg-teal-700 text-white border-teal-700'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    পিস সংখ্যা *
                  </label>
                  <input
                    type="number"
                    value={prodPieces}
                    onChange={(e) => setProdPieces(e.target.value)}
                    placeholder="যেমন: 48"
                    required
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                  {Number(prodPieces) > 0 && (
                    <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold mt-0.5 block">
                      = {formatNumberBn(Number((Number(prodPieces) / 12).toFixed(2)))}{' '}
                      ডজন
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ডজন প্রতি দর (৳)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodRatePerDozen}
                    onChange={(e) => setProdRatePerDozen(e.target.value)}
                    placeholder="যেমন: 200"
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                  {Number(prodPieces) > 0 && Number(prodRatePerDozen) > 0 && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block">
                      মোট মজুরি:{' '}
                      {formatCurrencyBDT(
                        Number(
                          (
                            (Number(prodPieces) / 12) *
                            Number(prodRatePerDozen)
                          ).toFixed(2)
                        )
                      )}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    কাজের স্ট্যাটাস
                  </label>
                  <select
                    value={prodWorkStatus}
                    onChange={(e) =>
                      setProdWorkStatus(e.target.value as WorkStatus)
                    }
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="completed">কাজ সম্পন্ন</option>
                    <option value="in_progress">কাজ চলছে</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    রেট নিষ্পত্তি স্ট্যাটাস
                  </label>
                  <select
                    value={prodSettlementStatus}
                    onChange={(e) =>
                      setProdSettlementStatus(e.target.value as SettlementStatus)
                    }
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="settled">নিষ্পত্তি হয়েছে</option>
                    <option value="pending">রেট নিষ্পত্তি হয়নি</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  সংক্ষিপ্ত নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={prodNotes}
                  onChange={(e) => setProdNotes(e.target.value)}
                  placeholder="যেমন: লট নং বা অতিরিক্ত তথ্য"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              বাতিল করুন
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white shadow-xs cursor-pointer"
            >
              {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
