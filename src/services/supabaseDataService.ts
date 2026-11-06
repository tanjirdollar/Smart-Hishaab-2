import { supabase, SUPABASE_STORAGE_BUCKETS, SUPABASE_TABLES } from '../lib/supabase/client';
import {
  FundRecord,
  IncomeExpenseRecord,
  LoanRecord,
  PaymentWithdrawalRecord,
  ProductionEntry,
  SettlementStatus,
  UploadedPhotoPreview,
  WageLedgerRecord,
  WorkStatus,
} from '../types/models';
import {
  calculateDozensFromPieces,
  calculateDurationMinutes,
  calculateEarnedWageFromPiecesAndRate,
  ddMmYyyyToIsoInput,
  isoInputToDDMMYYYY,
} from '../utils/formatters';

/**
 * Supabase Data Persistence Service
 *
 * Maps between the application's ProductionEntry model and the `public.production_entries`
 * table in Supabase, preserving historical rates, timestamps, and independent statuses.
 *
 * Includes TWO automatic resilience layers:
 * 1. Legacy-column fallback (`PGRST204`): Works even if only Phase-1 columns exist.
 * 2. Missing-table cloud fallback (`PGRST205` / `Could not find the table 'public.production_entries'`):
 *    If the user has not yet run the SQL script in Supabase SQL Editor to create `public.production_entries`,
 *    automatically persists and loads production entries via Supabase Auth `user_metadata`
 *    (`supabase.auth.updateUser`) so data is still saved in the user's Supabase cloud account across refreshes
 *    and automatically migrates into `public.production_entries` as soon as the table is created!
 */

const AUTH_METADATA_ENTRIES_KEY = 'smart_hisab_production_entries_v1';
const AUTH_METADATA_AUXILIARY_KEY = 'smart_hisab_auxiliary_modules_v1';

export const SUPABASE_SETUP_SQL_SCRIPT = `CREATE TABLE IF NOT EXISTS public.production_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  item_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  garment_type text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  sizes text[] DEFAULT '{}',
  color text NOT NULL DEFAULT '',
  colors text[] DEFAULT '{}',
  pieces integer NOT NULL DEFAULT 0,
  dozens numeric(12, 4) NOT NULL DEFAULT 0,
  rate_per_dozen numeric(12, 2) NOT NULL DEFAULT 0,
  total_wage numeric(14, 2) NOT NULL DEFAULT 0,
  received_wage numeric(14, 2) NOT NULL DEFAULT 0,
  pending_wage numeric(14, 2) NOT NULL DEFAULT 0,
  work_status text NOT NULL DEFAULT 'in_progress',
  settlement_status text NOT NULL DEFAULT 'pending',
  start_work_time timestamptz NULL,
  end_work_time timestamptz NULL,
  work_duration_minutes integer NULL,
  short_description text DEFAULT '',
  photo_urls text[] DEFAULT '{}',
  import_batch_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.production_entries TO anon, authenticated, service_role;

ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prod_select_own" ON public.production_entries;
CREATE POLICY "prod_select_own" ON public.production_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "prod_insert_own" ON public.production_entries;
CREATE POLICY "prod_insert_own" ON public.production_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "prod_update_own" ON public.production_entries;
CREATE POLICY "prod_update_own" ON public.production_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "prod_delete_own" ON public.production_entries;
CREATE POLICY "prod_delete_own" ON public.production_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';`;

interface SupabaseProductionRow {
  id: string;
  user_id?: string;
  entry_date: string; // YYYY-MM-DD
  item_name?: string | null;
  category?: string | null;
  garment_type?: string | null;
  size?: string | null;
  sizes?: string[] | null;
  color?: string | null;
  colors?: string[] | null;
  pieces?: number | null;
  dozens?: number | null;
  rate_per_dozen?: number | null;
  total_wage?: number | null;
  received_wage?: number | null;
  pending_wage?: number | null;
  work_status?: string | null;
  settlement_status?: string | null;
  start_work_time?: string | null;
  end_work_time?: string | null;
  work_duration_minutes?: number | null;
  short_description?: string | null;
  photo_urls?: string[] | null;
  import_batch_id?: string | null;
  created_at?: string;
}

