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
import {
  buildWageRecordsFromProductionAndWithdrawals,
  fetchAndParseAttachedUserBackup,
} from './services/backupImportService';
import {
  ApplicationRepositoryState,
  computeCurrentWeekSeries,
  computeDashboardMetrics,
  computeMonthlyIncomeExpenseSeries,
  getInitialRepositoryState,
} from './services/financialDomainService';
import {
  batchImportProductionEntriesToSupabase,
  deduplicateAndCleanProductionEntries,
  deleteProductionEntryFromSupabase,
  fetchProductionEntriesFromSupabase,
  getEntryDateItemSignature,
  getLocalDeletedTombstones,
  isEntryDeletedByTombstone,
  markEntryDeletedInTombstones,
  readAuxiliaryModulesFromSupabaseMetadata,
  rollbackImportBatchFromSupabase,
  saveAuxiliaryModulesToSupabaseMetadata,
  saveProductionEntryToSupabase,
  toDeterministicUuid,
  unmarkEntryDeletedInTombstones,
  uploadProductionPhotoToSupabase,
  writeEntriesToSupabaseUserMetadata,
} from './services/supabaseDataService';
import { DataExportModal } from './components/ui/DataExportModal';
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
const THEME_STORAGE_KEY = 'smart_hisab_theme';

function filterAuxByTombstones<T extends { id: string }>(list: T[]): T[] {
  const deletedIds = new Set(getLocalDeletedTombstones().ids);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    if (!item || !item.id) continue;
    if (
      deletedIds.has(item.id) ||
      deletedIds.has(toDeterministicUuid(item.id))
    ) {
      continue;
    }
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Merges auxiliary lists (Withdrawals, Loans, Funds, Income/Expense) across multiple sources.
 * Earlier lists in `priorityLists` take precedence over later lists (so user edits and manual additions
 * in local/cloud state always override raw unedited backup items).
 */
function mergeAuxiliaryListsByPriority<T extends { id: string }>(
  priorityLists: (T[] | undefined | null)[]
): T[] {
  const map = new Map<string, T>();
  for (const list of priorityLists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || !item.id) continue;
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
  }
  return filterAuxByTombstones(Array.from(map.values()));
}

/**
 * Reads and merges all available `smart_hisab_repo_cache_*` keys in `localStorage`
 * without destructively deduplicating before `referenceBackupEntries` is available.
 */
function collectAllLocalCachedStates(
  preferredUserId?: string | null
): ApplicationRepositoryState | null {
  if (typeof window === 'undefined') return null;
  try {
    const candidateKeys: string[] = [];
    if (preferredUserId) {
      candidateKeys.push(`${LOCAL_CACHE_KEY_PREFIX}${preferredUserId}`);
    }
    candidateKeys.push(`${LOCAL_CACHE_KEY_PREFIX}guest`);

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        k.startsWith('smart_hisab_repo_cache_') &&
        !candidateKeys.includes(k)
      ) {
        candidateKeys.push(k);
      }
    }

    const states: Partial<ApplicationRepositoryState>[] = [];
    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Partial<ApplicationRepositoryState>;
        if (parsed && typeof parsed === 'object') {
          states.push(parsed);
        }
      } catch {
        // ignore malformed cache entry
      }
    }

    if (states.length === 0) return null;

    const tombstones = getLocalDeletedTombstones();
    const combinedProd: ProductionEntry[] = [];
    for (const st of states) {
      if (Array.isArray(st.productionEntries)) {
        for (const entry of st.productionEntries) {
          if (entry && !isEntryDeletedByTombstone(entry, tombstones)) {
            combinedProd.push(entry);
          }
        }
      }
    }

    return {
      productionEntries: combinedProd,
      paymentWithdrawals: mergeAuxiliaryListsByPriority(
        states.map((s) => s.paymentWithdrawals)
      ),
      wageRecords: mergeAuxiliaryListsByPriority(
        states.map((s) => s.wageRecords)
      ),
      loanRecords: mergeAuxiliaryListsByPriority(
        states.map((s) => s.loanRecords)
      ),
      fundRecords: mergeAuxiliaryListsByPriority(
        states.map((s) => s.fundRecords)
      ),
      incomeExpenseRecords: mergeAuxiliaryListsByPriority(
        states.map((s) => s.incomeExpenseRecords)
      ),
    };
  } catch {
    return null;
  }
}

