import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2, Share } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'button' | 'badge' | 'compact';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'button',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If already running inside standalone PWA mode, don't show install button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleClick}
          title="ফোনে অ্যাপ হিসেবে ইনস্টল করুন"
          className={`p-2 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 hover:bg-teal-100 transition-colors cursor-pointer flex items-center justify-center shrink-0 ${className}`}
        >
          <Download className="w-4 h-4 text-teal-700 dark:text-teal-300" />
        </button>
      ) : variant === 'badge' ? (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-700 hover:bg-teal-800 text-white shadow-2xs transition-colors cursor-pointer ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>অ্যাপ ইনস্টল</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span>ফোনে অ্যাপ ইনস্টল</span>
        </button>
      )}

      {/* Guided Install Modal for Android / Chrome / iOS */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    ফোনে অ্যাপ ইনস্টল করুন
                  </h3>
                  <p className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold">
                    স্মার্ট হিসাব (Smart Hisab PWA)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p className="leading-relaxed">
                আপনার মোবাইল ফোনের হোম স্ক্রিনে এই অ্যাপ্লিকেশনটি সম্পূর্ণ আলাদা অ্যাপের মতো যুক্ত করতে পারেন:
              </p>

              {isIOS ? (
                /* iOS Safari instructions */
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      ১
                    </span>
                    <p>
                      সাফারি (Safari) ব্রাউজারের নিচের <Share className="w-3.5 h-3.5 inline mx-1 text-sky-600" /> <strong>Share</strong> বাটনে ট্যাপ করুন।
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      ২
                    </span>
                    <p>
                      নিচে স্ক্রল করে <strong>&quot;Add to Home Screen&quot; (হোম স্ক্রিনে যোগ করুন)</strong> নির্বাচন করুন।
                    </p>
                  </div>
                </div>
              ) : (
                /* Android / Chrome instructions */
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      ১
                    </span>
                    <p>
                      ব্রাউজারের উপরের ডানদিকের <strong>তিনটি ডট (⋮)</strong> মেন্যুতে চাপ দিন।
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      ২
                    </span>
                    <p>
                      <strong>&quot;Install app&quot;</strong> বা <strong>&quot;Add to Home screen&quot;</strong> বাটনে ট্যাপ করুন।
                    </p>
                  </div>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-[11px] text-teal-900 dark:text-teal-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>ইনস্টল করার পর ইন্টারনেট ছাড়াই অফলাইনে কাজ করবে!</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              ঠিক আছে, বুঝেছি
            </button>
          </div>
        </div>
      )}
    </>
  );
};