interface EmbeddedMetaPayload {
  in?: string; // itemName
  cat?: string; // category
  sz?: string[]; // sizes
  cl?: string[]; // colors
  ws?: WorkStatus;
  ss?: SettlementStatus;
  st?: string | null;
  et?: string | null;
  dur?: number | null;
  rw?: number | null;
  pw?: number | null;
  bid?: string;
}

const META_PREFIX = '<!--SH_META:';
const META_SUFFIX = '-->';

function packDescriptionWithMeta(
  cleanDescription: string,
  meta: EmbeddedMetaPayload
): string {
  const base = (cleanDescription || '').trim();
  const json = JSON.stringify(meta);
  return base
    ? `${base}\n${META_PREFIX}${json}${META_SUFFIX}`
    : `${META_PREFIX}${json}${META_SUFFIX}`;
}

function unpackDescriptionAndMeta(rawDescription?: string | null): {
  cleanDescription: string;
  meta: EmbeddedMetaPayload | null;
} {
  if (!rawDescription) {
    return { cleanDescription: '', meta: null };
  }
  const startIdx = rawDescription.indexOf(META_PREFIX);
  if (startIdx === -1) {
    return { cleanDescription: rawDescription, meta: null };
  }
  const endIdx = rawDescription.indexOf(META_SUFFIX, startIdx);
  if (endIdx === -1) {
    return { cleanDescription: rawDescription, meta: null };
  }
  const cleanDescription = rawDescription.slice(0, startIdx).trim();
  const jsonSlice = rawDescription.slice(startIdx + META_PREFIX.length, endIdx);
  try {
    const meta = JSON.parse(jsonSlice) as EmbeddedMetaPayload;
    return { cleanDescription, meta };
  } catch {
    return { cleanDescription, meta: null };
  }
}

export function mapSupabaseRowToProductionEntry(
  row: SupabaseProductionRow
): ProductionEntry {
  const { cleanDescription, meta } = unpackDescriptionAndMeta(row.short_description);

  const pieces = Number(row.pieces ?? 0);
  const dozens =
    row.dozens !== null && row.dozens !== undefined
      ? Number(row.dozens)
      : calculateDozensFromPieces(pieces);
  const ratePerDozen = Number(row.rate_per_dozen ?? 0);
  const totalWage =
    row.total_wage !== null && row.total_wage !== undefined
      ? Number(row.total_wage)
      : calculateEarnedWageFromPiecesAndRate(pieces, ratePerDozen);

  const rawSettlement = row.settlement_status ?? meta?.ss ?? 'pending';
  const settlementStatus: SettlementStatus =
    rawSettlement === 'settled' ? 'settled' : 'pending';

  const rawWorkStatus = row.work_status ?? meta?.ws ?? 'in_progress';
  const workStatus: WorkStatus =
    rawWorkStatus === 'completed' ? 'completed' : 'in_progress';

  const receivedWage =
    row.received_wage !== null && row.received_wage !== undefined
      ? Number(row.received_wage)
      : meta?.rw !== null && meta?.rw !== undefined
      ? Number(meta.rw)
      : settlementStatus === 'settled'
      ? totalWage
      : 0;

  const pendingWage =
    row.pending_wage !== null && row.pending_wage !== undefined
      ? Number(row.pending_wage)
      : meta?.pw !== null && meta?.pw !== undefined
      ? Number(meta.pw)
      : Math.max(0, Number((totalWage - receivedWage).toFixed(2)));

  const itemName = row.item_name || meta?.in || row.garment_type || '';
  const category = row.category || meta?.cat || '';

  const sizes =
    Array.isArray(row.sizes) && row.sizes.length > 0
      ? row.sizes
      : Array.isArray(meta?.sz) && meta.sz.length > 0
      ? meta.sz
      : row.size
      ? row.size
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const colors =
    Array.isArray(row.colors) && row.colors.length > 0
      ? row.colors
      : Array.isArray(meta?.cl) && meta.cl.length > 0
      ? meta.cl
      : row.color
      ? row.color
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : [];

  const startWorkTime = row.start_work_time ?? meta?.st ?? null;
  const endWorkTime = row.end_work_time ?? meta?.et ?? null;

  const photos: UploadedPhotoPreview[] = Array.isArray(row.photo_urls)
    ? row.photo_urls.map((url, idx) => ({
        id: `db-photo-${row.id}-${idx}`,
        fileName: `ছবি-${idx + 1}`,
        fileSize: 0,
        previewUrl: url,
        mimeType: 'image/jpeg',
        storagePath: url,
      }))
    : [];

  return {
    id: row.id,
    userId: row.user_id,
    date: isoInputToDDMMYYYY(row.entry_date),
    itemName,
    category,
    garmentType:
      itemName && category
        ? `${itemName} (${category})`
        : itemName || category || row.garment_type || '',
    size: sizes.join(', '),
    sizes,
    color: colors.join(', '),
    colors,
    pieces,
    dozens,
    ratePerDozen,
    totalWage,
    receivedWage,
    pendingWage,
    workStatus,
    settlementStatus,
    startWorkTime,
    endWorkTime,
    workDurationMinutes:
      row.work_duration_minutes ??
      meta?.dur ??
      calculateDurationMinutes(startWorkTime, endWorkTime),
    shortDescription: cleanDescription,
    photos,
    importBatchId: row.import_batch_id ?? meta?.bid ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapProductionEntryToSupabasePayload(
  entry: ProductionEntry,
  userId: string
): Record<string, unknown> {
  const isoDate =
    ddMmYyyyToIsoInput(entry.date) || new Date().toISOString().slice(0, 10);
  const photoUrls = entry.photos
    .map((p) => p.storagePath || p.previewUrl)
    .filter((u) => u && !u.startsWith('blob:'));

  const payload: Record<string, unknown> = {
    user_id: userId,
    entry_date: isoDate,
    item_name: entry.itemName,
    category: entry.category,
    garment_type:
      entry.garmentType ||
      (entry.itemName && entry.category
        ? `${entry.itemName} (${entry.category})`
        : entry.itemName || entry.category),
    size: entry.size,
    sizes: entry.sizes,
    color: entry.color,
    colors: entry.colors,
    pieces: entry.pieces ?? 0,
    dozens: entry.dozens ?? 0,
    rate_per_dozen: entry.ratePerDozen ?? 0,
    total_wage: entry.totalWage ?? 0,
    received_wage: entry.receivedWage ?? 0,
    pending_wage: entry.pendingWage ?? 0,
    work_status: entry.workStatus,
    settlement_status: entry.settlementStatus,
    start_work_time: entry.startWorkTime
      ? new Date(entry.startWorkTime).toISOString()
      : null,
    end_work_time: entry.endWorkTime
      ? new Date(entry.endWorkTime).toISOString()
      : null,
    work_duration_minutes: entry.workDurationMinutes,
    short_description: entry.shortDescription,
    photo_urls: photoUrls,
    import_batch_id: entry.importBatchId ?? null,
  };

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.id)) {
    payload.id = entry.id;
  }

  return payload;
}

