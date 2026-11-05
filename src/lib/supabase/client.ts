import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { SupabaseConnectionState } from '../../types/models';

/**
 * Supabase Client & Google OAuth Authentication Layer
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

const isConfigured = Boolean(
  supabaseUrl &&
    supabaseUrl.trim().length > 0 &&
    supabaseAnonKey &&
    supabaseAnonKey.trim().length > 0
);

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl!.trim(), supabaseAnonKey!.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

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
  return {
    isConfigured,
    projectUrl: isConfigured ? supabaseUrl!.trim() : null,
    authProvider: 'google',
    storageBucket: SUPABASE_STORAGE_BUCKETS.PRODUCTION_PHOTOS,
    statusMessageBn: isConfigured
      ? 'সুপাবেস ক্লাউড কনফিগারেশন সক্রিয় রয়েছে'
      : 'সুপাবেস ডাটাবেস এখনও সংযুক্ত করা হয়নি (VITE_SUPABASE_URL ও Key সেট করুন)',
  };
}

/**
 * Initiates Google OAuth login via Supabase Auth.
 */
export async function signInWithGoogleSupabase(): Promise<{
  ok: boolean;
  messageBn: string;
}> {
  if (!supabase) {
    return {
      ok: false,
      messageBn:
        'সুপাবেস (Supabase) প্রজেক্ট URL এবং Publishable/Anon Key এখনও কনফিগার করা হয়নি। Vercel-এ VITE_SUPABASE_URL এবং VITE_SUPABASE_PUBLISHABLE_KEY সেট করে Redeploy করুন।',
    };
  }

  const redirectTo = window.location.origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    return {
      ok: false,
      messageBn: `Google লগইন ত্রুটি: ${error.message}`,
    };
  }

  if (data?.url) {
    window.location.href = data.url;
  }

  return {
    ok: true,
    messageBn: 'Google লগইন পাতায় রিডাইরেক্ট করা হচ্ছে...',
  };
}

/**
 * Signs out the currently authenticated user.
 */
export async function signOutSupabase(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export type AuthenticatedUser = User;
