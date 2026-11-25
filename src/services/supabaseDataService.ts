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
  normalizeToDDMMYYYY,
  toAsciiDigits,
  toDateTimeLocalInputValue,
} from '../utils/formatters';

/**
 * Supabase Data Persistence Service
 *
 * Maps between the application's ProductionEntry model and the `public.production_entries`
 * table in Supabase, preserving historical rates, timestamps, and independent statuses.
 *
 * Includes automatic resilience layers:
 * 1. Legacy-column fallback (`PGRST204`): Works even if only Phase-1 columns exist.
 * 2. Dual Cloud Persistence (`public.production_entries` + Supabase Auth `user_metadata`):
 *    Reads from BOTH `public.production_entries` and `user_metadata` (`smart_hisab_production_entries_v1`)
 *    and merges them intelligently so manually added entries and edited records are never lost
 *    regardless of which layer stored them.
 */

const AUTH_METADATA_ENTRIES_KEY = 'smart_hisab_production_entries_v1';
const AUTH_METADATA_AUXILIARY_KEY = 'smart_hisab_auxiliary_modules_v1';
const AUTH_METADATA_TOMBSTONES_KEY = 'smart_hisab_deleted_tombstones_v2';
const LOCAL_DELETED_TOMBSTONES_KEY = 'smart_hisab_deleted_tombstones_v2';

export interface DeletedTombstones {
  ids: string[];
  signatures: string[];
}

export function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(id || '').trim()
  );
}

/**
 * Converts any legacy or backup ID (such as "TRX-178749989806673", "prod-bkp-1", "prod-173...")
 * into a canonical, deterministic UUID v4 string so Supabase always upserts/deletes in place.
 */
export function toDeterministicUuid(rawId: string): string {
  const clean = String(rawId || '').trim();
  if (!clean) {
    return '00000000-0000-4000-8000-000000000000';
  }
  if (isValidUuid(clean)) {
    return clean.toLowerCase();
  }

  const hash32 = (str: string, seed: number): number => {
    let h = (0x811c9dc5 ^ seed) >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  };

  const h1 = hash32(clean, 0x11111111).toString(16).padStart(8, '0');
  const h2 = hash32(clean, 0x22222222).toString(16).padStart(8, '0');
  const h3 = hash32(clean, 0x33333333).toString(16).padStart(8, '0');
  const h4 = hash32(clean, 0x44444444).toString(16).padStart(8, '0');

  const p1 = h1;
  const p2 = h2.slice(0, 4);
  const p3 = '4' + h2.slice(5, 8);
  const variantNibble = ((parseInt(h3[0], 16) & 0x3) | 0x8).toString(16);
  const p4 = variantNibble + h3.slice(1, 4);
  const p5 = h3.slice(4, 8) + h4;

  return `${p1}-${p2}-${p3}-${p4}-${p5}`.toLowerCase();
}

