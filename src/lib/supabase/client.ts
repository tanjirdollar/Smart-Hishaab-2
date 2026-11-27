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

function resolveEnvCredentialsPair(): { url: string; anonKey: string } {
  const env = import.meta.env as Record<string, string | undefined>;
  const viteUrl = (env.VITE_SUPABASE_URL || '').trim();
  const viteKey = (
    env.VITE_SUPABASE_ANON_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  if (viteUrl && viteKey) {
    return { url: viteUrl, anonKey: viteKey };
  }

  const nextUrl = (env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const nextKey = (
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  if (nextUrl && nextKey) {
    return { url: nextUrl, anonKey: nextKey };
  }

  return { url: '', anonKey: '' };
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
  const { url: envUrl, anonKey: envKey } = resolveEnvCredentialsPair();
  if (envUrl && envKey) {
    return {
      url: envUrl,
      anonKey: envKey,
      source: 'env',
    };
  }
  return { url: '', anonKey: '', source: 'none' };
}

function formatOAuthErrorMessage(
  errorCode: string | null,
  errorDesc: string | null
): string {
  const decodedDesc = errorDesc
    ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
    : '';

  if (errorCode === 'bad_oauth_state') {
    return 'পূর্বের লগইন সেশনের মেয়াদ শেষ হয়েছিল বা ডুপ্লিকেট রিডাইরেক্ট হয়েছিল (bad_oauth_state)। URL পরিষ্কার করা হয়েছে — অনুগ্রহ করে এখন আবার "Google দিয়ে লগইন করুন" বাটনে একবার চাপ দিন।';
  }

  return decodedDesc
    ? `Google OAuth ত্রুটি (${errorCode || 'error'}): ${decodedDesc}`
    : `Google OAuth ত্রুটি: ${errorCode}`;
}

let capturedInitialOAuthError: string | null = null;

/**
 * Sanitizes stale OAuth error query parameters BEFORE GoTrueClient initializes.
 * If the URL contains a valid `#access_token=` or `?code=` alongside stale `?error=` params,
 * stripping the stale `?error=` params prevents GoTrueClient._getSessionFromURL() from
 * rejecting the valid token.
 */
function sanitizeUrlBeforeSupabaseInit(): void {
  if (typeof window === 'undefined') return;
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const rawHash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(rawHash);

    const hasValidAuthPayload =
      hashParams.has('access_token') ||
      searchParams.has('access_token') ||
      searchParams.has('code');

    const searchErrorCode =
      searchParams.get('error_code') || searchParams.get('error');
    const searchErrorDesc = searchParams.get('error_description');
    const hashErrorCode =
      hashParams.get('error_code') || hashParams.get('error');
    const hashErrorDesc = hashParams.get('error_description');

    if (hasValidAuthPayload && (searchErrorCode || searchErrorDesc)) {
      searchParams.delete('error');
      searchParams.delete('error_code');
      searchParams.delete('error_description');
      const cleanSearch = searchParams.toString();
      const nextUrl =
        window.location.pathname +
        (cleanSearch ? `?${cleanSearch}` : '') +
        window.location.hash;
      window.history.replaceState({}, document.title, nextUrl);
      return;
    }

    const errorCode = searchErrorCode || hashErrorCode;
    const errorDesc = searchErrorDesc || hashErrorDesc;

    if (!hasValidAuthPayload && (errorCode || errorDesc)) {
      capturedInitialOAuthError = formatOAuthErrorMessage(errorCode, errorDesc);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch {
    // ignore URL parsing or history replace errors
  }
}

sanitizeUrlBeforeSupabaseInit();

function createSupabaseInstance(): SupabaseClient | null {
  const { url, anonKey } = resolveActiveCredentials();
  if (!url || !anonKey) return null;
  try {
    return createClient(url, anonKey, {
      auth: {
        flowType: 'pkce',
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
        'সুপাবেস সংযোগ সফলভাবে সক্রিয় হয়েছে! এখন Google বা Gmail কোড (OTP) দিয়ে লগইন করতে পারবেন।',
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
  USER_APP_STATE: 'user_app_state',
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
        ? `কাস্টম সুপাবেস সংযুক্ত (${url})`
        : `সুপাবেস ক্লাউড সক্রিয় (${url})`
      : 'সুপাবেস ডাটাবেস এখনও সংযুক্ত করা হয়নি (নিচে Project URL ও Key সেট করুন)',
  };
}

/**
 * Verifies live connectivity to the configured Supabase project and checks enabled Auth providers.
 */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  messageBn: string;
  googleEnabled?: boolean;
  emailEnabled?: boolean;
}> {
  const { url, anonKey } = resolveActiveCredentials();
  if (!url || !anonKey) {
    return {
      ok: false,
      messageBn: 'Supabase Project URL এবং Key সেট করা নেই।',
    };
  }

  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });
    if (!res.ok) {
      return {
        ok: false,
        messageBn: `সুপাবেস সংযোগ ব্যর্থ (HTTP ${res.status})। Project URL এবং Publishable/Anon Key সঠিক কিনা যাচাই করুন।`,
      };
    }
    const data = (await res.json()) as {
      external?: { google?: boolean; email?: boolean };
    };
    const googleEnabled = Boolean(data.external?.google);
    const emailEnabled = Boolean(data.external?.email);
    return {
      ok: true,
      googleEnabled,
      emailEnabled,
      messageBn: `সংযোগ সফল (${url}) — Google Auth: ${googleEnabled ? 'চালু' : 'বন্ধ'}, Email OTP: ${emailEnabled ? 'চালু' : 'বন্ধ'}।`,
    };
  } catch (err) {
    return {
      ok: false,
      messageBn: `নেটওয়ার্ক ত্রুটি: ${err instanceof Error ? err.message : 'সুপাবেসের সাথে সংযোগ করা যায়নি'}`,
    };
  }
}

/**
 * Checks if the current URL contains an OAuth error returned by Supabase or Google.
 */
export function getOAuthErrorFromUrl(): string | null {
  if (capturedInitialOAuthError) {
    const msg = capturedInitialOAuthError;
    capturedInitialOAuthError = null;
    return msg;
  }

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

  try {
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch {
    // ignore history replace errors
  }

  return formatOAuthErrorMessage(errorCode, errorDesc);
}

let isOAuthRedirectInFlight = false;

/**
 * Initiates Google OAuth login via Supabase Auth (PKCE flow).
 */
export async function signInWithGoogleSupabase(): Promise<{
  ok: boolean;
  messageBn: string;
}> {
  if (isOAuthRedirectInFlight) {
    return {
      ok: true,
      messageBn: 'Google লগইন পাতায় রিডাইরেক্ট করা হচ্ছে...',
    };
  }

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

  isOAuthRedirectInFlight = true;

  try {
    if (!isInsideIframe) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (error) {
        isOAuthRedirectInFlight = false;
        return {
          ok: false,
          messageBn: `Google লগইন ত্রুটি: ${error.message}। সুপাবেস ড্যাশবোর্ডে Authentication -> URL Configuration -> Redirect URLs-এ "${currentOrigin}" এবং "${currentOrigin}/**" যুক্ত আছে কিনা যাচাই করুন।`,
        };
      }

      setTimeout(() => {
        isOAuthRedirectInFlight = false;
      }, 4000);

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
      isOAuthRedirectInFlight = false;
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
      isOAuthRedirectInFlight = false;
      return {
        ok: true,
        messageBn:
          'Google লগইন পাতা নতুন ট্যাবে খোলা হয়েছে। লগইন সম্পন্ন করে এই ট্যাবে ফিরে আসুন।',
      };
    }

    isOAuthRedirectInFlight = false;
    return {
      ok: true,
      messageBn: 'Google লগইন পাতায় রিডাইরেক্ট করা হচ্ছে...',
    };
  } catch (err) {
    isOAuthRedirectInFlight = false;
    return {
      ok: false,
      messageBn: `Google লগইন ত্রুটি: ${err instanceof Error ? err.message : 'অজানা ত্রুটি'}`,
    };
  }
}

/**
 * Sends a 6-digit OTP / Magic Link to the user's email address via Supabase Auth.
 * Using the same Gmail address signs into the exact same Supabase user_id without losing existing data.
 */
export async function sendEmailOtpSupabase(email: string): Promise<{
  ok: boolean;
  messageBn: string;
}> {
  if (!supabase) {
    supabase = createSupabaseInstance();
  }
  if (!supabase) {
    return {
      ok: false,
      messageBn: 'সুপাবেস সংযুক্ত নেই। প্রথমে Project URL ও Key সেট করুন।',
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return {
      ok: false,
      messageBn: 'অনুগ্রহ করে আপনার সঠিক Gmail / ইমেইল ঠিকানা লিখুন।',
    };
  }

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const emailRedirectTo = currentOrigin ? `${currentOrigin}/` : undefined;

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo,
    },
  });

  if (error) {
    return {
      ok: false,
      messageBn: `ইমেইল লগইন কোড পাঠাতে ত্রুটি: ${error.message}`,
    };
  }

  return {
    ok: true,
    messageBn: `${cleanEmail} ঠিকানায় লগইন লিংক ও কোড পাঠানো হয়েছে। আপনার Gmail ইনবক্স (বা Spam) চেক করে লিংকে ক্লিক করুন অথবা নিচে কোডটি লিখুন।`,
  };
}

/**
 * Verifies the 6-digit Email OTP code entered by the user.
 */
export async function verifyEmailOtpSupabase(
  email: string,
  token: string
): Promise<{
  ok: boolean;
  messageBn: string;
}> {
  if (!supabase) {
    supabase = createSupabaseInstance();
  }
  if (!supabase) {
    return {
      ok: false,
      messageBn: 'সুপাবেস সংযুক্ত নেই।',
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim().replace(/\s+/g, '');

  if (!cleanEmail || cleanToken.length < 6) {
    return {
      ok: false,
      messageBn: 'ইমেইলে প্রাপ্ত ৬ সংখ্যার কোডটি সঠিকভাবে লিখুন।',
    };
  }

  const { error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: cleanToken,
    type: 'email',
  });

  if (error) {
    return {
      ok: false,
      messageBn: `কোড যাচাই ব্যর্থ: ${error.message}। সঠিক কোড দিন অথবা ইমেইলের সরাসরি লগইন লিংকে ক্লিক করুন।`,
    };
  }

  return {
    ok: true,
    messageBn: 'সফলভাবে লগইন সম্পন্ন হয়েছে! আপনার সুপাবেস ডেটা লোড হচ্ছে...',
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
