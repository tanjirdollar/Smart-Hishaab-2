import React from 'react';
import { Moon, Scissors, Sun, UserCheck } from 'lucide-react';
import { NAVIGATION_ITEMS } from '../../config/navigation';
import { ModuleId, ThemeMode } from '../../types/models';

export interface TopBarProps {
  activeModule: ModuleId;
  onSelectModule: (module: ModuleId) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenLoginView: () => void;
}

/**
 * Follows the strict 1-row, 3-zone Top Bar Contract:
 * Zone 1: Single-line Brand / Breadcrumb wordmark
 * Zone 2: 4 concise single-line navigation links on desktop
 * Zone 3: Theme switch + Primary Login/Account action
 */
export const TopBar: React.FC<TopBarProps> = ({
  activeModule,
  onSelectModule,
  theme,
  onToggleTheme,
  onOpenLoginView,
}) => {
  const currentNav =
    NAVIGATION_ITEMS.find((item) => item.id === activeModule) ?? NAVIGATION_ITEMS[0];

  const quickLinks = [
    NAVIGATION_ITEMS[0], // ড্যাশবোর্ড
    NAVIGATION_ITEMS[1], // প্রোডাকশন হিসাব
    NAVIGATION_ITEMS[2], // মজুরি ও পাওনা
    NAVIGATION_ITEMS[6], // আয়-ব্যয়
  ];

  return (
    <header className="sticky top-0 z-30 h-14 sm:h-16 px-4 sm:px-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-8">
      {/* Zone 1: Brand / Active Page Wordmark (Single line, whitespace-nowrap) */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        <div className="lg:hidden w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
          <Scissors className="w-4 h-4" />
        </div>
        <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap truncate">
          স্মার্ট হিসাব · {currentNav.labelBn}
        </span>
      </div>

      {/* Zone 2: 4 concise single-line navigation links on desktop */}
      <nav
        aria-label="দ্রুত নেভিগেশন লিংক"
        className="hidden xl:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400"
      >
        {quickLinks.map((link) => {
          const isActive = activeModule === link.id;
          return (
            <button
              key={link.id}
              type="button"
              onClick={() => onSelectModule(link.id)}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isActive
                  ? 'text-teal-700 dark:text-teal-400 font-semibold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900 dark:hover:text-slate-100 hover:underline hover:underline-offset-8'
              }`}
            >
              {link.labelBn}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Theme toggle + Primary Action */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={
            theme === 'dark' ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'
          }
          title={theme === 'dark' ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
          className="min-w-[44px] min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenLoginView}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white/90 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <UserCheck className="w-4 h-4" />
          <span>লগইন পৃষ্ঠা</span>
        </button>
      </div>
    </header>
  );
};
