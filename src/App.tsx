/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { DesktopSidebar } from './components/layout/DesktopSidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { TopBar } from './components/layout/TopBar';
import { AuthenticatedUser, supabase } from './lib/supabase/client';
import { DashboardPage } from './pages/DashboardPage';
import { DataManagementPage } from './pages/DataManagementPage';
import { FundManagementPage } from './pages/FundManagementPage';
import { ImportDataPage } from './pages/ImportDataPage';
import { IncomeExpensePage } from './pages/IncomeExpensePage';
import { LoanManagementPage } from './pages/LoanManagementPage';
import { LoginPage } from './pages/LoginPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ProductionLedgerPage } from './pages/ProductionLedgerPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { WageLedgerPage } from './pages/WageLedgerPage';
import { WeeklyReportPage } from './pages/WeeklyReportPage';
import {
  ApplicationRepositoryState,
  computeCurrentWeekSeries,
  computeDashboardMetrics,
  computeMonthlyIncomeExpenseSeries,
  getInitialRepositoryState,
} from './services/financialDomainService';
import {
  batchImportProductionEntriesToSupabase,
  deleteProductionEntryFromSupabase,
  fetchProductionEntriesFromSupabase,
  rollbackImportBatchFromSupabase,
  saveProductionEntryToSupabase,
  uploadProductionPhotoToSupabase,
} from './services/supabaseDataService';
import {
  FundRecord,
  IncomeExpenseRecord,
  LoanRecord,
  ModuleId,
  PaymentWithdrawalRecord,
  ProductionEntry,
  ThemeMode,
  WageLedgerRecord,
} from './types/models';

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>(ModuleId.DASHBOARD);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [showLoginView, setShowLoginView] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isLoadingCloudData, setIsLoadingCloudData] = useState<boolean>(false);

  const [repo, setRepo] = useState<ApplicationRepositoryState>(getInitialRepositoryState);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Load authenticated user session & fetch Supabase production records
  useEffect(() => {
    if (!supabase) return;

    const loadCloudRecords = async () => {
      setIsLoadingCloudData(true);
      try {
        const { entries } = await fetchProductionEntriesFromSupabase();
        if (entries.length > 0) {
          setRepo((prev) => ({
            ...prev,
            productionEntries: entries,
          }));
        }
      } finally {
        setIsLoadingCloudData(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      const usr = data.session?.user ?? null;
      setCurrentUser(usr);
      if (usr) {
        loadCloudRecords();
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const usr = session?.user ?? null;
      setCurrentUser(usr);
      if (usr) {
        loadCloudRecords();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Production CRUD handlers (persists to Supabase when logged in + updates state immediately)
  const handleSaveProduction = async (entry: ProductionEntry, rawFiles?: File[]) => {
    let updatedPhotos = entry.photos;

    if (rawFiles && rawFiles.length > 0) {
      const uploadedUrls: string[] = [];
      for (const file of rawFiles) {
        const publicUrl = await uploadProductionPhotoToSupabase(file);
        if (publicUrl) {
          uploadedUrls.push(publicUrl);
        }
      }
      if (uploadedUrls.length > 0) {
        updatedPhotos = entry.photos.map((p, idx) => ({
          ...p,
          storagePath: uploadedUrls[idx] || p.storagePath,
        }));
      }
    }

    const entryWithPhotos: ProductionEntry = {
      ...entry,
      photos: updatedPhotos,
    };

    const { savedEntry } = await saveProductionEntryToSupabase(entryWithPhotos);

    setRepo((prev) => {
      const exists = prev.productionEntries.some(
        (item) => item.id === entry.id || item.id === savedEntry.id
      );
      return {
        ...prev,
        productionEntries: exists
          ? prev.productionEntries.map((item) =>
              item.id === entry.id || item.id === savedEntry.id ? savedEntry : item
            )
          : [savedEntry, ...prev.productionEntries],
      };
    });
  };

  const handleDeleteProduction = async (id: string) => {
    await deleteProductionEntryFromSupabase(id);
    setRepo((prev) => ({
      ...prev,
      productionEntries: prev.productionEntries.filter((item) => item.id !== id),
    }));
  };

  // Batch Import & Rollback handlers
  const handleBatchImportEntries = async (
    entriesToImport: ProductionEntry[],
    batchId: string
  ) => {
    const res = await batchImportProductionEntriesToSupabase(entriesToImport, batchId);
    if (res.errorBn) {
      return {
        importedCount: 0,
        persistedToCloud: false,
        errorBn: res.errorBn,
      };
    }

    const added = res.importedEntries;
    setRepo((prev) => ({
      ...prev,
      productionEntries: [...added, ...prev.productionEntries],
    }));

    return {
      importedCount: added.length,
      persistedToCloud: res.persistedToCloud,
      errorBn: null,
    };
  };

  const handleRollbackImportBatch = async (batchId: string) => {
    const res = await rollbackImportBatchFromSupabase(batchId);
    setRepo((prev) => ({
      ...prev,
      productionEntries: prev.productionEntries.filter(
        (e) => e.importBatchId !== batchId
      ),
    }));
    return res;
  };

  // Wage Ledger CRUD handlers
  const handleSaveWageRecord = (record: WageLedgerRecord) => {
    setRepo((prev) => {
      const exists = prev.wageRecords.some((item) => item.id === record.id);
      return {
        ...prev,
        wageRecords: exists
          ? prev.wageRecords.map((item) => (item.id === record.id ? record : item))
          : [record, ...prev.wageRecords],
      };
    });
  };

  const handleDeleteWageRecord = (id: string) => {
    setRepo((prev) => ({
      ...prev,
      wageRecords: prev.wageRecords.filter((item) => item.id !== id),
    }));
  };

  // Payment Withdrawals CRUD handlers
  const handleSaveWithdrawal = (record: PaymentWithdrawalRecord) => {
    setRepo((prev) => {
      const exists = prev.paymentWithdrawals.some((item) => item.id === record.id);
      return {
        ...prev,
        paymentWithdrawals: exists
          ? prev.paymentWithdrawals.map((item) => (item.id === record.id ? record : item))
          : [record, ...prev.paymentWithdrawals],
      };
    });
  };

  const handleDeleteWithdrawal = (id: string) => {
    setRepo((prev) => ({
      ...prev,
      paymentWithdrawals: prev.paymentWithdrawals.filter((item) => item.id !== id),
    }));
  };

  // Loan CRUD handlers
  const handleSaveLoan = (loan: LoanRecord) => {
    setRepo((prev) => {
      const exists = prev.loanRecords.some((item) => item.id === loan.id);
      return {
        ...prev,
        loanRecords: exists
          ? prev.loanRecords.map((item) => (item.id === loan.id ? loan : item))
          : [loan, ...prev.loanRecords],
      };
    });
  };

  const handleDeleteLoan = (id: string) => {
    setRepo((prev) => ({
      ...prev,
      loanRecords: prev.loanRecords.filter((item) => item.id !== id),
    }));
  };

  // Fund CRUD handlers
  const handleSaveFund = (fund: FundRecord) => {
    setRepo((prev) => {
      const exists = prev.fundRecords.some((item) => item.id === fund.id);
      return {
        ...prev,
        fundRecords: exists
          ? prev.fundRecords.map((item) => (item.id === fund.id ? fund : item))
          : [fund, ...prev.fundRecords],
      };
    });
  };

  const handleDeleteFund = (id: string) => {
    setRepo((prev) => ({
      ...prev,
      fundRecords: prev.fundRecords.filter((item) => item.id !== id),
    }));
  };

  // Income & Expense CRUD handlers
  const handleSaveTransaction = (tx: IncomeExpenseRecord) => {
    setRepo((prev) => {
      const exists = prev.incomeExpenseRecords.some((item) => item.id === tx.id);
      return {
        ...prev,
        incomeExpenseRecords: exists
          ? prev.incomeExpenseRecords.map((item) => (item.id === tx.id ? tx : item))
          : [tx, ...prev.incomeExpenseRecords],
      };
    });
  };

  const handleDeleteTransaction = (id: string) => {
    setRepo((prev) => ({
      ...prev,
      incomeExpenseRecords: prev.incomeExpenseRecords.filter((item) => item.id !== id),
    }));
  };

  const dashboardMetrics = useMemo(() => computeDashboardMetrics(repo), [repo]);
  const weeklySeries = useMemo(() => computeCurrentWeekSeries(repo), [repo]);
  const monthlySeries = useMemo(() => computeMonthlyIncomeExpenseSeries(repo), [repo]);

  if (showLoginView) {
    return (
      <LoginPage
        currentUser={currentUser}
        onReturnToWorkspace={() => setShowLoginView(false)}
      />
    );
  }

  const renderActivePage = () => {
    switch (activeModule) {
      case ModuleId.DASHBOARD:
        return (
          <DashboardPage
            metrics={dashboardMetrics}
            recentProduction={repo.productionEntries}
            paymentWithdrawals={repo.paymentWithdrawals}
            recentTransactions={repo.incomeExpenseRecords}
            weeklySeries={weeklySeries}
            monthlySeries={monthlySeries}
            onNavigate={setActiveModule}
          />
        );
      case ModuleId.PRODUCTION:
        return (
          <ProductionLedgerPage
            entries={repo.productionEntries}
            onSaveEntry={handleSaveProduction}
            onDeleteEntry={handleDeleteProduction}
          />
        );
      case ModuleId.WEEKLY_REPORT:
        return (
          <WeeklyReportPage
            productionEntries={repo.productionEntries}
            paymentWithdrawals={repo.paymentWithdrawals}
          />
        );
      case ModuleId.IMPORT_DATA:
        return (
          <ImportDataPage
            existingEntries={repo.productionEntries}
            onBatchImportEntries={handleBatchImportEntries}
            onRollbackImportBatch={handleRollbackImportBatch}
            onNavigate={setActiveModule}
          />
        );
      case ModuleId.WAGES:
        return (
          <WageLedgerPage
            records={repo.wageRecords}
            onSaveRecord={handleSaveWageRecord}
            onDeleteRecord={handleDeleteWageRecord}
          />
        );
      case ModuleId.PAYMENTS:
        return (
          <PaymentsPage
            withdrawals={repo.paymentWithdrawals}
            onSaveWithdrawal={handleSaveWithdrawal}
            onDeleteWithdrawal={handleDeleteWithdrawal}
          />
        );
      case ModuleId.LOANS:
        return (
          <LoanManagementPage
            loans={repo.loanRecords}
            onSaveLoan={handleSaveLoan}
            onDeleteLoan={handleDeleteLoan}
          />
        );
      case ModuleId.FUNDS:
        return (
          <FundManagementPage
            funds={repo.fundRecords}
            onSaveFund={handleSaveFund}
            onDeleteFund={handleDeleteFund}
          />
        );
      case ModuleId.INCOME_EXPENSE:
        return (
          <IncomeExpensePage
            transactions={repo.incomeExpenseRecords}
            onSaveTransaction={handleSaveTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        );
      case ModuleId.REPORTS:
        return (
          <ReportsPage
            productionCount={repo.productionEntries.length}
            transactionCount={repo.incomeExpenseRecords.length}
          />
        );
      case ModuleId.DATA_MANAGEMENT:
        return (
          <DataManagementPage
            onResetSessionPreviewData={() => setRepo(getInitialRepositoryState())}
          />
        );
      case ModuleId.SETTINGS:
        return (
          <SettingsPage
            theme={theme}
            onSelectTheme={setTheme}
            onOpenLoginView={() => setShowLoginView(true)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Collapsible Sidebar on Desktop */}
      <DesktopSidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        onOpenLoginView={() => setShowLoginView(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden">
        <TopBar
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onOpenLoginView={() => setShowLoginView(true)}
          currentUser={currentUser}
        />

        {isLoadingCloudData && (
          <div className="bg-teal-50 dark:bg-teal-950/60 border-b border-teal-200 dark:border-teal-800 px-4 py-2 text-xs text-teal-800 dark:text-teal-200 text-center">
            সুপাবেস ডাটাবেস থেকে প্রোডাকশন তথ্য লোড হচ্ছে...
          </div>
        )}

        <main className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-10 max-w-7xl w-full mx-auto overflow-x-hidden">
          {renderActivePage()}
        </main>
      </div>

      {/* Fixed Bottom Navigation Bar on Mobile */}
      <MobileBottomNav
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        onOpenLoginView={() => setShowLoginView(true)}
      />
    </div>
  );
}