function mapProductionEntryToLegacySupabasePayload(
  entry: ProductionEntry,
  userId: string
): Record<string, unknown> {
  const isoDate =
    ddMmYyyyToIsoInput(entry.date) || new Date().toISOString().slice(0, 10);
  const photoUrls = entry.photos
    .map((p) => p.storagePath || p.previewUrl)
    .filter((u) => u && !u.startsWith('blob:'));

  const packedDescription = packDescriptionWithMeta(entry.shortDescription, {
    in: entry.itemName,
    cat: entry.category,
    sz: entry.sizes,
    cl: entry.colors,
    ws: entry.workStatus,
    ss: entry.settlementStatus,
    st: entry.startWorkTime
      ? new Date(entry.startWorkTime).toISOString()
      : null,
    et: entry.endWorkTime
      ? new Date(entry.endWorkTime).toISOString()
      : null,
    dur: entry.workDurationMinutes,
    rw: entry.receivedWage,
    pw: entry.pendingWage,
    bid: entry.importBatchId,
  });

  const payload: Record<string, unknown> = {
    user_id: userId,
    entry_date: isoDate,
    garment_type:
      entry.itemName ||
      entry.category ||
      entry.garmentType ||
      'পোশাক আইটেম',
    size: entry.size || (entry.sizes ? entry.sizes.join(', ') : ''),
    color: entry.color || (entry.colors ? entry.colors.join(', ') : ''),
    dozens: entry.dozens ?? 0,
    pieces: entry.pieces ?? 0,
    rate_per_dozen: entry.ratePerDozen ?? 0,
    total_wage: entry.totalWage ?? 0,
    short_description: packedDescription,
    photo_urls: photoUrls,
  };

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.id)) {
    payload.id = entry.id;
  }

  return payload;
}