export function normalizeItemNameForSignature(rawItemName: string): string {
  return String(rawItemName || '')
    .replace(/\s*\((কটি|কর্টি|গোলগোলা|গোলগলা|শার্ট|প্যান্ট|অন্যান্য)\)\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getEntryDateItemSignature(
  entry: Pick<ProductionEntry, 'date' | 'itemName'>
): string {
  const normDate =
    normalizeToDDMMYYYY(entry.date) || String(entry.date || '').trim();
  const normItem = normalizeItemNameForSignature(entry.itemName);
  return `${normDate}|${normItem}`;
}

function cleanNoteForBackupComparison(rawNote?: string | null): string {
  if (!rawNote) return '';
  const cleaned = String(rawNote)
    .replace(/\[ট্যাগ:\s*[^\]]+\]/g, '')
    .replace(/^Done\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

export function getLocalDeletedTombstones(): DeletedTombstones {
  if (typeof window === 'undefined') {
    return { ids: [], signatures: [] };
  }
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_TOMBSTONES_KEY);
    if (!raw) return { ids: [], signatures: [] };
    const parsed = JSON.parse(raw) as Partial<DeletedTombstones>;
    return {
      ids: Array.isArray(parsed?.ids) ? parsed.ids : [],
      signatures: Array.isArray(parsed?.signatures) ? parsed.signatures : [],
    };
  } catch {
    return { ids: [], signatures: [] };
  }
}

export function saveLocalDeletedTombstones(tombstones: DeletedTombstones): void {
  if (typeof window === 'undefined') return;
  try {
    const deduped: DeletedTombstones = {
      ids: Array.from(new Set(tombstones.ids.filter(Boolean))),
      signatures: Array.from(new Set(tombstones.signatures.filter(Boolean))),
    };
    localStorage.setItem(LOCAL_DELETED_TOMBSTONES_KEY, JSON.stringify(deduped));
  } catch {
    // ignore storage errors
  }
}

export function markEntryDeletedInTombstones(
  entryOrId: string | ProductionEntry
): DeletedTombstones {
  const current = getLocalDeletedTombstones();
  const rawId = typeof entryOrId === 'string' ? entryOrId : entryOrId.id;
  const uuid = toDeterministicUuid(rawId);
  const nextIds = new Set([...current.ids, rawId, uuid]);
  const nextSigs = new Set(current.signatures);

  if (typeof entryOrId !== 'string' && entryOrId.date && entryOrId.itemName) {
    nextSigs.add(getEntryDateItemSignature(entryOrId));
  }

  const updated: DeletedTombstones = {
    ids: Array.from(nextIds),
    signatures: Array.from(nextSigs),
  };
  saveLocalDeletedTombstones(updated);
  return updated;
}

export function unmarkEntryDeletedInTombstones(
  entry: ProductionEntry
): DeletedTombstones {
  const current = getLocalDeletedTombstones();
  const rawId = entry.id;
  const uuid = toDeterministicUuid(rawId);
  const sig = getEntryDateItemSignature(entry);

  const updated: DeletedTombstones = {
    ids: current.ids.filter((id) => id !== rawId && id !== uuid),
    signatures: current.signatures.filter((s) => s !== sig),
  };
  saveLocalDeletedTombstones(updated);
  return updated;
}

export function isEntryDeletedByTombstone(
  entry: ProductionEntry,
  explicitTombstones?: DeletedTombstones
): boolean {
  const tombstones = explicitTombstones || getLocalDeletedTombstones();
  const uuid = toDeterministicUuid(entry.id);
  if (tombstones.ids.includes(entry.id) || tombstones.ids.includes(uuid)) {
    return true;
  }
  const sig = getEntryDateItemSignature(entry);
  if (sig !== '|' && tombstones.signatures.includes(sig)) {
    return true;
  }
  return false;
}

/**
 * Computes a numeric modification score comparing an entry against its original reference backup version:
 * - Score 0: Entry is an UNEDITED raw backup entry.
 * - Score 5..95: Entry is an EDITED version of a backup entry (higher score = more fields edited by user).
 * - Score 100: Entry is a MANUALLY CREATED entry outside the backup (or had its date/itemName edited).
 */
export function computeEntryModificationScore(
  entry: ProductionEntry,
  backupBySig: Map<string, ProductionEntry>,
  backupByUuid: Map<string, ProductionEntry>,
  hasReferenceBackup: boolean
): number {
  if (!hasReferenceBackup) {
    return 0;
  }

  const sig = getEntryDateItemSignature(entry);
  const uuid = toDeterministicUuid(entry.id);
  const bkp = backupByUuid.get(uuid) || backupBySig.get(sig);

  if (!bkp) {
    // Manually created entry outside the imported backup (or user changed Date / Item Name)
    return 100;
  }

  let score = 0;

  if (Math.round(entry.pieces ?? 0) !== Math.round(bkp.pieces ?? 0)) {
    score += 20;
  }
  if (
    Math.abs(Number(entry.ratePerDozen ?? 0) - Number(bkp.ratePerDozen ?? 0)) >
    0.01
  ) {
    score += 20;
  }
  if (
    Math.abs(Number(entry.totalWage ?? 0) - Number(bkp.totalWage ?? 0)) > 0.01
  ) {
    score += 20;
  }
  if (entry.settlementStatus !== bkp.settlementStatus) {
    score += 25;
  }
  if (entry.workStatus !== bkp.workStatus) {
    score += 25;
  }
  if (
    toDateTimeLocalInputValue(entry.startWorkTime) !==
    toDateTimeLocalInputValue(bkp.startWorkTime)
  ) {
    score += 15;
  }
  if (
    toDateTimeLocalInputValue(entry.endWorkTime) !==
    toDateTimeLocalInputValue(bkp.endWorkTime)
  ) {
    score += 15;
  }
  if (
    entry.workDurationMinutes !== null &&
    entry.workDurationMinutes !== undefined &&
    entry.workDurationMinutes !== bkp.workDurationMinutes
  ) {
    score += 10;
  }
  if (
    (entry.countdownDurationMinutes ?? null) !==
      (bkp.countdownDurationMinutes ?? null) ||
    (entry.deadlineAt ?? null) !== (bkp.deadlineAt ?? null)
  ) {
    score += 20;
  }
  if (
    cleanNoteForBackupComparison(entry.shortDescription) !==
    cleanNoteForBackupComparison(bkp.shortDescription)
  ) {
    score += 15;
  }
  if (
    toAsciiDigits(entry.size || '').replace(/\s+/g, '') !==
    toAsciiDigits(bkp.size || '').replace(/\s+/g, '')
  ) {
    score += 10;
  }
  if ((entry.color || '').trim() !== (bkp.color || '').trim()) {
    score += 10;
  }
  if (
    entry.category &&
    bkp.category &&
    entry.category.trim() !== bkp.category.trim()
  ) {
    score += 10;
  }
  if (
    normalizeItemNameForSignature(entry.itemName) !==
    normalizeItemNameForSignature(bkp.itemName)
  ) {
    score += 20;
  }
  if (
    (normalizeToDDMMYYYY(entry.date) || entry.date) !==
    (normalizeToDDMMYYYY(bkp.date) || bkp.date)
  ) {
    score += 20;
  }

  return score;
}

/**
 * Deduplicates production entries and removes any resurrected/deleted records or
 * unedited backup duplicates when an imported record was modified by the user,
 * while strictly preserving all manually added entries and user edits.
 */
export function deduplicateAndCleanProductionEntries(
  entries: ProductionEntry[],
  referenceBackupEntries: ProductionEntry[] = []
): {
  cleanedEntries: ProductionEntry[];
  obsoleteCloudIdsToDelete: string[];
} {
  const tombstones = getLocalDeletedTombstones();
  const obsoleteIds = new Set<string>();
  const hasReferenceBackup = referenceBackupEntries.length > 0;

  // Build lookup maps from the reference backup (if available)
  const backupBySig = new Map<string, ProductionEntry>();
  const backupByUuid = new Map<string, ProductionEntry>();
  const backupPhotosBySig = new Map<string, UploadedPhotoPreview[]>();
  const backupPhotosByUuid = new Map<string, UploadedPhotoPreview[]>();

  for (const bkp of referenceBackupEntries) {
    const sig = getEntryDateItemSignature(bkp);
    const bkpUuid = toDeterministicUuid(bkp.id);
    backupBySig.set(sig, bkp);
    backupByUuid.set(bkpUuid, bkp);
    if (bkp.photos && bkp.photos.length > 0) {
      backupPhotosBySig.set(sig, bkp.photos);
      backupPhotosByUuid.set(bkpUuid, bkp.photos);
    }
  }

  // Step 1: Filter out tombstoned (deleted) entries and normalize IDs & rehydrate backup photos
  const surviving: ProductionEntry[] = [];
  for (const item of entries) {
    if (!item || (!item.itemName && !item.garmentType && !item.pieces)) {
      continue;
    }
    if (isEntryDeletedByTombstone(item, tombstones)) {
      if (isValidUuid(item.id)) obsoleteIds.add(item.id.toLowerCase());
      obsoleteIds.add(toDeterministicUuid(item.id));
      continue;
    }
    const normalizedId = toDeterministicUuid(item.id);
    const sig = getEntryDateItemSignature(item);
    const restoredPhotos =
      item.photos && item.photos.length > 0
        ? item.photos
        : backupPhotosByUuid.get(normalizedId) ||
          backupPhotosBySig.get(sig) ||
          [];

    surviving.push({
      ...item,
      id: normalizedId,
      date: normalizeToDDMMYYYY(item.date) || item.date,
      photos: restoredPhotos,
    });
  }

  const getScore = (entry: ProductionEntry): number =>
    computeEntryModificationScore(
      entry,
      backupBySig,
      backupByUuid,
      hasReferenceBackup
    );

  // Step 2: Deduplicate by canonical UUID first (preferring higher modification score, then newer createdAt)
  const byUuid = new Map<string, ProductionEntry>();
  for (const entry of surviving) {
    const existing = byUuid.get(entry.id);
    if (!existing) {
      byUuid.set(entry.id, entry);
    } else {
      const existingScore = getScore(existing);
      const currentScore = getScore(entry);
      const tExisting = existing.createdAt
        ? new Date(existing.createdAt).getTime()
        : 0;
      const tCurrent = entry.createdAt
        ? new Date(entry.createdAt).getTime()
        : 0;

      const shouldPreferCurrent =
        currentScore > existingScore ||
        (currentScore === existingScore && tCurrent > tExisting);

      if (shouldPreferCurrent) {
        byUuid.set(entry.id, {
          ...entry,
          photos:
            entry.photos && entry.photos.length > 0
              ? entry.photos
              : existing.photos,
        });
      } else if (
        (!existing.photos || existing.photos.length === 0) &&
        entry.photos &&
        entry.photos.length > 0
      ) {
        byUuid.set(entry.id, {
          ...existing,
          photos: entry.photos,
        });
      }
    }
  }

  // Step 3: Group by normalized Date + ItemName signature
  const bySigGroups = new Map<string, ProductionEntry[]>();
  for (const entry of byUuid.values()) {
    const sig = getEntryDateItemSignature(entry);
    const list = bySigGroups.get(sig) || [];
    list.push(entry);
    bySigGroups.set(sig, list);
  }

  const finalEntries: ProductionEntry[] = [];
  for (const [sig, group] of bySigGroups.entries()) {
    if (group.length === 1) {
      finalEntries.push(group[0]);
      continue;
    }

    const isBackupSignature = backupBySig.has(sig);

    if (isBackupSignature) {
      // Multiple entries share the Date + ItemName of an imported backup record:
      // Always prefer the user-modified entry (score > 0) over the unedited backup clone (score === 0)!
      const sortedGroup = group.slice().sort((a, b) => {
        const scoreA = getScore(a);
        const scoreB = getScore(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });

      const winner = sortedGroup[0];
      const fallbackPhoto =
        sortedGroup.find((g) => g.photos && g.photos.length > 0)?.photos ||
        backupPhotosBySig.get(sig) ||
        [];
      finalEntries.push({
        ...winner,
        photos:
          winner.photos && winner.photos.length > 0
            ? winner.photos
            : fallbackPhoto,
      });

      for (let i = 1; i < sortedGroup.length; i++) {
        if (sortedGroup[i].id !== winner.id) {
          obsoleteIds.add(sortedGroup[i].id);
        }
      }
    } else {
      // Manual entries outside the backup that share the same Date + ItemName:
      // Only collapse if they have the exact same pieces, ratePerDozen, totalWage, size, and color.
      // Otherwise keep ALL of them so multiple manual batches on the same day are never lost!
      const uniqueManualByContent = new Map<string, ProductionEntry>();
      for (const item of group) {
        const contentKey = `${item.pieces ?? 0}|${Number(
          item.ratePerDozen ?? 0
        ).toFixed(2)}|${Number(item.totalWage ?? 0).toFixed(2)}|${toAsciiDigits(
          item.size || ''
        ).trim()}|${(item.color || '').trim()}|${(
          item.shortDescription || ''
        ).trim()}`;

        const existingManual = uniqueManualByContent.get(contentKey);
        if (!existingManual) {
          uniqueManualByContent.set(contentKey, item);
        } else {
          const tExisting = existingManual.createdAt
            ? new Date(existingManual.createdAt).getTime()
            : 0;
          const tCurrent = item.createdAt
            ? new Date(item.createdAt).getTime()
            : 0;
          if (tCurrent > tExisting) {
            obsoleteIds.add(existingManual.id);
            uniqueManualByContent.set(contentKey, {
              ...item,
              photos:
                item.photos && item.photos.length > 0
                  ? item.photos
                  : existingManual.photos,
            });
          } else if (item.id !== existingManual.id) {
            obsoleteIds.add(item.id);
          }
        }
      }
      for (const uniqueManual of uniqueManualByContent.values()) {
        finalEntries.push(uniqueManual);
      }
    }
  }

  // Sort newest date first
  finalEntries.sort((a, b) => {
    const [dA, mA, yA] = toAsciiDigits(String(a.date || ''))
      .split('-')
      .map(Number);
    const [dB, mB, yB] = toAsciiDigits(String(b.date || ''))
      .split('-')
      .map(Number);
    const tA = new Date(yA || 2026, (mA || 1) - 1, dA || 1).getTime();
    const tB = new Date(yB || 2026, (mB || 1) - 1, dB || 1).getTime();
    if (tB !== tA) return tB - tA;
    const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return cB - cA;
  });

  return {
    cleanedEntries: finalEntries,
    obsoleteCloudIdsToDelete: Array.from(obsoleteIds),
  };
}

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
  cdm?: number | null; // countdownDurationMinutes
  csa?: string | null; // countdownStartedAt
  dla?: string | null; // deadlineAt
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

  const rawItemName = row.item_name || meta?.in || row.garment_type || '';
  const itemName = normalizeItemNameForSignature(rawItemName) || rawItemName;
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
    ? row.photo_urls
        .filter(Boolean)
        .map((url, idx) => ({
          id: `db-photo-${row.id}-${idx}`,
          fileName: `ছবি-${idx + 1}`,
          fileSize: 0,
          previewUrl: url,
          mimeType: 'image/jpeg',
          storagePath: url.startsWith('data:') ? '' : url,
        }))
    : [];

  return {
    id: toDeterministicUuid(row.id),
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
    countdownDurationMinutes: meta?.cdm ?? null,
    countdownStartedAt: meta?.csa ?? null,
    deadlineAt: meta?.dla ?? null,
    shortDescription: cleanDescription,
    photos,
    importBatchId: row.import_batch_id ?? meta?.bid ?? undefined,
    createdAt: row.created_at,
  };
}

function safeIsoTimestampOrNull(raw?: string | null): string | null {
  if (!raw) return null;
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

export function mapProductionEntryToSupabasePayload(
  entry: ProductionEntry,
  userId: string
): Record<string, unknown> {
  const isoDate =
    ddMmYyyyToIsoInput(entry.date) || new Date().toISOString().slice(0, 10);
  const photoUrls = (entry.photos || [])
    .map((p) => p.storagePath || p.previewUrl)
    .filter((u) => u && !u.startsWith('blob:'));

  const hasCountdownMeta =
    (entry.countdownDurationMinutes !== null &&
      entry.countdownDurationMinutes !== undefined &&
      entry.countdownDurationMinutes > 0) ||
    Boolean(entry.deadlineAt);

  const descriptionForFullTable = hasCountdownMeta
    ? packDescriptionWithMeta(entry.shortDescription, {
        cdm: entry.countdownDurationMinutes ?? null,
        csa: safeIsoTimestampOrNull(entry.countdownStartedAt),
        dla: safeIsoTimestampOrNull(entry.deadlineAt),
      })
    : entry.shortDescription;

  const payload: Record<string, unknown> = {
    id: toDeterministicUuid(entry.id),
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
    start_work_time: safeIsoTimestampOrNull(entry.startWorkTime),
    end_work_time: safeIsoTimestampOrNull(entry.endWorkTime),
    work_duration_minutes: entry.workDurationMinutes,
    short_description: descriptionForFullTable,
    photo_urls: photoUrls,
    import_batch_id: entry.importBatchId ?? null,
  };

  return payload;
}

function mapProductionEntryToLegacySupabasePayload(
  entry: ProductionEntry,
  userId: string
): Record<string, unknown> {
  const isoDate =
    ddMmYyyyToIsoInput(entry.date) || new Date().toISOString().slice(0, 10);
  const photoUrls = (entry.photos || [])
    .map((p) => p.storagePath || p.previewUrl)
    .filter((u) => u && !u.startsWith('blob:'));

  const packedDescription = packDescriptionWithMeta(entry.shortDescription, {
    in: entry.itemName,
    cat: entry.category,
    sz: entry.sizes,
    cl: entry.colors,
    ws: entry.workStatus,
    ss: entry.settlementStatus,
    st: safeIsoTimestampOrNull(entry.startWorkTime),
    et: safeIsoTimestampOrNull(entry.endWorkTime),
    dur: entry.workDurationMinutes,
    cdm: entry.countdownDurationMinutes ?? null,
    csa: safeIsoTimestampOrNull(entry.countdownStartedAt),
    dla: safeIsoTimestampOrNull(entry.deadlineAt),
    rw: entry.receivedWage,
    pw: entry.pendingWage,
    bid: entry.importBatchId,
  });

  const payload: Record<string, unknown> = {
    id: toDeterministicUuid(entry.id),
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
  const metadata = data.user?.user_metadata;
  if (metadata?.[AUTH_METADATA_TOMBSTONES_KEY]) {
    const cloudTombstones = metadata[
      AUTH_METADATA_TOMBSTONES_KEY
    ] as Partial<DeletedTombstones>;
    const localTombstones = getLocalDeletedTombstones();
    saveLocalDeletedTombstones({
      ids: [
        ...localTombstones.ids,
        ...(Array.isArray(cloudTombstones.ids) ? cloudTombstones.ids : []),
      ],
      signatures: [
        ...localTombstones.signatures,
        ...(Array.isArray(cloudTombstones.signatures)
          ? cloudTombstones.signatures
          : []),
      ],
    });
  }
  const raw = metadata?.[AUTH_METADATA_AUXILIARY_KEY];
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
      [AUTH_METADATA_TOMBSTONES_KEY]: getLocalDeletedTombstones(),
    },
  });
  return !error;
}