/**
 * Saves repository state to `localStorage`, stripping static backup base64 images
 * (which are always rehydrated in memory from `/assets/aistudio/SmartHisab_Backup_2026-11-06_c15212d6.json`)
 * so `localStorage` never hits the 5MB QuotaExceededError while keeping user-uploaded photos!
 */
function saveCachedRepositoryState(
  userId: string | null,
  state: ApplicationRepositoryState,
  backupPhotoSigs?: Set<string>
): void {
  if (typeof window === 'undefined') return;
  const key = `${LOCAL_CACHE_KEY_PREFIX}${userId || 'guest'}`;

  const compactEntries: ProductionEntry[] = state.productionEntries.map((e) => {
    const sig = getEntryDateItemSignature(e);
    const isStaticBackupPhoto = backupPhotoSigs?.has(sig) ?? false;
    return {
      ...e,
      photos: (e.photos || [])
        .filter((p) => {
          const url = p.previewUrl || p.storagePath || '';
          if (isStaticBackupPhoto && url.startsWith('data:image')) {
            // Static backup photo will be rehydrated from attached JSON asset on load
            return false;
          }
          return true;
        })
        .map((p) => ({
          ...p,
          storagePath: (p.storagePath || '').startsWith('data:')
            ? ''
            : p.storagePath,
        })),
    };
  });

  const compactState: ApplicationRepositoryState = {
    ...state,
    productionEntries: compactEntries,
  };

  try {
    localStorage.setItem(key, JSON.stringify(compactState));
    if (userId) {
      // Also mirror into guest cache so switching between iframe preview and standalone tab never loses work
      localStorage.setItem(
        `${LOCAL_CACHE_KEY_PREFIX}guest`,
        JSON.stringify(compactState)
      );
    }
  } catch {
    // Fallback if user uploaded many large custom photos: strip data URLs from localStorage cache only
    try {
      const ultraCompact: ApplicationRepositoryState = {
        ...state,
        productionEntries: state.productionEntries.map((e) => ({
          ...e,
          photos: (e.photos || []).filter(
            (p) =>
              !(p.previewUrl || '').startsWith('data:') &&
              !(p.storagePath || '').startsWith('data:')
          ),
        })),
      };
      localStorage.setItem(key, JSON.stringify(ultraCompact));
    } catch {
      // ignore
    }
  }
}

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>(ModuleId.DASHBOARD);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'dark' || saved === 'light') return saved;
      } catch {
        // fallback
      }
    }
    return 'light';
  });
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [showLoginView, setShowLoginView] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [isHydrationComplete, setIsHydrationComplete] = useState<boolean>(false);
  const [isLoadingCloudData, setIsLoadingCloudData] = useState<boolean>(false);
  const [cloudSyncBannerBn, setCloudSyncBannerBn] = useState<string | null>(null);

  const [repo, setRepo] = useState<ApplicationRepositoryState>(() => {
    return collectAllLocalCachedStates(null) || getInitialRepositoryState();
  });

  const isSyncingRef = useRef(false);
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const referenceBackupEntriesRef = useRef<ProductionEntry[]>([]);
  const backupPhotoSigsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Persist mirror cache ONLY after initial hydration & cloud merge have completed
  useEffect(() => {
    if (!isHydrationComplete) return;
    saveCachedRepositoryState(
      currentUser?.id ?? null,
      repo,
      backupPhotoSigsRef.current
    );
  }, [repo, currentUser?.id, isHydrationComplete]);

  const loadCloudRecordsForUser = useCallback(async (user: AuthenticatedUser) => {
    if (!supabase || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsLoadingCloudData(true);
    setCloudSyncBannerBn(null);

    // 1. Synchronously snapshot all local caches BEFORE any await so nothing can overwrite them
    const localSnapshot = collectAllLocalCachedStates(user.id);

    try {
      // 2. Ensure reference backup is parsed so modification scoring & photo rehydration are 100% accurate
      const parsedBackup = await fetchAndParseAttachedUserBackup();
      const backupEntries = parsedBackup?.state.productionEntries || [];
      if (backupEntries.length > 0) {
        referenceBackupEntriesRef.current = backupEntries;
        const photoSigs = new Set<string>();
        for (const b of backupEntries) {
          if (b.photos && b.photos.length > 0) {
            photoSigs.add(getEntryDateItemSignature(b));
          }
        }
        backupPhotoSigsRef.current = photoSigs;
      }

      const alreadyLoadedFlag =
        localStorage.getItem(ATTACHED_BACKUP_IMPORTED_FLAG) === 'true';

      // 3. Fetch from BOTH Supabase SQL table (`public.production_entries`) AND `user_metadata` (`smart_hisab_production_entries_v1`)
      const [cloudProdResult, cloudAux] = await Promise.all([
        fetchProductionEntriesFromSupabase(user.id, backupEntries),
        readAuxiliaryModulesFromSupabaseMetadata(),
      ]);

      const {
        entries: cloudEntries,
        missingTableSetup,
        errorBn,
      } = cloudProdResult;

      if (missingTableSetup) {
        setCloudSyncBannerBn(
          'আপনার ডেটা বর্তমানে সুপাবেস ক্লাউড প্রোফাইলে সুরক্ষিতভাবে সংরক্ষিত হচ্ছে। পূর্ণাঙ্গ SQL টেবিল চালু করতে "ডেটা ম্যানেজমেন্ট" পাতা থেকে ১-ক্লিকে SQL কোডটি Supabase SQL Editor-এ Run করুন।'
        );
      } else if (errorBn) {
        setCloudSyncBannerBn(errorBn);
      }

      let finalCloudEntries = cloudEntries;

      // Only seed from attached backup if cloud AND all local caches are completely empty
      let autoLoadedBackupState: ApplicationRepositoryState | null = null;
      if (
        !alreadyLoadedFlag &&
        finalCloudEntries.length === 0 &&
        (!localSnapshot || localSnapshot.productionEntries.length === 0) &&
        parsedBackup &&
        parsedBackup.state.productionEntries.length > 0
      ) {
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
      } else if (
        finalCloudEntries.length > 0 ||
        (localSnapshot && localSnapshot.productionEntries.length > 0)
      ) {
        localStorage.setItem(ATTACHED_BACKUP_IMPORTED_FLAG, 'true');
      }

      let entriesToSyncBackToCloud: ProductionEntry[] = [];
      let mergedAuxToSync: {
        wageRecords: WageLedgerRecord[];
        paymentWithdrawals: PaymentWithdrawalRecord[];
        loanRecords: LoanRecord[];
        fundRecords: FundRecord[];
        incomeExpenseRecords: IncomeExpenseRecord[];
      } | null = null;

      setRepo((prev) => {
        // Combine ALL sources: local caches, current in-memory state, and cloud entries!
        // deduplicateAndCleanProductionEntries scores manual entries (100) and edited entries (>=10)
        // above unedited backup entries (0), so user edits & manual entries from ANY source ALWAYS win!
        const allCandidateEntries: ProductionEntry[] = [
          ...(localSnapshot?.productionEntries || []),
          ...(prev.productionEntries || []),
          ...finalCloudEntries,
          ...(autoLoadedBackupState?.productionEntries || []),
        ];

        const { cleanedEntries } = deduplicateAndCleanProductionEntries(
          allCandidateEntries,
          backupEntries
        );

        // Identify any manual or edited entries from local cache that need to be synced to cloud
        const cloudById = new Map<string, ProductionEntry>();
        for (const ce of finalCloudEntries) {
          cloudById.set(ce.id, ce);
        }
        for (const winner of cleanedEntries) {
          const inCloud = cloudById.get(winner.id);
          if (
            !inCloud ||
            inCloud.pieces !== winner.pieces ||
            Number(inCloud.ratePerDozen ?? 0) !==
              Number(winner.ratePerDozen ?? 0) ||
            Number(inCloud.totalWage ?? 0) !== Number(winner.totalWage ?? 0) ||
            inCloud.settlementStatus !== winner.settlementStatus ||
            inCloud.workStatus !== winner.workStatus ||
            (inCloud.countdownDurationMinutes ?? null) !==
              (winner.countdownDurationMinutes ?? null) ||
            (inCloud.deadlineAt ?? null) !== (winner.deadlineAt ?? null) ||
            (inCloud.shortDescription || '').trim() !==
              (winner.shortDescription || '').trim()
          ) {
            entriesToSyncBackToCloud.push(winner);
          }
        }

        const resolvedWithdrawals = mergeAuxiliaryListsByPriority([
          localSnapshot?.paymentWithdrawals,
          prev.paymentWithdrawals,
          cloudAux?.paymentWithdrawals,
          parsedBackup?.state.paymentWithdrawals,
        ]);

        const resolvedLoans = mergeAuxiliaryListsByPriority([
          localSnapshot?.loanRecords,
          prev.loanRecords,
          cloudAux?.loanRecords,
          parsedBackup?.state.loanRecords,
        ]);

        const resolvedFunds = mergeAuxiliaryListsByPriority([
          localSnapshot?.fundRecords,
          prev.fundRecords,
          cloudAux?.fundRecords,
          parsedBackup?.state.fundRecords,
        ]);

        const resolvedIncomeExpense = mergeAuxiliaryListsByPriority([
          localSnapshot?.incomeExpenseRecords,
          prev.incomeExpenseRecords,
          cloudAux?.incomeExpenseRecords,
          parsedBackup?.state.incomeExpenseRecords,
        ]);

        const dynamicWages = buildWageRecordsFromProductionAndWithdrawals(
          cleanedEntries,
          resolvedWithdrawals
        );
        const resolvedWages = mergeAuxiliaryListsByPriority([
          dynamicWages,
          localSnapshot?.wageRecords,
          prev.wageRecords,
          cloudAux?.wageRecords,
          parsedBackup?.state.wageRecords,
        ]);

        mergedAuxToSync = {
          wageRecords: resolvedWages,
          paymentWithdrawals: resolvedWithdrawals,
          loanRecords: resolvedLoans,
          fundRecords: resolvedFunds,
          incomeExpenseRecords: resolvedIncomeExpense,
        };

        const nextState: ApplicationRepositoryState = {
          productionEntries: cleanedEntries,
          paymentWithdrawals: resolvedWithdrawals,
          wageRecords: resolvedWages,
          loanRecords: resolvedLoans,
          fundRecords: resolvedFunds,
          incomeExpenseRecords: resolvedIncomeExpense,
        };
        saveCachedRepositoryState(
          user.id,
          nextState,
          backupPhotoSigsRef.current
        );
        return nextState;
      });

      // Persist any recovered local manual/edited entries to Supabase cloud in the background
      if (entriesToSyncBackToCloud.length > 0) {
        void batchImportProductionEntriesToSupabase(
          entriesToSyncBackToCloud,
          'recovered-sync'
        );
        void writeEntriesToSupabaseUserMetadata(
          entriesToSyncBackToCloud,
          backupEntries
        );
      }
      if (mergedAuxToSync) {
        void saveAuxiliaryModulesToSupabaseMetadata(mergedAuxToSync);
      }
    } finally {
      setIsLoadingCloudData(false);
      setIsHydrationComplete(true);
      isSyncingRef.current = false;
    }
  }, []);

  // Unified, race-free startup hydration for both Guest and Logged-In sessions
  useEffect(() => {
    let isMounted = true;

    const initializeApplication = async () => {
      // 1. Synchronously read all local caches before any async work
      const localSnapshot = collectAllLocalCachedStates(null);

      // 2. Load reference backup so deduplication & photo rehydration have full reference context
      const parsedBackup = await fetchAndParseAttachedUserBackup();
      if (!isMounted) return;

      const backupEntries = parsedBackup?.state.productionEntries || [];
      if (backupEntries.length > 0) {
        referenceBackupEntriesRef.current = backupEntries;
        const photoSigs = new Set<string>();
        for (const b of backupEntries) {
          if (b.photos && b.photos.length > 0) {
            photoSigs.add(getEntryDateItemSignature(b));
          }
        }
        backupPhotoSigsRef.current = photoSigs;
      }

      // 3. Check Supabase Auth session if configured
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        const usr = data.session?.user ?? null;
        setCurrentUser(usr);

        if (usr) {
          lastLoadedUserIdRef.current = usr.id;
          await loadCloudRecordsForUser(usr);
          return;
        }
      }

      // 4. Guest / Unauthenticated hydration: merge all local caches and rehydrate backup photos
      setRepo((prev) => {
        const candidateEntries = [
          ...(localSnapshot?.productionEntries || []),
          ...(prev.productionEntries || []),
        ];
        const alreadyLoaded =
          localStorage.getItem(ATTACHED_BACKUP_IMPORTED_FLAG) === 'true';

        if (candidateEntries.length > 0 || alreadyLoaded) {
          localStorage.setItem(ATTACHED_BACKUP_IMPORTED_FLAG, 'true');
          const { cleanedEntries } = deduplicateAndCleanProductionEntries(
            candidateEntries,
            backupEntries
          );
          const resolvedWithdrawals = mergeAuxiliaryListsByPriority([
            localSnapshot?.paymentWithdrawals,
            prev.paymentWithdrawals,
            parsedBackup?.state.paymentWithdrawals,
          ]);
          const dynamicWages = buildWageRecordsFromProductionAndWithdrawals(
            cleanedEntries,
            resolvedWithdrawals
          );
          const nextState: ApplicationRepositoryState = {
            productionEntries: cleanedEntries,
            paymentWithdrawals: resolvedWithdrawals,
            wageRecords: mergeAuxiliaryListsByPriority([
              dynamicWages,
              localSnapshot?.wageRecords,
              prev.wageRecords,
              parsedBackup?.state.wageRecords,
            ]),
            loanRecords: mergeAuxiliaryListsByPriority([
              localSnapshot?.loanRecords,
              prev.loanRecords,
              parsedBackup?.state.loanRecords,
            ]),
            fundRecords: mergeAuxiliaryListsByPriority([
              localSnapshot?.fundRecords,
              prev.fundRecords,
              parsedBackup?.state.fundRecords,
            ]),
            incomeExpenseRecords: mergeAuxiliaryListsByPriority([
              localSnapshot?.incomeExpenseRecords,
              prev.incomeExpenseRecords,
              parsedBackup?.state.incomeExpenseRecords,
            ]),
          };
          saveCachedRepositoryState(
            null,
            nextState,
            backupPhotoSigsRef.current
          );
          return nextState;
        }

        if (parsedBackup) {
          localStorage.setItem(ATTACHED_BACKUP_IMPORTED_FLAG, 'true');
          const { cleanedEntries } = deduplicateAndCleanProductionEntries(
            parsedBackup.state.productionEntries,
            backupEntries
          );
          const seededState: ApplicationRepositoryState = {
            productionEntries: cleanedEntries,
            wageRecords: filterAuxByTombstones(parsedBackup.state.wageRecords),
            paymentWithdrawals: filterAuxByTombstones(
              parsedBackup.state.paymentWithdrawals
            ),
            loanRecords: filterAuxByTombstones(parsedBackup.state.loanRecords),
            fundRecords: filterAuxByTombstones(parsedBackup.state.fundRecords),
            incomeExpenseRecords: filterAuxByTombstones(
              parsedBackup.state.incomeExpenseRecords
            ),
          };
          saveCachedRepositoryState(
            null,
            seededState,
            backupPhotoSigsRef.current
          );
          return seededState;
        }

        return prev;
      });

      setIsHydrationComplete(true);
    };

    void initializeApplication();

    let currentSubscription: { unsubscribe: () => void } | null = null;

    const attachAuthListener = () => {
      if (currentSubscription) {
        currentSubscription.unsubscribe();
        currentSubscription = null;
      }
      if (!supabase) return;

      const { data: authListener } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!isMounted) return;
          const usr = session?.user ?? null;
          setCurrentUser(usr);

          if (
            event === 'SIGNED_IN' &&
            typeof window !== 'undefined' &&
            (window.location.hash.includes('access_token=') ||
              window.location.search.includes('code='))
          ) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          }

          // Ignore USER_UPDATED and TOKEN_REFRESHED events so saving/deleting metadata
          // via supabase.auth.updateUser() never triggers a background reload race condition!
          if (event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
            return;
          }

          if (usr && lastLoadedUserIdRef.current !== usr.id) {
            lastLoadedUserIdRef.current = usr.id;
            void loadCloudRecordsForUser(usr);
          } else if (!usr) {
            lastLoadedUserIdRef.current = null;
          }
        }
      );

      currentSubscription = authListener.subscription;
    };

    attachAuthListener();

    const handleReconfigured = () => {
      attachAuthListener();
      if (supabase) {
        void supabase.auth.getSession().then(({ data }) => {
          if (!isMounted) return;
          const usr = data.session?.user ?? null;
          setCurrentUser(usr);
          if (usr && lastLoadedUserIdRef.current !== usr.id) {
            lastLoadedUserIdRef.current = usr.id;
            void loadCloudRecordsForUser(usr);
          }
        });
      }
    };

    const handleWindowFocus = () => {
      if (!supabase) return;
      void supabase.auth.getSession().then(({ data }) => {
        if (!isMounted) return;
        const usr = data.session?.user ?? null;
        if (usr && lastLoadedUserIdRef.current !== usr.id) {
          setCurrentUser(usr);
          lastLoadedUserIdRef.current = usr.id;
          void loadCloudRecordsForUser(usr);
        }
      });
    };

    window.addEventListener(
      'smart-hisab-supabase-reconfigured',
      handleReconfigured
    );
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      isMounted = false;
      window.removeEventListener(
        'smart-hisab-supabase-reconfigured',
        handleReconfigured
      );
      window.removeEventListener('focus', handleWindowFocus);
      if (currentSubscription) {
        currentSubscription.unsubscribe();
      }
    };
  }, [loadCloudRecordsForUser]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Production CRUD handlers: Optimistically updates state & cache in-place and awaits confirmed Supabase save
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

    const canonicalId = toDeterministicUuid(entry.id);
    const nowIso = new Date().toISOString();
    const entryWithPhotos: ProductionEntry = {
      ...entry,
      id: canonicalId,
      photos: updatedPhotos,
      createdAt: nowIso,
    };

    const previousSnapshot = repo.productionEntries.find(
      (item) =>
        item.id === entry.id || toDeterministicUuid(item.id) === canonicalId
    );

    unmarkEntryDeletedInTombstones(entryWithPhotos);

    // 1. Optimistic in-place update so UI and localStorage are immediately consistent
    setRepo((prev) => {
      const exists = prev.productionEntries.some(
        (item) =>
          item.id === entry.id ||
          toDeterministicUuid(item.id) === canonicalId
      );
      const rawUpdatedList = exists
        ? prev.productionEntries.map((item) =>
            item.id === entry.id ||
            toDeterministicUuid(item.id) === canonicalId
              ? entryWithPhotos
              : item
          )
        : [entryWithPhotos, ...prev.productionEntries];

      const { cleanedEntries } = deduplicateAndCleanProductionEntries(
        rawUpdatedList,
        referenceBackupEntriesRef.current
      );

      const nextState = {
        ...prev,
        productionEntries: cleanedEntries,
        wageRecords: buildWageRecordsFromProductionAndWithdrawals(
          cleanedEntries,
          prev.paymentWithdrawals
        ),
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
      return nextState;
    });

    // 2. Persist to Supabase cloud (`public.production_entries` + `user_metadata` mirror)
    const { savedEntry, persistedToCloud, errorBn } =
      await saveProductionEntryToSupabase(entryWithPhotos, previousSnapshot);

    setRepo((prev) => {
      const exists = prev.productionEntries.some(
        (item) =>
          item.id === entry.id ||
          toDeterministicUuid(item.id) === canonicalId ||
          item.id === savedEntry.id
      );
      const rawUpdatedList = exists
        ? prev.productionEntries.map((item) =>
            item.id === entry.id ||
            toDeterministicUuid(item.id) === canonicalId ||
            item.id === savedEntry.id
              ? savedEntry
              : item
          )
        : [savedEntry, ...prev.productionEntries];

      const { cleanedEntries } = deduplicateAndCleanProductionEntries(
        rawUpdatedList,
        referenceBackupEntriesRef.current
      );

      const nextState = {
        ...prev,
        productionEntries: cleanedEntries,
        wageRecords: buildWageRecordsFromProductionAndWithdrawals(
          cleanedEntries,
          prev.paymentWithdrawals
        ),
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
      return nextState;
    });

    return { persistedToCloud, errorBn };
  };

  const handleDeleteProduction = async (id: string) => {
    const canonicalId = toDeterministicUuid(id);
    const targetSnapshot = repo.productionEntries.find(
      (item) =>
        item.id === id || toDeterministicUuid(item.id) === canonicalId
    );
    const targetSig = targetSnapshot
      ? getEntryDateItemSignature(targetSnapshot)
      : null;

    // 1. Immediately record deletion tombstone so this entry can NEVER resurrect
    markEntryDeletedInTombstones(targetSnapshot || id);

    // 2. Immediately remove from state and localStorage cache before network call
    setRepo((prev) => {
      const nextEntries = prev.productionEntries.filter(
        (item) =>
          item.id !== id &&
          toDeterministicUuid(item.id) !== canonicalId &&
          (!targetSig || getEntryDateItemSignature(item) !== targetSig)
      );
      const nextState = {
        ...prev,
        productionEntries: nextEntries,
        wageRecords: buildWageRecordsFromProductionAndWithdrawals(
          nextEntries,
          prev.paymentWithdrawals
        ),
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
      return nextState;
    });

    // 3. Delete from Supabase SQL table and Auth metadata mirror
    await deleteProductionEntryFromSupabase(id, targetSnapshot);
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
      const { cleanedEntries } = deduplicateAndCleanProductionEntries(
        [...added, ...prev.productionEntries],
        referenceBackupEntriesRef.current
      );
      const nextState = {
        ...prev,
        productionEntries: cleanedEntries,
        wageRecords: buildWageRecordsFromProductionAndWithdrawals(
          cleanedEntries,
          prev.paymentWithdrawals
        ),
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
      const nextEntries = prev.productionEntries.filter(
        (e) => e.importBatchId !== batchId
      );
      const nextState = {
        ...prev,
        productionEntries: nextEntries,
        wageRecords: buildWageRecordsFromProductionAndWithdrawals(
          nextEntries,
          prev.paymentWithdrawals
        ),
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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

    const nextWithdrawals = mergeAuxiliaryListsByPriority([
      repo.paymentWithdrawals,
      importedState.paymentWithdrawals,
    ]);
    const nextLoans = mergeAuxiliaryListsByPriority([
      repo.loanRecords,
      importedState.loanRecords,
    ]);
    const nextFunds = mergeAuxiliaryListsByPriority([
      repo.fundRecords,
      importedState.fundRecords,
    ]);
    const nextIncomeExpense = mergeAuxiliaryListsByPriority([
      repo.incomeExpenseRecords,
      importedState.incomeExpenseRecords,
    ]);
    const nextWageRecords = mergeAuxiliaryListsByPriority([
      repo.wageRecords,
      importedState.wageRecords,
    ]);

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
      // Put prev.productionEntries FIRST so user edits and manual entries always win over imported backup!
      const { cleanedEntries } = deduplicateAndCleanProductionEntries(
        [...prev.productionEntries, ...cloudSavedProd],
        referenceBackupEntriesRef.current
      );
      const dynamicWages = buildWageRecordsFromProductionAndWithdrawals(
        cleanedEntries,
        nextWithdrawals
      );
      const nextState: ApplicationRepositoryState = {
        productionEntries: cleanedEntries,
        wageRecords: mergeAuxiliaryListsByPriority([
          dynamicWages,
          nextWageRecords,
        ]),
        paymentWithdrawals: nextWithdrawals,
        loanRecords: nextLoans,
        fundRecords: nextFunds,
        incomeExpenseRecords: nextIncomeExpense,
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
    markEntryDeletedInTombstones(id);
    setRepo((prev) => {
      const nextState = {
        ...prev,
        wageRecords: prev.wageRecords.filter((item) => item.id !== id),
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
    unmarkEntryDeletedInTombstones({
      id: record.id,
      date: record.date,
      itemName: record.remarks || 'উত্তোলন',
      category: '',
      garmentType: '',
      size: '',
      sizes: [],
      color: '',
      colors: [],
      pieces: 0,
      dozens: 0,
      ratePerDozen: 0,
      totalWage: 0,
      receivedWage: record.amount,
      pendingWage: 0,
      workStatus: 'completed',
      settlementStatus: 'settled',
      startWorkTime: null,
      endWorkTime: null,
      workDurationMinutes: null,
      shortDescription: '',
      photos: [],
    });
    setRepo((prev) => {
      const exists = prev.paymentWithdrawals.some((item) => item.id === record.id);
      const nextWithdrawals = exists
        ? prev.paymentWithdrawals.map((item) =>
            item.id === record.id ? record : item
          )
        : [record, ...prev.paymentWithdrawals];
      const nextState = {
        ...prev,
        paymentWithdrawals: nextWithdrawals,
        wageRecords: buildWageRecordsFromProductionAndWithdrawals(
          prev.productionEntries,
          nextWithdrawals
        ),
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
    markEntryDeletedInTombstones(id);
    setRepo((prev) => {
      const nextWithdrawals = prev.paymentWithdrawals.filter(
        (item) => item.id !== id
      );
      const nextState = {
        ...prev,
        paymentWithdrawals: nextWithdrawals,
        wageRecords: buildWageRecordsFromProductionAndWithdrawals(
          prev.productionEntries,
          nextWithdrawals
        ),
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
    markEntryDeletedInTombstones(id);
    setRepo((prev) => {
      const nextState = {
        ...prev,
        loanRecords: prev.loanRecords.filter((item) => item.id !== id),
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
    markEntryDeletedInTombstones(id);
    setRepo((prev) => {
      const nextState = {
        ...prev,
        fundRecords: prev.fundRecords.filter((item) => item.id !== id),
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
    markEntryDeletedInTombstones(id);
    setRepo((prev) => {
      const nextState = {
        ...prev,
        incomeExpenseRecords: prev.incomeExpenseRecords.filter(
          (item) => item.id !== id
        ),
      };
      saveCachedRepositoryState(
        currentUser?.id ?? null,
        nextState,
        backupPhotoSigsRef.current
      );
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
            funds={repo.fundRecords}
            loans={repo.loanRecords}
            weeklySeries={weeklySeries}
            monthlySeries={monthlySeries}
            onNavigate={setActiveModule}
            onSaveProduction={handleSaveProduction}
            onSaveWithdrawal={handleSaveWithdrawal}
            onSaveFund={handleSaveFund}
            onSaveLoan={handleSaveLoan}
            onSaveTransaction={handleSaveTransaction}
          />
        );
      case ModuleId.PRODUCTION:
        return (
          <ProductionLedgerPage
            entries={repo.productionEntries}
            withdrawals={repo.paymentWithdrawals}
            onSaveEntry={handleSaveProduction}
            onDeleteEntry={handleDeleteProduction}
            onSaveWithdrawal={handleSaveWithdrawal}
            onDeleteWithdrawal={handleDeleteWithdrawal}
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
              saveCachedRepositoryState(
                currentUser?.id ?? null,
                empty,
                backupPhotoSigsRef.current
              );
            }}
          />
        );
      case ModuleId.SETTINGS:
        return (
          <SettingsPage
            theme={theme}
            onSelectTheme={setTheme}
            onOpenLoginView={() => setShowLoginView(true)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onNavigate={setActiveModule}
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
            সুপাবেস ডাটাবেস থেকে প্রোডাকশন ও সম্পাদিত তথ্য পুনরুদ্ধার হচ্ছে...
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

      {/* Backup and Data Export Modal */}
      <DataExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        repo={repo}
      />
    </div>
  );
}
