import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { SupabaseConnectionState } from '../../types/models';

/**
 * Supabase Client & Google OAuth Authentication Layer
 */

const RUNTIME_SUPABASE_CONFIG_KEY = 'smart_hisab_supabase_runtime_config_v1';

interface RuntimeSupabaseConfig {
  url: string;
  anonKey: string;
}

function readEnvSupabaseUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return (
    env.VITE_SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    env.SUPABASE_URL ||
    ''
  ).trim();
}

function readEnvSupabaseKey(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return (
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
}

export function getRuntimeSupabaseConfig(): RuntimeSupabaseConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RUNTIME_SUPABASE_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RuntimeSupabaseConfig>;
    if (
      parsed &&
      typeof parsed.url === 'string' &&
      parsed.url.trim().startsWith('https://') &&
      typeof parsed.anonKey === 'string' &&
      parsed.anonKey.trim().length > 10
    ) {
      return {
        url: parsed.url.trim(),
        anonKey: parsed.anonKey.trim(),
      };
    }
  } catch {
    // ignore malformed localStorage
  }
  return null;
}

function resolveActiveCredentials(): {
  url: string;
  anonKey: string;
  source: 'env' | 'runtime' | 'none';
} {
  const runtimeCfg = getRuntimeSupabaseConfig();
  if (runtimeCfg) {
    return {
      url: runtimeCfg.url,
      anonKey: runtimeCfg.anonKey,
      source: 'runtime',
    };
  }
  const envUrl = readEnvSupabaseUrl();
  const envKey = readEnvSupabaseKey();
  if (envUrl && envKey) {
    return {
      url: envUrl,
      anonKey: envKey,
      source: 'env',
    };
  }
  return { url: '', anonKey: '', source: 'none' };
}

function createSupabaseInstance(): SupabaseClient | null {
  const { url, anonKey } = resolveActiveCredentials();
  if (!url || !anonKey) return null;
  try {
    return createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    return null;
  }
}

export let supabase: SupabaseClient | null = createSupabaseInstance();

export function configureRuntimeSupabase(
  url: string,
  anonKey: string
): { ok: boolean; messageBn: string } {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();

  if (!cleanUrl.startsWith('https://') || !cleanUrl.includes('.supabase.co')) {
    return {
      ok: false,
      messageBn:
        'সঠিক Supabase Project URL লিখুন (যেমন: https://xxxx.supabase.co)।',
    };
  }
  if (cleanKey.length < 15) {
    return {
      ok: false,
      messageBn: 'সঠিক Supabase Anon / Publishable Key প্রদান করুন।',
    };
  }

  try {
    localStorage.setItem(
      RUNTIME_SUPABASE_CONFIG_KEY,
      JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
    );
    supabase = createSupabaseInstance();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart-hisab-supabase-reconfigured'));
    }
    return {
      ok: true,
      messageBn:
        'সুপাবেস সংযোগ সফলভাবে সক্রিয় হয়েছে! এখন Google দিয়ে লগইন করতে পারবেন।',
    };
  } catch (err) {
    return {
      ok: false,
      messageBn: `সংরক্ষণে ত্রুটি: ${err instanceof Error ? err.message : 'অজানা ত্রুটি'}`,
    };
  }
}

export function clearRuntimeSupabaseConfig(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RUNTIME_SUPABASE_CONFIG_KEY);
    supabase = createSupabaseInstance();
    window.dispatchEvent(new CustomEvent('smart-hisab-supabase-reconfigured'));
  } catch {
    // ignore
  }
}

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
  const { url, source } = resolveActiveCredentials();
  const active = Boolean(supabase && url);
  return {
    isConfigured: active,
    projectUrl: active ? url : null,
    authProvider: 'google',
    storageBucket: SUPABASE_STORAGE_BUCKETS.PRODUCTION_PHOTOS,
    statusMessageBn: active
      ? source === 'runtime'
        ? `সুপাবেস ক্লাউড সংযুক্ত (${url})`
        : 'সুপাবেস ক্লাউড কনফিগারেশন সক্রিয় রয়েছে'
      : 'সুপাবেস ডাটাবেস এখনও সংযুক্ত করা হয়নি (নিচে Project URL ও Key সেট করুন)',
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

  // Clean the stale error parameters from the browser address bar immediately
  // so refreshing or retrying login starts from a clean URL without breaking Supabase Auth.
  try {
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch {
    // ignore history replace errors
  }

  const decodedDesc = errorDesc
    ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
    : '';

  if (errorCode === 'bad_oauth_state') {
    return 'পূর্বের লগইন সেশনের মেয়াদ শেষ হয়েছিল বা অন্য ডোমেইন থেকে রিডাইরেক্ট হয়েছিল (bad_oauth_state)। URL পরিষ্কার করা হয়েছে — অনুগ্রহ করে এখন আবার "Google দিয়ে লগইন করুন" বাটনে চাপ দিন।';
  }

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
    supabase = createSupabaseInstance();
  }

  if (!supabase) {
    return {
      ok: false,
      messageBn:
        'সুপাবেস (Supabase) প্রজেক্ট URL এবং Publishable/Anon Key এখনও কনফিগার করা হয়নি। নিচের বক্সে আপনার Supabase Project URL ও Anon Key দিয়ে সংরক্ষণ করুন অথবা Vercel Environment Variables সেট করুন।',
    };
  }

  if (
    typeof window !== 'undefined' &&
    (window.location.search.includes('error=') ||
      window.location.hash.includes('error='))
  ) {
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      // ignore
    }
  }

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const redirectTo = currentOrigin ? `${currentOrigin}/` : undefined;
  const isInsideIframe =
    typeof window !== 'undefined' && window.self !== window.top;

  if (!isInsideIframe) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (error) {
      return {
        ok: false,
        messageBn: `Google লগইন ত্রুটি: ${error.message}। সুপাবেস ড্যাশবোর্ডে Authentication -> URL Configuration -> Redirect URLs-এ "${currentOrigin}" এবং "${currentOrigin}/**" যুক্ত আছে কিনা যাচাই করুন।`,
      };
    }

    return {
      ok: true,
      messageBn: 'Google লগইন পাতায় রিডাইরেক্ট করা হচ্ছে...',
    };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return {
      ok: false,
      messageBn: `Google লগইন ত্রুটি: ${error.message}। সুপাবেস ড্যাশবোর্ডে Authentication -> URL Configuration -> Redirect URLs-এ "${currentOrigin}" এবং "${currentOrigin}/**" যুক্ত আছে কিনা যাচাই করুন।`,
    };
  }

  if (data?.url) {
    const cleanUrl = data.url
      .replace(/([?&])skip_http_redirect=true(&?)/, (_m, p1, p2) =>
        p1 === '?' && p2 === '&' ? '?' : p2 ? p1 : ''
      );
    const popup = window.open(cleanUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.location.assign(cleanUrl);
    }
    return {
      ok: true,
      messageBn:
        'Google লগইন পাতা নতুন ট্যাবে খোলা হয়েছে। লগইন সম্পন্ন করে এই ট্যাবে ফিরে আসুন।',
    };
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
