/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { fetchAndParseAttachedUserBackup } from './services/backupImportService';
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
  readAuxiliaryModulesFromSupabaseMetadata,
  rollbackImportBatchFromSupabase,
  saveAuxiliaryModulesToSupabaseMetadata,
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

const LOCAL_CACHE_KEY_PREFIX = 'smart_hisab_repo_cache_v2_';
const ATTACHED_BACKUP_IMPORTED_FLAG = 'smart_hisab_backup_20261106_loaded_v1';

function loadCachedRepositoryState(userId: string | null): ApplicationRepositoryState | null {
  try {
    const key = `${LOCAL_CACHE_KEY_PREFIX}${userId || 'guest'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ApplicationRepositoryState>;
    if (!parsed || !Array.isArray(parsed.productionEntries)) return null;
    const initial = getInitialRepositoryState();
    return {
      productionEntries: parsed.productionEntries ?? initial.productionEntries,
      wageRecords: parsed.wageRecords ?? initial.wageRecords,
      paymentWithdrawals: parsed.paymentWithdrawals ?? initial.paymentWithdrawals,
      loanRecords: parsed.loanRecords ?? initial.loanRecords,
      fundRecords: parsed.fundRecords ?? initial.fundRecords,
      incomeExpenseRecords: parsed.incomeExpenseRecords ?? initial.incomeExpenseRecords,
    };
  } catch {
    return null;
  }
}

function saveCachedRepositoryState(
  userId: string | null,
  state: ApplicationRepositoryState
): void {
  try {
    const key = `${LOCAL_CACHE_KEY_PREFIX}${userId || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>(ModuleId.DASHBOARD);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [showLoginView, setShowLoginView] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isAuthInitialized, setIsAuthInitialized] = useState<boolean>(!supabase);
  const [isLoadingCloudData, setIsLoadingCloudData] = useState<boolean>(false);
  const [cloudSyncBannerBn, setCloudSyncBannerBn] = useState<string | null>(null);

  const [repo, setRepo] = useState<ApplicationRepositoryState>(() => {
    return loadCachedRepositoryState(null) || getInitialRepositoryState();
  });

  const isSyncingRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Persist mirror cache whenever repo changes after initialization
  useEffect(() => {
    if (!isAuthInitialized) return;
    saveCachedRepositoryState(currentUser?.id ?? null, repo);
  }, [repo, currentUser?.id, isAuthInitialized]);

  const loadCloudRecordsForUser = useCallback(async (user: AuthenticatedUser) => {
    if (!supabase || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsLoadingCloudData(true);
    setCloudSyncBannerBn(null);

    try {
      // Load any cached user state first so we can sync any unsaved local records
      const userCached = loadCachedRepositoryState(user.id);
      const guestCached = loadCachedRepositoryState(null);

      const { entries: cloudEntries, missingTableSetup, errorBn } =
        await fetchProductionEntriesFromSupabase(user.id);

      if (missingTableSetup) {
        setCloudSyncBannerBn(
          'আপনার ডেটা বর্তমানে সুপাবেস ক্লাউড প্রোফাইলে সুরক্ষিতভাবে সংরক্ষিত হচ্ছে। পূর্ণাঙ্গ SQL টেবিল চালু করতে "ডেটা ম্যানেজমেন্ট" পাতা থেকে ১-ক্লিকে SQL কোডটি Supabase SQL Editor-এ Run করুন।'
        );
      } else if (errorBn) {
        setCloudSyncBannerBn(errorBn);
        if (userCached && userCached.productionEntries.length > 0) {
          setRepo(userCached);
        }
        return;
      }

      const cloudAux = await readAuxiliaryModulesFromSupabaseMetadata();

      // Check if there are any non-UUID entries created before login or during offline that need to be synced to Supabase
      const localCandidates = [
        ...(userCached?.productionEntries || []),
        ...(guestCached?.productionEntries || []),
      ];
      const existingFingerprints = new Set(
        cloudEntries.map(
          (c) => `${c.date}|${c.itemName}|${c.pieces ?? 0}|${c.totalWage}`
        )
      );
      const unsyncedEntries = localCandidates.filter(
        (item) =>
          !cloudEntries.some((c) => c.id === item.id) &&
          !existingFingerprints.has(
            `${item.date}|${item.itemName}|${item.pieces ?? 0}|${item.totalWage}`
          ) &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            item.id
          )
      );

      let finalCloudEntries = cloudEntries;

      if (unsyncedEntries.length > 0) {
        const batchRes = await batchImportProductionEntriesToSupabase(
          unsyncedEntries,
          `sync-${Date.now()}`
        );
        if (!batchRes.errorBn && batchRes.importedEntries.length > 0) {
          const refreshed = await fetchProductionEntriesFromSupabase(user.id);
          if (!refreshed.errorBn) {
            finalCloudEntries = refreshed.entries;
          }
        }
        // Clear guest unsynced entries after migrating to user's Supabase account
        if (guestCached && guestCached.productionEntries.length > 0) {
          saveCachedRepositoryState(null, {
            ...guestCached,
            productionEntries: [],
          });
        }
      }

      // If both cloud and local have no production entries yet, automatically load attached user backup
      let autoLoadedBackupState: ApplicationRepositoryState | null = null;
      if (
        finalCloudEntries.length === 0 &&
        (!userCached || userCached.productionEntries.length === 0)
      ) {
        const parsedBackup = await fetchAndParseAttachedUserBackup();
        if (parsedBackup && parsedBackup.state.productionEntries.length > 0) {
          autoLoadedBackupState = parsedBackup.state;
          localStorage.setItem(ATTACHED_BACKUP_IMPORTED_FLAG, 'true');
          const batchRes = await batchImportProductionEntriesToSupabase(
            parsedBackup.state.productionEntries,
            'backup-2026-11-06'
          );
          if (!batchRes.errorBn && batchRes.importedEntries.length > 0) {
            finalCloudEntries = batchRes.importedEntries;
          } else {
            finalCloudEntries = parsedBackup.state.productionEntries;
          }
          await saveAuxiliaryModulesToSupabaseMetadata({
            wageRecords: parsedBackup.state.wageRecords,
            paymentWithdrawals: parsedBackup.state.paymentWithdrawals,
            loanRecords: parsedBackup.state.loanRecords,
            fundRecords: parsedBackup.state.fundRecords,
            incomeExpenseRecords: parsedBackup.state.incomeExpenseRecords,
          });
        }
      }

      setRepo((prev) => {
        const base = autoLoadedBackupState || userCached || prev;
        const resolvedWithdrawals =
          (cloudAux?.paymentWithdrawals && cloudAux.paymentWithdrawals.length > 0
            ? cloudAux.paymentWithdrawals
            : null) ||
          (base.paymentWithdrawals && base.paymentWithdrawals.length > 0
            ? base.paymentWithdrawals
            : prev.paymentWithdrawals);
        const resolvedWages =
          (cloudAux?.wageRecords && cloudAux.wageRecords.length > 0
            ? cloudAux.wageRecords
            : null) ||
          (base.wageRecords && base.wageRecords.length > 0
            ? base.wageRecords
            : prev.wageRecords);
        const resolvedLoans =
          (cloudAux?.loanRecords && cloudAux.loanRecords.length > 0
            ? cloudAux.loanRecords
            : null) ||
          (base.loanRecords && base.loanRecords.length > 0
            ? base.loanRecords
            : prev.loanRecords);
        const resolvedFunds =
          (cloudAux?.fundRecords && cloudAux.fundRecords.length > 0
            ? cloudAux.fundRecords
            : null) ||
          (base.fundRecords && base.fundRecords.length > 0
            ? base.fundRecords
            : prev.fundRecords);
        const resolvedIncomeExpense =
          (cloudAux?.incomeExpenseRecords &&
          cloudAux.incomeExpenseRecords.length > 0
            ? cloudAux.incomeExpenseRecords
            : null) ||
          (base.incomeExpenseRecords && base.incomeExpenseRecords.length > 0
            ? base.incomeExpenseRecords
            : prev.incomeExpenseRecords);

        return {
          productionEntries:
            finalCloudEntries.length > 0
              ? finalCloudEntries
              : base.productionEntries,
          paymentWithdrawals: resolvedWithdrawals,
          wageRecords: resolvedWages,
          loanRecords: resolvedLoans,
          fundRecords: resolvedFunds,
          incomeExpenseRecords: resolvedIncomeExpense,
        };
      });
    } finally {
      setIsLoadingCloudData(false);
      isSyncingRef.current = false;
    }
  }, []);

  // Automatically load the user's attached SmartHisab_Backup_2026-11-06.json on first load or rehydrate missing photos
  useEffect(() => {
    let cancelled = false;
    const alreadyLoaded = localStorage.getItem(ATTACHED_BACKUP_IMPORTED_FLAG);
    const hasMissingPhotos = repo.productionEntries.every(
      (e) => !e.photos || e.photos.length === 0
    );
    if (
      alreadyLoaded === 'true' &&
      repo.productionEntries.length > 0 &&
      repo.paymentWithdrawals.length > 0 &&
      !hasMissingPhotos
    ) {
      return;
    }

    fetchAndParseAttachedUserBackup().then((parsed) => {
      if (cancelled || !parsed) return;
      localStorage.setItem(ATTACHED_BACKUP_IMPORTED_FLAG, 'true');
      setRepo((prev) => {
        const photoMapByFingerprint = new Map<string, ProductionEntry['photos']>();
        for (const bkpEntry of parsed.state.productionEntries) {
          if (bkpEntry.photos && bkpEntry.photos.length > 0) {
            photoMapByFingerprint.set(
              `${bkpEntry.date}|${bkpEntry.itemName}|${bkpEntry.pieces ?? 0}`,
              bkpEntry.photos
            );
          }
        }

        const enrichedExisting = prev.productionEntries.map((e) => {
          if (e.photos && e.photos.length > 0) return e;
          const matchedPhotos = photoMapByFingerprint.get(
            `${e.date}|${e.itemName}|${e.pieces ?? 0}`
          );
          return matchedPhotos ? { ...e, photos: matchedPhotos } : e;
        });

        const existingProdKeys = new Set(
          enrichedExisting.map(
            (e) => `${e.date}|${e.itemName}|${e.pieces ?? 0}|${e.totalWage}`
          )
        );
        const mergedProd =
          alreadyLoaded === 'true' && enrichedExisting.length > 0
            ? enrichedExisting
            : [
                ...enrichedExisting,
                ...parsed.state.productionEntries.filter(
                  (e) =>
                    !existingProdKeys.has(
                      `${e.date}|${e.itemName}|${e.pieces ?? 0}|${e.totalWage}`
                    )
                ),
              ];

        const nextState: ApplicationRepositoryState = {
          productionEntries:
            mergedProd.length > 0 ? mergedProd : parsed.state.productionEntries,
          wageRecords:
            prev.wageRecords.length > 0
              ? prev.wageRecords
              : parsed.state.wageRecords,
          paymentWithdrawals:
            prev.paymentWithdrawals.length > 0
              ? prev.paymentWithdrawals
              : parsed.state.paymentWithdrawals,
          loanRecords:
            prev.loanRecords.length > 0
              ? prev.loanRecords
              : parsed.state.loanRecords,
          fundRecords:
            prev.fundRecords.length > 0
              ? prev.fundRecords
              : parsed.state.fundRecords,
          incomeExpenseRecords:
            prev.incomeExpenseRecords.length > 0
              ? prev.incomeExpenseRecords
              : parsed.state.incomeExpenseRecords,
        };
        saveCachedRepositoryState(currentUser?.id ?? null, nextState);
        return nextState;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, repo.paymentWithdrawals.length, repo.productionEntries.length]);

  // Wait for Supabase auth session initialization on mount and page refresh
  useEffect(() => {
    if (!supabase) {
      setIsAuthInitialized(true);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      const usr = data.session?.user ?? null;
      setCurrentUser(usr);
      setIsAuthInitialized(true);
      if (usr) {
        await loadCloudRecordsForUser(usr);
      } else {
        const guestCache = loadCachedRepositoryState(null);
        if (guestCache && guestCache.productionEntries.length > 0) {
          setRepo(guestCache);
        }
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        const usr = session?.user ?? null;
        setCurrentUser(usr);
        setIsAuthInitialized(true);
        if (usr) {
          loadCloudRecordsForUser(usr);
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadCloudRecordsForUser]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Production CRUD handlers: Awaits confirmed Supabase save and returns status to caller
  const handleSaveProduction = async (
    entry: ProductionEntry,
    rawFiles?: File[]
  ): Promise<{ persistedToCloud: boolean; errorBn: string | null }> => {
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

    const { savedEntry, persistedToCloud, errorBn } =
      await saveProductionEntryToSupabase(entryWithPhotos);

    setRepo((prev) => {
      const exists = prev.productionEntries.some(
        (item) => item.id === entry.id || item.id === savedEntry.id
      );
      const nextEntries = exists
        ? prev.productionEntries.map((item) =>
            item.id === entry.id || item.id === savedEntry.id ? savedEntry : item
          )
        : [savedEntry, ...prev.productionEntries];

      const nextState = {
        ...prev,
        productionEntries: nextEntries,
      };
      saveCachedRepositoryState(currentUser?.id ?? null, nextState);
      return nextState;
    });

    return { persistedToCloud, errorBn };
  };

  const handleDeleteProduction = async (id: string) => {
    await deleteProductionEntryFromSupabase(id);
    setRepo((prev) => {
      const nextState = {
        ...prev,
        productionEntries: prev.productionEntries.filter((item) => item.id !== id),
      };
      saveCachedRepositoryState(currentUser?.id ?? null, nextState);
      return nextState;
    });
  };

  // Batch Import & Rollback handlers
  const handleBatchImportEntries = async (
    entriesToImport: ProductionEntry[],
    batchId: string
  ) => {
    const res = await batchImportProductionEntriesToSupabase(
      entriesToImport,
      batchId
    );
    if (res.errorBn) {
      return {
        importedCount: 0,
        persistedToCloud: false,
        errorBn: res.errorBn,
      };
    }

    const added = res.importedEntries;
    setRepo((prev) => {
      const nextState = {
        ...prev,
        productionEntries: [...added, ...prev.productionEntries],
      };
      saveCachedRepositoryState(currentUser?.id ?? null, nextState);
      return nextState;
    });

    return {
      importedCount: added.length,
      persistedToCloud: res.persistedToCloud,
      errorBn: null,
    };
  };

  const handleRollbackImportBatch = async (batchId: string) => {
    const res = await rollbackImportBatchFromSupabase(batchId);
    setRepo((prev) => {
      const nextState = {
        ...prev,
        productionEntries: prev.productionEntries.filter(
          (e) => e.importBatchId !== batchId
        ),
      };
      saveCachedRepositoryState(currentUser?.id ?? null, nextState);
      return nextState;
    });
    return res;
  };

  // Full Multi-Module Backup Import Handler (JSON or Multi-Tab Excel Workbook)
  const handleImportFullRepositoryState = async (
    importedState: ApplicationRepositoryState
  ): Promise<{ persistedToCloud: boolean; errorBn: string | null }> => {
    const existingProdKeys = new Set(
      repo.productionEntries.map(
        (e) => `${e.date}|${e.itemName}|${e.pieces ?? 0}|${e.totalWage}`
      )
    );
    const newProdToImport = importedState.productionEntries.filter(
      (e) =>
        !existingProdKeys.has(
          `${e.date}|${e.itemName}|${e.pieces ?? 0}|${e.totalWage}`
        )
    );

    let persistedToCloud = false;
    let errorBn: string | null = null;
    let cloudSavedProd = newProdToImport;

    if (newProdToImport.length > 0) {
      const batchRes = await batchImportProductionEntriesToSupabase(
        newProdToImport,
        `full-backup-${Date.now()}`
      );
      persistedToCloud = batchRes.persistedToCloud;
      errorBn = batchRes.errorBn;
      if (!batchRes.errorBn && batchRes.importedEntries.length > 0) {
        cloudSavedProd = batchRes.importedEntries;
      }
    }

    const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
      const map = new Map<string, T>();
      for (const item of incoming) map.set(item.id, item);
      for (const item of existing) map.set(item.id, item);
      return Array.from(map.values());
    };

    const nextWageRecords = mergeById(repo.wageRecords, importedState.wageRecords);
    const nextWithdrawals = mergeById(
      repo.paymentWithdrawals,
      importedState.paymentWithdrawals
    );
    const nextLoans = mergeById(repo.loanRecords, importedState.loanRecords);
    const nextFunds = mergeById(repo.fundRecords, importedState.fundRecords);
    const nextIncomeExpense = mergeById(
      repo.incomeExpenseRecords,
      importedState.incomeExpenseRecords
    );

    const auxSaved = await saveAuxiliaryModulesToSupabaseMetadata({
      wageRecords: nextWageRecords,
      paymentWithdrawals: nextWithdrawals,
      loanRecords: nextLoans,
      fundRecords: nextFunds,
      incomeExpenseRecords: nextIncomeExpense,
    });
    if (auxSaved) {
      persistedToCloud = true;
    }

    localStorage.setItem(ATTACHED_BACKUP_IMPORTED_FLAG, 'true');

    setRepo((prev) => {
      const nextState: ApplicationRepositoryState = {
        productionEntries: [...cloudSavedProd, ...prev.productionEntries],
        wageRecords: nextWageRecords,
        paymentWithdrawals: nextWithdrawals,
        loanRecords: nextLoans,
        fundRecords: nextFunds,
        incomeExpenseRecords: nextIncomeExpense,
      };
      saveCachedRepositoryState(currentUser?.id ?? null, nextState);
      return nextState;
    });

    return { persistedToCloud, errorBn };
  };

  // Wage Ledger CRUD handlers
  const handleSaveWageRecord = (record: WageLedgerRecord) => {
    setRepo((prev) => {
      const exists = prev.wageRecords.some((item) => item.id === record.id);
      const nextWageRecords = exists
        ? prev.wageRecords.map((item) => (item.id === record.id ? record : item))
        : [record, ...prev.wageRecords];
      const nextState = { ...prev, wageRecords: nextWageRecords };
      void saveAuxiliaryModulesToSupabaseMetadata({
        wageRecords: nextState.wageRecords,
        paymentWithdrawals: nextState.paymentWithdrawals,
        loanRecords: nextState.loanRecords,
        fundRecords: nextState.fundRecords,
        incomeExpenseRecords: nextState.incomeExpenseRecords,
      });
      return nextState;
    });
  };

  const handleDeleteWageRecord = (id: string) => {
    setRepo((prev) => {
      const nextState = {
        ...prev,
        wageRecords: prev.wageRecords.filter((item) => item.id !== id),
      };
      void saveAuxiliaryModulesToSupabaseMetadata({
        wageRecords: nextState.wageRecords,
        paymentWithdrawals: nextState.paymentWithdrawals,
        loanRecords: nextState.loanRecords,
        fundRecords: nextState.fundRecords,
        incomeExpenseRecords: nextState.incomeExpenseRecords,
      });
      return nextState;
    });
  };

  // Payment Withdrawals CRUD handlers
  const handleSaveWithdrawal = (record: PaymentWithdrawalRecord) => {
    setRepo((prev) => {
      const exists = prev.paymentWithdrawals.some((item) => item.id === record.id);
      const nextWithdrawals = exists
        ? prev.paymentWithdrawals.map((item) =>
            item.id === record.id ? record : item
          )
        : [record, ...prev.paymentWithdrawals];
      const nextState = { ...prev, paymentWithdrawals: nextWithdrawals };
      void saveAuxiliaryModulesToSupabaseMetadata({
        wageRecords: nextState.wageRecords,
        paymentWithdrawals: nextState.paymentWithdrawals,
        loanRecords: nextState.loanRecords,
        fundRecords: nextState.fundRecords,
        incomeExpenseRecords: nextState.incomeExpenseRecords,
      });
      return nextState;
    });
  };

  const handleDeleteWithdrawal = (id: string) => {
    setRepo((prev) => {
      const nextState = {
        ...prev,
        paymentWithdrawals: prev.paymentWithdrawals.filter((item) => item.id !== id),
      };
      void saveAuxiliaryModulesToSupabaseMetadata({
        wageRecords: nextState.wageRecords,
        paymentWithdrawals: nextState.paymentWithdrawals,
        loanRecords: nextState.loanRecords,
        fundRecords: nextState.fundRecords,
        incomeExpenseRecords: nextState.incomeExpenseRecords,
      });
      return nextState;
    });
  };

  // Loan CRUD handlers
  const handleSaveLoan = (loan: LoanRecord) => {
    setRepo((prev) => {
      const exists = prev.loanRecords.some((item) => item.id === loan.id);
      const nextLoans = exists
        ? prev.loanRecords.map((item) => (item.id === loan.id ? loan : item))
        : [loan, ...prev.loanRecords];
      const nextState = { ...prev, loanRecords: nextLoans };
      void saveAuxiliaryModulesToSupabaseMetadata({
        wageRecords: nextState.wageRecords,
        paymentWithdrawals: nextState.paymentWithdrawals,
        loanRecords: nextState.loanRecords,
        fundRecords: nextState.fundRecords,
        incomeExpenseRecords: nextState.incomeExpenseRecords,
      });
      return nextState;
    });
  };

  const handleDeleteLoan = (id: string) => {
    setRepo((prev) => {
      const nextState = {
        ...prev,
        loanRecords: prev.loanRecords.filter((item) => item.id !== id),
      };
      void saveAuxiliaryModulesToSupabaseMetadata({
        wageRecords: nextState.wageRecords,
        paymentWithdrawals: nextState.paymentWithdrawals,
        loanRecords: nextState.loanRecords,
        fundRecords: nextState.fundRecords,
        incomeExpenseRecords: nextState.incomeExpenseRecords,
      });
      return nextState;
    });
  };

  // Fund CRUD handlers
  const handleSaveFund = (fund: FundRecord) => {
    setRepo((prev) => {
      const exists = prev.fundRecords.some((item) => item.id === fund.id);
      const nextFunds = exists
        ? prev.fundRecords.map((item) => (item.id === fund.id ? fund : item))
        : [fund, ...prev.fundRecords];
      const nextState = { ...prev, fundRecords: nextFunds };
      void saveAuxiliaryModulesToSupabaseMetadata({
        wageRecords: nextState.wageRecords,
        paymentWithdrawals: nextState.paymentWithdrawals,
        loanRecords: nextState.loanRecords,
        fundRecords: nextState.fundRecords,
        incomeExpenseRecords: nextState.incomeExpenseRecords,
      });
      return nextState;
    });
  };

  const handleDeleteFund = (id: string) => {
    setRepo((prev) => {
      const nextState = {
        ...prev,
        fundRecords: prev.fundRecords.filter((item) => item.id !== id),
      };
      void saveAuxiliaryModulesToSupabaseMetadata({
        wageRecords: nextState.wageRecords,
        paymentWithdrawals: nextState.paymentWithdrawals,
        loanRecords: nextState.loanRecords,
        fundRecords: nextState.fundRecords,
        incomeExpenseRecords: nextState.incomeExpenseRecords,
      });
      return nextState;
    });
  };

  // Income & Expense CRUD handlers
  const handleSaveTransaction = (tx: IncomeExpenseRecord) => {
    setRepo((prev) => {
      const exists = prev.incomeExpenseRecords.some((item) => item.id === tx.id);
      const nextTx = exists
        ? prev.incomeExpenseRecords.map((item) =>
            item.id === tx.id ? tx : item
          )
        : [tx, ...prev.incomeExpenseRecords];
      const nextState = { ...prev, incomeExpenseRecords: nextTx };
      void saveAuxiliaryModulesToSupabaseMetadata({
        wageRecords: nextState.wageRecords,
        paymentWithdrawals: nextState.paymentWithdrawals,
        loanRecords: nextState.loanRecords,
        fundRecords: nextState.fundRecords,
        incomeExpenseRecords: nextState.incomeExpenseRecords,
      });
      return nextState;
    });
  };

  const handleDeleteTransaction = (id: string) => {
    setRepo((prev) => {
      const nextState = {
        ...prev,
        incomeExpenseRecords: prev.incomeExpenseRecords.filter(
          (item) => item.id !== id
        ),
      };
      void saveAuxiliaryModulesToSupabaseMetadata({
        wageRecords: nextState.wageRecords,
        paymentWithdrawals: nextState.paymentWithdrawals,
        loanRecords: nextState.loanRecords,
        fundRecords: nextState.fundRecords,
        incomeExpenseRecords: nextState.incomeExpenseRecords,
      });
      return nextState;
    });
  };

  const dashboardMetrics = useMemo(() => computeDashboardMetrics(repo), [repo]);
  const weeklySeries = useMemo(() => computeCurrentWeekSeries(repo), [repo]);
  const monthlySeries = useMemo(
    () => computeMonthlyIncomeExpenseSeries(repo),
    [repo]
  );

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
            onImportFullRepositoryState={handleImportFullRepositoryState}
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
            onResetSessionPreviewData={() => {
              const empty = getInitialRepositoryState();
              setRepo(empty);
              saveCachedRepositoryState(currentUser?.id ?? null, empty);
            }}
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

        {cloudSyncBannerBn && (
          <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-center gap-3">
            <span>{cloudSyncBannerBn}</span>
            <button
              type="button"
              onClick={() => setActiveModule(ModuleId.DATA_MANAGEMENT)}
              className="px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold cursor-pointer"
            >
              টেবিল সেটআপ SQL দেখুন →
            </button>
            <button
              type="button"
              onClick={() => setCloudSyncBannerBn(null)}
              className="underline font-semibold cursor-pointer"
            >
              বন্ধ করুন
            </button>
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