/**
 * Reads production entries stored in Supabase Auth `user_metadata`.
 */
export async function readEntriesFromSupabaseUserMetadata(): Promise<ProductionEntry[]> {
  if (!supabase) return [];
  const { data } = await supabase.auth.getUser();
  const metadata = data.user?.user_metadata;
  if (metadata?.[AUTH_METADATA_TOMBSTONES_KEY]) {
    const cloudTombstones = metadata[
      AUTH_METADATA_TOMBSTONES_KEY
    ] as Partial<DeletedTombstones>;
    const localTombstones = getLocalDeletedTombstones();
    saveLocalDeletedTombstones({
      ids: [
        ...localTombstones.ids,
        ...(Array.isArray(cloudTombstones.ids) ? cloudTombstones.ids : []),
      ],
      signatures: [
        ...localTombstones.signatures,
        ...(Array.isArray(cloudTombstones.signatures)
          ? cloudTombstones.signatures
          : []),
      ],
    });
  }
  const rawList = metadata?.[AUTH_METADATA_ENTRIES_KEY];
  if (!Array.isArray(rawList)) return [];
  const tombstones = getLocalDeletedTombstones();
  return (rawList as ProductionEntry[])
    .filter((e) => e && !isEntryDeletedByTombstone(e, tombstones))
    .map((e) => ({
      ...e,
      id: toDeterministicUuid(e.id),
      date: normalizeToDDMMYYYY(e.date) || e.date,
    }));
}

