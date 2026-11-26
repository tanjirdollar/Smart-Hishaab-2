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
 * Checks if the current URL contains an OAuth error returned by Supabase or Google.
 */
export function getOAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash
  );

  const errorCode =
    searchParams.get('error_code') ||
    hashParams.get('error_code') ||
    searchParams.get('error') ||
    hashParams.get('error');
  const errorDesc =
    searchParams.get('error_description') ||
    hashParams.get('error_description');

  if (!errorCode && !errorDesc) return null;
  const decodedDesc = errorDesc
    ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
    : '';
  return decodedDesc
    ? `Google OAuth ত্রুটি (${errorCode || 'error'}): ${decodedDesc}`
    : `Google OAuth ত্রুটি: ${errorCode}`;
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
        'সুপাবেস (Supabase) প্রজেক্ট URL এবং Publishable/Anon Key এখনও কনফিগার করা হয়নি। Vercel-এ VITE_SUPABASE_URL এবং VITE_SUPABASE_ANON_KEY (অথবা VITE_SUPABASE_PUBLISHABLE_KEY) সেট করে Redeploy করুন।',
    };
  }

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const redirectTo = currentOrigin ? `${currentOrigin}/` : undefined;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    return {
      ok: false,
      messageBn: `Google লগইন ত্রুটি: ${error.message}। সুপাবেস ড্যাশবোর্ডে Authentication -> URL Configuration -> Redirect URLs-এ "${currentOrigin}/**" যুক্ত আছে কিনা যাচাই করুন।`,
    };
  }

  if (data?.url) {
    const isInsideIframe =
      typeof window !== 'undefined' && window.self !== window.top;
    if (isInsideIframe) {
      window.open(data.url, '_blank');
      return {
        ok: true,
        messageBn:
          'Google লগইন পাতা নতুন উইন্ডো/ট্যাবে খোলা হয়েছে। লগইন সম্পন্ন করে এখানে ফিরে আসুন।',
      };
    } else {
      window.location.href = data.url;
    }
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
