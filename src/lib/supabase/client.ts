import { SupabaseConnectionState } from '../../types/models';

/**
 * Supabase Architecture Layer (Phase 1 Foundation)
 *
 * This module prepares the clean structure for Supabase Authentication (Google OAuth),
 * PostgreSQL Database tables, and Storage buckets ('production-photos').
 *
 * IMPORTANT: Does not fake cloud synchronization or use localStorage as a permanent database.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_TABLES = {
  OPERATOR_PROFILES: 'operator_profiles',
  PRODUCTION_LEDGER: 'production_entries',
  WAGE_LEDGER: 'wage_periods',
  PAYMENT_WITHDRAWALS: 'payment_withdrawals',
  LOAN_RECORDS: 'loan_records',
  FUND_ACCOUNTS: 'fund_accounts',
  INCOME_EXPENSE: 'income_expense_transactions',
} as const;

export const SUPABASE_STORAGE_BUCKETS = {
  PRODUCTION_PHOTOS: 'production-photos',
} as const;

export function getSupabaseConnectionState(): SupabaseConnectionState {
  const isConfigured = Boolean(
    supabaseUrl &&
      supabaseUrl.trim().length > 0 &&
      supabaseAnonKey &&
      supabaseAnonKey.trim().length > 0
  );

  return {
    isConfigured,
    projectUrl: isConfigured ? supabaseUrl! : null,
    authProvider: 'google',
    storageBucket: SUPABASE_STORAGE_BUCKETS.PRODUCTION_PHOTOS,
    statusMessageBn: isConfigured
      ? 'সুপাবেস ক্লাউড কনফিগারেশন সনাক্ত হয়েছে'
      : 'প্রথম ধাপ (UI ফাউন্ডেশন): সুপাবেস ডাটাবেস এখনও সংযুক্ত করা হয়নি',
  };
}

/**
 * Placeholder contract for Google OAuth sign-in via Supabase Auth.
 * Never implements insecure authentication shortcuts.
 */
export async function signInWithGoogleSupabase(): Promise<{
  ok: boolean;
  messageBn: string;
}> {
  const state = getSupabaseConnectionState();
  if (!state.isConfigured) {
    return {
      ok: false,
      messageBn:
        'সুপাবেস (Supabase) প্রজেক্ট URL এবং Anon Key এখনও কনফিগার করা হয়নি। পরবর্তী ধাপে সুপাবেস সংযুক্ত হলে Google একাউন্টের মাধ্যমে নিরাপদ লগইন কার্যকর হবে।',
    };
  }

  return {
    ok: true,
    messageBn: 'সুপাবেস Google OAuth রিডাইরেক্টের জন্য প্রস্তুত।',
  };
}
