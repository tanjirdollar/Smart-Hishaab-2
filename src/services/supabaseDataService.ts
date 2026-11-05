import { supabase, SUPABASE_STORAGE_BUCKETS, SUPABASE_TABLES } from '../lib/supabase/client';
import {
  ProductionEntry,
  SettlementStatus,
  UploadedPhotoPreview,
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
 */

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

export function mapSupabaseRowToProductionEntry(
  row: SupabaseProductionRow
): ProductionEntry {
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

  const settlementStatus: SettlementStatus =
    row.settlement_status === 'settled' ? 'settled' : 'pending';
  const workStatus: WorkStatus =
    row.work_status === 'completed' ? 'completed' : 'in_progress';

  const receivedWage =
    row.received_wage !== null && row.received_wage !== undefined
      ? Number(row.received_wage)
      : settlementStatus === 'settled'
      ? totalWage
      : 0;

  const pendingWage =
    row.pending_wage !== null && row.pending_wage !== undefined
      ? Number(row.pending_wage)
      : Math.max(0, Number((totalWage - receivedWage).toFixed(2)));

  const itemName = row.item_name || row.garment_type || 'পোশাক আইটেম';
  const category = row.category || row.garment_type || 'সাধারণ ক্যাটাগরি';
  const sizes =
    Array.isArray(row.sizes) && row.sizes.length > 0
      ? row.sizes
      : row.size
      ? row.size
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : ['M'];
  const colors =
    Array.isArray(row.colors) && row.colors.length > 0
      ? row.colors
      : row.color
      ? row.color
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : ['সাদা (White)'];

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
    garmentType: `${itemName} (${category})`,
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
    startWorkTime: row.start_work_time ?? null,
    endWorkTime: row.end_work_time ?? null,
    workDurationMinutes:
      row.work_duration_minutes ??
      calculateDurationMinutes(row.start_work_time, row.end_work_time),
    shortDescription: row.short_description ?? '',
    photos,
    importBatchId: row.import_batch_id ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapProductionEntryToSupabasePayload(entry: ProductionEntry) {
  const isoDate =
    ddMmYyyyToIsoInput(entry.date) || new Date().toISOString().slice(0, 10);
  const photoUrls = entry.photos
    .map((p) => p.storagePath || p.previewUrl)
    .filter((u) => u && !u.startsWith('blob:'));

  const payload: Record<string, unknown> = {
    entry_date: isoDate,
    item_name: entry.itemName,
    category: entry.category,
    garment_type: entry.garmentType || entry.category || entry.itemName,
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

  // Preserve UUID if valid UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.id)) {
    payload.id = entry.id;
  }

  return payload;
}

/**
 * Fetches all production entries for the authenticated user in chronological order (newest first).
 */
export async function fetchProductionEntriesFromSupabase(): Promise<{
  entries: ProductionEntry[];
  errorBn: string | null;
}> {
  if (!supabase) {
    return { entries: [], errorBn: null };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) {
    return { entries: [], errorBn: null };
  }

  const { data, error } = await supabase
    .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    return {
      entries: [],
      errorBn: `সুপাবেস থেকে প্রোডাকশন তথ্য লোড করতে সমস্যা হয়েছে: ${error.message}`,
    };
  }

  const mapped = (data as SupabaseProductionRow[]).map(
    mapSupabaseRowToProductionEntry
  );
  return { entries: mapped, errorBn: null };
}

/**
 * Saves or updates a single production entry in Supabase if authenticated.
 */
export async function saveProductionEntryToSupabase(
  entry: ProductionEntry
): Promise<{ savedEntry: ProductionEntry; persistedToCloud: boolean; errorBn: string | null }> {
  if (!supabase) {
    return { savedEntry: entry, persistedToCloud: false, errorBn: null };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) {
    return { savedEntry: entry, persistedToCloud: false, errorBn: null };
  }

  const payload = mapProductionEntryToSupabasePayload(entry);
  const isExistingUuid = Boolean(payload.id);

  if (isExistingUuid) {
    const { data, error } = await supabase
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .upsert(payload)
      .select('*')
      .single();

    if (error) {
      return {
        savedEntry: entry,
        persistedToCloud: false,
        errorBn: `সুপাবেসে সংরক্ষণ ত্রুটি: ${error.message}`,
      };
    }
    return {
      savedEntry: mapSupabaseRowToProductionEntry(data as SupabaseProductionRow),
      persistedToCloud: true,
      errorBn: null,
    };
  } else {
    const { data, error } = await supabase
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return {
        savedEntry: entry,
        persistedToCloud: false,
        errorBn: `সুপাবেসে সংরক্ষণ ত্রুটি: ${error.message}`,
      };
    }
    return {
      savedEntry: mapSupabaseRowToProductionEntry(data as SupabaseProductionRow),
      persistedToCloud: true,
      errorBn: null,
    };
  }
}

/**
 * Deletes a production entry from Supabase if authenticated.
 */
export async function deleteProductionEntryFromSupabase(
  id: string
): Promise<{ errorBn: string | null }> {
  if (!supabase) return { errorBn: null };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { errorBn: null };
  }

  const { error } = await supabase
    .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
    .delete()
    .eq('id', id);

  if (error) {
    return { errorBn: `সুপাবেস থেকে মুছে ফেলতে ত্রুটি: ${error.message}` };
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
  if (!sessionData.session?.user) {
    return {
      importedEntries: stamped,
      persistedToCloud: false,
      errorBn: null,
    };
  }

  const payloads = stamped.map(mapProductionEntryToSupabasePayload);
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
    .insert(payloads)
    .select('*');

  if (error) {
    // Rollback any partial rows with this batchId
    await supabase
      .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
      .delete()
      .eq('import_batch_id', batchId);

    return {
      importedEntries: [],
      persistedToCloud: false,
      errorBn: `ব্যাচ ইমপোর্ট ব্যর্থ হয়েছে এবং নিরাপদে রোলব্যাক করা হয়েছে: ${error.message}`,
    };
  }

  const mapped = (data as SupabaseProductionRow[]).map(
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
  if (!sessionData.session?.user) return { errorBn: null };

  const { error } = await supabase
    .from(SUPABASE_TABLES.PRODUCTION_LEDGER)
    .delete()
    .eq('import_batch_id', batchId);

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