function isMissingColumnError(errMessage: string, errCode?: string): boolean {
  return (
    errCode === 'PGRST204' ||
    errCode === '42703' ||
    /Could not find the .* column/i.test(errMessage) ||
    /column .* does not exist/i.test(errMessage)
  );
}

function isMissingTableError(errMessage: string, errCode?: string): boolean {
  return (
    errCode === 'PGRST205' ||
    errCode === '42P01' ||
    errCode === '42501' ||
    /Could not find the table/i.test(errMessage) ||
    /relation .*production_entries.* does not exist/i.test(errMessage) ||
    /permission denied for table/i.test(errMessage)
  );
}

export interface AuxiliaryModulesCloudPayload {
  wageRecords?: WageLedgerRecord[];
  paymentWithdrawals?: PaymentWithdrawalRecord[];
  loanRecords?: LoanRecord[];
  fundRecords?: FundRecord[];
  incomeExpenseRecords?: IncomeExpenseRecord[];
}

/**
 * Reads auxiliary modules (Withdrawals, Wages, Loans, Funds, Income/Expense) stored in Supabase Auth `user_metadata`.
 */
export async function readAuxiliaryModulesFromSupabaseMetadata(): Promise<AuxiliaryModulesCloudPayload | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const raw = data.user?.user_metadata?.[AUTH_METADATA_AUXILIARY_KEY];
  if (!raw || typeof raw !== 'object') return null;
  return raw as AuxiliaryModulesCloudPayload;
}

/**
 * Persists auxiliary modules (Withdrawals, Wages, Loans, Funds, Income/Expense) into Supabase Auth `user_metadata`.
 */
export async function saveAuxiliaryModulesToSupabaseMetadata(
  payload: AuxiliaryModulesCloudPayload
): Promise<boolean> {
  if (!supabase) return false;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return false;

  const { error } = await supabase.auth.updateUser({
    data: {
      [AUTH_METADATA_AUXILIARY_KEY]: payload,
    },
  });
  return !error;
}

/**
 * Reads fallback production entries stored in Supabase Auth `user_metadata`.
 */
async function readEntriesFromSupabaseUserMetadata(): Promise<ProductionEntry[]> {
  if (!supabase) return [];
  const { data } = await supabase.auth.getUser();
  const rawList = data.user?.user_metadata?.[AUTH_METADATA_ENTRIES_KEY];
  if (!Array.isArray(rawList)) return [];
  return rawList as ProductionEntry[];
}

/**
 * Writes fallback production entries into Supabase Auth `user_metadata` so they
 * persist in the cloud even before `public.production_entries` table is created.
 */
async function writeEntriesToSupabaseUserMetadata(
  entries: ProductionEntry[]
): Promise<boolean> {
  if (!supabase) return false;
  // Strip blob and large base64 data URLs before saving in user_metadata to stay well within JWT metadata limits
  const sanitized = entries.slice(0, 150).map((e) => ({
    ...e,
    photos: (e.photos || []).filter(
      (p) =>
        (p.storagePath && !p.storagePath.startsWith('data:')) ||
        (p.previewUrl &&
          !p.previewUrl.startsWith('blob:') &&
          !p.previewUrl.startsWith('data:'))
    ),
  }));
  const { error } = await supabase.auth.updateUser({
    data: {
      [AUTH_METADATA_ENTRIES_KEY]: sanitized,
    },
  });
  return !error;
}

/**
 * Fetches all production entries for the authenticated user in chronological order (newest first).
 */