/**
 * Writes production entries into Supabase Auth `user_metadata` as a durable cloud mirror.
 */
export async function writeEntriesToSupabaseUserMetadata(
  entries: ProductionEntry[],
  referenceBackupEntries: ProductionEntry[] = []
): Promise<boolean> {
  if (!supabase) return false;
  const tombstones = getLocalDeletedTombstones();
  const { cleanedEntries } = deduplicateAndCleanProductionEntries(
    entries,
    referenceBackupEntries
  );
  // Strip blob and large base64 data URLs before saving in user_metadata to stay well within JWT metadata limits
  const sanitized = cleanedEntries
    .filter((e) => !isEntryDeletedByTombstone(e, tombstones))
    .slice(0, 150)
    .map((e) => ({
      ...e,
      id: toDeterministicUuid(e.id),
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
      [AUTH_METADATA_TOMBSTONES_KEY]: tombstones,
    },
  });
  return !error;
}

/**
 * Fetches all production entries for the authenticated user in chronological order (newest first),
 * ALWAYS merging rows from `public.production_entries` AND `user_metadata` (`smart_hisab_production_entries_v1`)
 * so no manual entry or edited entry ever gets stranded in either storage layer.
 */
export async function fetchProductionEntriesFromSupabase(
  explicitUserId?: string,
  referenceBackupEntries: ProductionEntry[] = []
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

  // Always read user_metadata entries in parallel with SQL table query so any manual or edited
  // entries stored in user_metadata are ALWAYS recovered and merged!
  const [tableRes, metadataEntries] = await Promise.all([
    supabase
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false }),
    readEntriesFromSupabaseUserMetadata(),
  ]);

  const { data, error } = tableRes;

  if (error) {
    if (isMissingTableError(error.message, error.code)) {
      const { cleanedEntries } = deduplicateAndCleanProductionEntries(
        metadataEntries,
        referenceBackupEntries
      );
      return {
        entries: cleanedEntries,
        missingTableSetup: true,
        errorBn: null,
      };
    }

    if (metadataEntries.length > 0) {
      const { cleanedEntries } = deduplicateAndCleanProductionEntries(
        metadataEntries,
        referenceBackupEntries
      );
      return {
        entries: cleanedEntries,
        missingTableSetup: false,
        errorBn: null,
      };
    }

    return {
      entries: [],
      errorBn: `সুপাবেস থেকে প্রোডাকশন তথ্য লোড করতে সমস্যা হয়েছে: ${error.message}`,
    };
  }

  const mappedFromSql = ((data || []) as SupabaseProductionRow[]).map(
    mapSupabaseRowToProductionEntry
  );

  // Combine both SQL table rows and Auth user_metadata entries, then deduplicate (preferring edited & manual entries)
  const combinedCloud = [...mappedFromSql, ...metadataEntries];
  const { cleanedEntries, obsoleteCloudIdsToDelete } =
    deduplicateAndCleanProductionEntries(combinedCloud, referenceBackupEntries);

  // Delete obsolete duplicate or tombstoned UUIDs from SQL table
  if (obsoleteCloudIdsToDelete.length > 0) {
    const validUuids = obsoleteCloudIdsToDelete.filter(isValidUuid);
    if (validUuids.length > 0) {
      void supabase
        .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
        .delete()
        .in('id', validUuids)
        .eq('user_id', userId);
    }
  }

  // If metadataEntries had manual or edited entries that were missing or outdated in SQL table, batch-sync them into SQL table
  const sqlById = new Map<string, ProductionEntry>();
  for (const rowEntry of mappedFromSql) {
    sqlById.set(rowEntry.id, rowEntry);
  }

  const entriesToSyncToSql: ProductionEntry[] = [];
  for (const winner of cleanedEntries) {
    const inSql = sqlById.get(winner.id);
    if (
      !inSql ||
      inSql.pieces !== winner.pieces ||
      Number(inSql.ratePerDozen ?? 0) !== Number(winner.ratePerDozen ?? 0) ||
      Number(inSql.totalWage ?? 0) !== Number(winner.totalWage ?? 0) ||
      inSql.settlementStatus !== winner.settlementStatus ||
      inSql.workStatus !== winner.workStatus ||
      (inSql.countdownDurationMinutes ?? null) !==
        (winner.countdownDurationMinutes ?? null) ||
      (inSql.deadlineAt ?? null) !== (winner.deadlineAt ?? null) ||
      (inSql.shortDescription || '').trim() !==
        (winner.shortDescription || '').trim()
    ) {
      entriesToSyncToSql.push(winner);
    }
  }

  if (entriesToSyncToSql.length > 0) {
    const payloads = entriesToSyncToSql.map((e) =>
      mapProductionEntryToSupabasePayload(e, userId!)
    );
    void supabase
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .upsert(payloads, { onConflict: 'id' });
  }

  return { entries: cleanedEntries, missingTableSetup: false, errorBn: null };
}

