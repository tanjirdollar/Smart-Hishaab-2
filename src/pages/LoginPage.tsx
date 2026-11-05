import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  LogOut,
  Scissors,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  AuthenticatedUser,
  getSupabaseConnectionState,
  signInWithGoogleSupabase,
  signOutSupabase,
} from '../lib/supabase/client';

export interface LoginPageProps {
  currentUser: AuthenticatedUser | null;
  onReturnToWorkspace: () => void;
}

/**
 * Login Page Design for Smart Hisab (স্মার্ট হিসাব)
 */
export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  onReturnToWorkspace,
}) => {
  const [authNoticeBn, setAuthNoticeBn] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const supabaseState = getSupabaseConnectionState();

  const handleGoogleLoginClick = async () => {
    setIsCheckingAuth(true);
    setAuthNoticeBn(null);
    try {
      const response = await signInWithGoogleSupabase();
      setIsError(!response.ok);
      setAuthNoticeBn(response.messageBn);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleSignOutClick = async () => {
    setIsCheckingAuth(true);
    try {
      await signOutSupabase();
      setIsError(false);
      setAuthNoticeBn('আপনি সফলভাবে লগআউট করেছেন।');
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const userDisplayName =
    (currentUser?.user_metadata?.full_name as string | undefined) ||
    (currentUser?.user_metadata?.name as string | undefined) ||
    currentUser?.email ||
    'অপারেটর একাউন্ট';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Bar to return to application workspace layout */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onReturnToWorkspace}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ড্যাশবোর্ড ও অ্যাপ্লিকেশন লেআউটে ফিরে যান</span>
        </button>

        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          সুপাবেস Google OAuth
        </span>
      </div>

      {/* Main Login Card */}
      <main className="my-8 max-w-md w-full mx-auto">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
          {/* App Logo & Name */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <Scissors className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                স্মার্ট হিসাব
              </h1>
              <p className="text-xs font-mono text-teal-700 dark:text-teal-400 mt-0.5">
                Smart Hisab · প্রোডাকশন ও ব্যক্তিগত অর্থ ব্যবস্থাপনা
              </p>
            </div>
          </div>

          {currentUser ? (
            /* Authenticated State */
            <div className="space-y-4">
              <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 p-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
                  <UserCheck className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  লগইন সক্রিয়: {userDisplayName}
                </p>
                {currentUser.email && (
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {currentUser.email}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onReturnToWorkspace}
                className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>ড্যাশবোর্ডে প্রবেশ করুন</span>
              </button>

              <button
                type="button"
                onClick={handleSignOutClick}
                disabled={isCheckingAuth}
                className="w-full min-h-[44px] px-5 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-900/70 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>লগআউট করুন</span>
              </button>
            </div>
          ) : (
            /* Unauthenticated State */
            <>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 p-4 text-center space-y-1.5">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  স্বাগতম! আপনার প্রোডাকশন ও আয়ের বিশ্বস্ত ডিজিটাল খতিয়ান
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  বাংলাদেশের গার্মেন্টস সুইং মেশিন অপারেটরদের প্রতিদিনের সেলাইয়ের ডজন-পিস হিসাব, কোম্পানির বকেয়া মজুরি, ঋণ এবং ব্যক্তিগত সঞ্চয় নিরাপদে সংরক্ষণের জন্য আপনার Google একাউন্ট দিয়ে লগইন করুন।
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleLoginClick}
                  disabled={isCheckingAuth}
                  className="w-full min-h-[48px] px-5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm sm:text-base font-semibold flex items-center justify-center gap-3 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                    />
                  </svg>
                  <span>
                    {isCheckingAuth
                      ? 'Google এর সাথে সংযোগ হচ্ছে...'
                      : 'Google দিয়ে লগইন করুন'}
                  </span>
                </button>
              </div>
            </>
          )}

          {authNoticeBn && (
            <div
              className={`rounded-xl border p-3.5 text-xs leading-relaxed ${
                isError
                  ? 'border-amber-200 dark:border-amber-900/70 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                  : 'border-teal-200 dark:border-teal-800 bg-teal-50/80 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200'
              }`}
            >
              {authNoticeBn}
            </div>
          )}

          {/* Security & Architecture Guarantees */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
              <span>নিরাপদ Supabase Google OAuth 2.0 অথেনটিকেশন</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
              <span>{supabaseState.statusMessageBn}</span>
            </div>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="text-center text-xs text-slate-500 dark:text-slate-400 py-2">
        স্মার্ট হিসাব (Smart Hisab) · বাংলাদেশী গার্মেন্টস অপারেটরদের জন্য নির্মিত · মুদ্রা: ৳ · তারিখ: DD-MM-YYYY
      </footer>
    </div>
  );
};