export async function fetchProductionEntriesFromSupabase(
  explicitUserId?: string
): Promise<{
  entries: ProductionEntry[];
  missingTableSetup?: boolean;
  errorBn: string | null;
}> {
  if (!supabase) {
    return { entries: [], errorBn: null };
  }

  let userId = explicitUserId;
  if (!userId) {
    const { data: sessionData } = await supabase.auth.getSession();
    userId = sessionData.session?.user?.id;
  }

  if (!userId) {
    return { entries: [], errorBn: null };
  }

  const { data, error } = await supabase
    .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    // If `public.production_entries` table hasn't been created in Supabase SQL Editor yet:
    if (isMissingTableError(error.message, error.code)) {
      const metadataEntries = await readEntriesFromSupabaseUserMetadata();
      return {
        entries: metadataEntries,
        missingTableSetup: true,
        errorBn: null,
      };
    }

    return {
      entries: [],
      errorBn: `সুপাবেস থেকে প্রোডাকশন তথ্য লোড করতে সমস্যা হয়েছে: ${error.message}`,
    };
  }

  let mapped = ((data || []) as SupabaseProductionRow[]).map(
    mapSupabaseRowToProductionEntry
  );

  // If the table was just created and is empty, check if there are entries in Auth user_metadata to migrate automatically
  if (mapped.length === 0) {
    const metadataEntries = await readEntriesFromSupabaseUserMetadata();
    if (metadataEntries.length > 0) {
      for (const item of metadataEntries) {
        await saveProductionEntryToSupabase(item);
      }
      const resAfterMigrate = await supabase
        .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
        .select('*')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (!resAfterMigrate.error && resAfterMigrate.data) {
        mapped = (resAfterMigrate.data as SupabaseProductionRow[]).map(
          mapSupabaseRowToProductionEntry
        );
        await writeEntriesToSupabaseUserMetadata([]);
      }
    }
  }

  return { entries: mapped, missingTableSetup: false, errorBn: null };
}

/**
 * Saves or updates a single production entry in Supabase.
 * Automatically falls back to legacy column layout or Auth user_metadata if table is not created yet.
 */