/**
 * Saves or updates a single production entry in Supabase (`public.production_entries` + `user_metadata` mirror).
 * Always normalizes IDs to deterministic UUIDs and uses upsert so editing an imported record
 * updates it in-place without ever creating a duplicate.
 */
export async function saveProductionEntryToSupabase(
  entry: ProductionEntry,
  previousSnapshot?: ProductionEntry
): Promise<{
  savedEntry: ProductionEntry;
  persistedToCloud: boolean;
  missingTableSetup?: boolean;
  errorBn: string | null;
}> {
  const canonicalId = toDeterministicUuid(entry.id);
  const nowIso = new Date().toISOString();
  const normalizedEntry: ProductionEntry = {
    ...entry,
    id: canonicalId,
    date: normalizeToDDMMYYYY(entry.date) || entry.date,
    createdAt: nowIso,
  };

  // Ensure saving/editing unmarks any previous deletion tombstone for this record
  unmarkEntryDeletedInTombstones(normalizedEntry);

  if (!supabase) {
    return {
      savedEntry: normalizedEntry,
      persistedToCloud: false,
      errorBn: null,
    };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;

  if (!userId) {
    return {
      savedEntry: normalizedEntry,
      persistedToCloud: false,
      errorBn: null,
    };
  }

  const updateMetadataMirror = async (entryToMirror: ProductionEntry) => {
    try {
      const existingList = await readEntriesFromSupabaseUserMetadata();
      const sig = getEntryDateItemSignature(entryToMirror);
      const oldSig = previousSnapshot
        ? getEntryDateItemSignature(previousSnapshot)
        : null;
      const filtered = existingList.filter(
        (item) =>
          toDeterministicUuid(item.id) !== canonicalId &&
          getEntryDateItemSignature(item) !== sig &&
          (!oldSig || getEntryDateItemSignature(item) !== oldSig)
      );
      await writeEntriesToSupabaseUserMetadata([entryToMirror, ...filtered]);
    } catch {
      // ignore metadata mirror errors
    }
  };

  const fullPayload = mapProductionEntryToSupabasePayload(normalizedEntry, userId);

  const attemptSave = async (payloadToUse: Record<string, unknown>) => {
    return await supabase!
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .upsert(payloadToUse, { onConflict: 'id' })
      .select('*')
      .single();
  };

  let { data, error } = await attemptSave(fullPayload);

  if (error && isMissingColumnError(error.message, error.code)) {
    const legacyPayload = mapProductionEntryToLegacySupabasePayload(
      normalizedEntry,
      userId
    );
    const retryRes = await attemptSave(legacyPayload);
    data = retryRes.data;
    error = retryRes.error;
  }

  // Fallback to Supabase Auth user_metadata if `public.production_entries` table doesn't exist yet
  if (error && isMissingTableError(error.message, error.code)) {
    const stampedEntry: ProductionEntry = {
      ...normalizedEntry,
      userId,
    };
    await updateMetadataMirror(stampedEntry);
    return {
      savedEntry: stampedEntry,
      persistedToCloud: true,
      missingTableSetup: true,
      errorBn: null,
    };
  }

  if (error || !data) {
    await updateMetadataMirror(normalizedEntry);
    return {
      savedEntry: normalizedEntry,
      persistedToCloud: false,
      errorBn: `সুপাবেস ডাটাবেসে সংরক্ষণ ব্যর্থ হয়েছে: ${
        error?.message || 'অজানা ত্রুটি'
      }`,
    };
  }

  // Clean up any legacy duplicate row in `public.production_entries` for the same date + item_name that had a different random UUID
  const isoDate = ddMmYyyyToIsoInput(normalizedEntry.date);
  if (isoDate && normalizedEntry.itemName) {
    await supabase
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .delete()
      .eq('user_id', userId)
      .eq('entry_date', isoDate)
      .eq('item_name', normalizedEntry.itemName)
      .neq('id', canonicalId);
  }
  if (
    previousSnapshot &&
    previousSnapshot.date &&
    previousSnapshot.itemName &&
    (previousSnapshot.date !== normalizedEntry.date ||
      previousSnapshot.itemName !== normalizedEntry.itemName)
  ) {
    const oldIsoDate = ddMmYyyyToIsoInput(previousSnapshot.date);
    if (oldIsoDate) {
      await supabase
        .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
        .delete()
        .eq('user_id', userId)
        .eq('entry_date', oldIsoDate)
        .eq('item_name', previousSnapshot.itemName)
        .neq('id', canonicalId);
    }
  }

  const mappedSaved = mapSupabaseRowToProductionEntry(data as SupabaseProductionRow);
  const finalSaved: ProductionEntry = {
    ...mappedSaved,
    createdAt: mappedSaved.createdAt || nowIso,
    photos:
      mappedSaved.photos && mappedSaved.photos.length > 0
        ? mappedSaved.photos
        : normalizedEntry.photos,
  };

  void updateMetadataMirror(finalSaved);

  return {
    savedEntry: finalSaved,
    persistedToCloud: true,
    missingTableSetup: false,
    errorBn: null,
  };
}

/**
 * Deletes a production entry permanently from local tombstones, Supabase SQL table, and Auth metadata mirror.
 */
export async function deleteProductionEntryFromSupabase(
  id: string,
  entrySnapshot?: ProductionEntry
): Promise<{ errorBn: string | null }> {
  const canonicalId = toDeterministicUuid(id);
  markEntryDeletedInTombstones(entrySnapshot || id);

  if (!supabase) return { errorBn: null };

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { errorBn: null };

  const idsToDelete = Array.from(
    new Set([id, canonicalId].filter(isValidUuid))
  );

  if (idsToDelete.length > 0) {
    const { error } = await supabase
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .delete()
      .in('id', idsToDelete)
      .eq('user_id', userId);

    if (error && !isMissingTableError(error.message, error.code)) {
      return { errorBn: `সুপাবেস থেকে মুছে ফেলতে ত্রুটি: ${error.message}` };
    }
  }

  if (entrySnapshot && entrySnapshot.date && entrySnapshot.itemName) {
    const isoDate = ddMmYyyyToIsoInput(entrySnapshot.date);
    if (isoDate) {
      await supabase
        .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
        .delete()
        .eq('user_id', userId)
        .eq('entry_date', isoDate)
        .eq('item_name', entrySnapshot.itemName);
    }
  }

  const existingMeta = await readEntriesFromSupabaseUserMetadata();
  const targetSig = entrySnapshot
    ? getEntryDateItemSignature(entrySnapshot)
    : null;
  const filteredMeta = existingMeta.filter(
    (e) =>
      e.id !== id &&
      toDeterministicUuid(e.id) !== canonicalId &&
      (!targetSig || getEntryDateItemSignature(e) !== targetSig)
  );
  await writeEntriesToSupabaseUserMetadata(filteredMeta);

  return { errorBn: null };
}

/**
 * Batch inserts/upserts imported production entries with rollback capability via import_batch_id.
 */
export async function batchImportProductionEntriesToSupabase(
  entries: ProductionEntry[],
  batchId: string
): Promise<{
  importedEntries: ProductionEntry[];
  persistedToCloud: boolean;
  errorBn: string | null;
}> {
  const tombstones = getLocalDeletedTombstones();
  const stamped = entries
    .filter((e) => !isEntryDeletedByTombstone(e, tombstones))
    .map((e) => ({
      ...e,
      id: toDeterministicUuid(e.id),
      date: normalizeToDDMMYYYY(e.date) || e.date,
      importBatchId: batchId,
    }));

  if (stamped.length === 0) {
    return {
      importedEntries: [],
      persistedToCloud: true,
      errorBn: null,
    };
  }

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
    .upsert(payloads, { onConflict: 'id' })
    .select('*');

  if (error && isMissingColumnError(error.message, error.code)) {
    const legacyPayloads = stamped.map((e) =>
      mapProductionEntryToLegacySupabasePayload(e, userId)
    );
    const retryRes = await supabase
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .upsert(legacyPayloads, { onConflict: 'id' })
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