export async function saveProductionEntryToSupabase(
  entry: ProductionEntry
): Promise<{
  savedEntry: ProductionEntry;
  persistedToCloud: boolean;
  missingTableSetup?: boolean;
  errorBn: string | null;
}> {
  if (!supabase) {
    return {
      savedEntry: entry,
      persistedToCloud: false,
      errorBn:
        'সুপাবেস ক্লাউড সংযোগ কনফিগার করা নেই। স্থায়ীভাবে সংরক্ষণের জন্য সুপাবেস সংযোগ নিশ্চিত করুন।',
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;

  if (!userId) {
    return {
      savedEntry: entry,
      persistedToCloud: false,
      errorBn:
        'আপনি বর্তমানে লগইন করা নেই। পেজ রিফ্রেশের পরও ডেটা স্থায়ীভাবে ক্লাউডে রাখতে উপরে "লগইন" বাটনে ক্লিক করে গুগল বা ইমেইল দিয়ে লগইন করুন।',
    };
  }

  const fullPayload = mapProductionEntryToSupabasePayload(entry, userId);
  const isExistingUuid = Boolean(fullPayload.id);

  const attemptSave = async (payloadToUse: Record<string, unknown>) => {
    if (isExistingUuid) {
      return await supabase!
        .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
        .upsert(payloadToUse)
        .eq('user_id', userId)
        .select('*')
        .single();
    } else {
      return await supabase!
        .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
        .insert(payloadToUse)
        .select('*')
        .single();
    }
  };

  let { data, error } = await attemptSave(fullPayload);

  if (error && isMissingColumnError(error.message, error.code)) {
    const legacyPayload = mapProductionEntryToLegacySupabasePayload(entry, userId);
    const retryRes = await attemptSave(legacyPayload);
    data = retryRes.data;
    error = retryRes.error;
  }

  // Fallback to Supabase Auth user_metadata if `public.production_entries` table doesn't exist yet
  if (error && isMissingTableError(error.message, error.code)) {
    const existingList = await readEntriesFromSupabaseUserMetadata();
    const stampedEntry: ProductionEntry = {
      ...entry,
      userId,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    const exists = existingList.some((item) => item.id === stampedEntry.id);
    const updatedList = exists
      ? existingList.map((item) =>
          item.id === stampedEntry.id ? stampedEntry : item
        )
      : [stampedEntry, ...existingList];

    const ok = await writeEntriesToSupabaseUserMetadata(updatedList);
    return {
      savedEntry: stampedEntry,
      persistedToCloud: ok,
      missingTableSetup: true,
      errorBn: null,
    };
  }

  if (error || !data) {
    return {
      savedEntry: entry,
      persistedToCloud: false,
      errorBn: `সুপাবেস ডাটাবেসে সংরক্ষণ ব্যর্থ হয়েছে: ${
        error?.message || 'অজানা ত্রুটি'
      }`,
    };
  }

  return {
    savedEntry: mapSupabaseRowToProductionEntry(data as SupabaseProductionRow),
    persistedToCloud: true,
    missingTableSetup: false,
    errorBn: null,
  };
}

/**
 * Deletes a production entry from Supabase if authenticated.
 */
export async function deleteProductionEntryFromSupabase(
  id: string
): Promise<{ errorBn: string | null }> {
  if (!supabase) return { errorBn: null };

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { errorBn: null };

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    const { error } = await supabase
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error && !isMissingTableError(error.message, error.code)) {
      return { errorBn: `সুপাবেস থেকে মুছে ফেলতে ত্রুটি: ${error.message}` };
    }
  }

  // Also remove from Auth user_metadata fallback if present
  const existingMeta = await readEntriesFromSupabaseUserMetadata();
  if (existingMeta.some((e) => e.id === id)) {
    await writeEntriesToSupabaseUserMetadata(
      existingMeta.filter((e) => e.id !== id)
    );
  }

  return { errorBn: null };
}

/**
 * Batch inserts imported production entries with rollback capability via import_batch_id.
 */
export async function batchImportProductionEntriesToSupabase(
  entries: ProductionEntry[],
  batchId: string
): Promise<{
  importedEntries: ProductionEntry[];
  persistedToCloud: boolean;
  errorBn: string | null;
}> {
  const stamped = entries.map((e) => ({ ...e, importBatchId: batchId }));

  if (!supabase) {
    return {
      importedEntries: stamped,
      persistedToCloud: false,
      errorBn: null,
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) {
    return {
      importedEntries: stamped,
      persistedToCloud: false,
      errorBn: null,
    };
  }

  const payloads = stamped.map((e) => mapProductionEntryToSupabasePayload(e, userId));
  let { data, error } = await supabase
    .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
    .insert(payloads)
    .select('*');

  if (error && isMissingColumnError(error.message, error.code)) {
    const legacyPayloads = stamped.map((e) =>
      mapProductionEntryToLegacySupabasePayload(e, userId)
    );
    const retryRes = await supabase
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .insert(legacyPayloads)
      .select('*');
    data = retryRes.data;
    error = retryRes.error;
  }

  if (error && isMissingTableError(error.message, error.code)) {
    const existingList = await readEntriesFromSupabaseUserMetadata();
    const combined = [...stamped, ...existingList];
    const ok = await writeEntriesToSupabaseUserMetadata(combined);
    return {
      importedEntries: stamped,
      persistedToCloud: ok,
      errorBn: null,
    };
  }

  if (error) {
    await supabase
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .delete()
      .eq('import_batch_id', batchId)
      .eq('user_id', userId);

    return {
      importedEntries: [],
      persistedToCloud: false,
      errorBn: `ব্যাচ ইমপোর্ট ব্যর্থ হয়েছে এবং নিরাপদে রোলব্যাক করা হয়েছে: ${error.message}`,
    };
  }

  const mapped = ((data || []) as SupabaseProductionRow[]).map(
    mapSupabaseRowToProductionEntry
  );
  return {
    importedEntries: mapped,
    persistedToCloud: true,
    errorBn: null,
  };
}

/**
 * Rolls back a previously imported batch by batchId.
 */
export async function rollbackImportBatchFromSupabase(
  batchId: string
): Promise<{ errorBn: string | null }> {
  if (!supabase) return { errorBn: null };
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { errorBn: null };

  const { error } = await supabase
    .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
    .delete()
    .eq('import_batch_id', batchId)
    .eq('user_id', userId);

  if (error && isMissingTableError(error.message, error.code)) {
    const existingList = await readEntriesFromSupabaseUserMetadata();
    await writeEntriesToSupabaseUserMetadata(
      existingList.filter((e) => e.importBatchId !== batchId)
    );
    return { errorBn: null };
  }

  if (error) {
    return { errorBn: `রোলব্যাক ত্রুটি: ${error.message}` };
  }
  return { errorBn: null };
}

/**
 * Uploads a photo file to Supabase Storage bucket ('production-photos') if available.
 */
export async function uploadProductionPhotoToSupabase(
  file: File
): Promise<string | null> {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${userId}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKETS.PRODUCTION_PHOTOS)
    .upload(filePath, file, { upsert: false });

  if (error) return null;

  const { data } = supabase.storage
    .from(SUPABASE_STORAGE_BUCKETS.PRODUCTION_PHOTOS)
    .getPublicUrl(filePath);

  return data.publicUrl || null;
}
