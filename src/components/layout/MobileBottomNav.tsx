import React, { useState } from 'react';
import { Grid, LogIn, X } from 'lucide-react';
import { MOBILE_PRIMARY_NAV_IDS, NAVIGATION_ITEMS } from '../../config/navigation';
import { ModuleId } from '../../types/models';
import { NavIcon } from './NavIcon';

export interface MobileBottomNavProps {
  activeModule: ModuleId;
  onSelectModule: (module: ModuleId) => void;
  onOpenLoginView: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeModule,
  onSelectModule,
  onOpenLoginView,
}) => {
  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);

  const primaryItems = NAVIGATION_ITEMS.filter((item) =>
    MOBILE_PRIMARY_NAV_IDS.includes(item.id)
  );
  const isSecondaryActive = !MOBILE_PRIMARY_NAV_IDS.includes(activeModule);

  const handleModuleSelect = (id: ModuleId) => {
    onSelectModule(id);
    setIsMoreDrawerOpen(false);
  };

  return (
    <>
      {/* Fixed Bottom Navigation Bar (Height: 60px, well within 15% mobile sticky cap) */}
      <nav
        aria-label="মোবাইল বটম নেভিগেশন বার"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-15 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center px-1"
      >
        {primaryItems.map((item) => {
          const isActive = activeModule === item.id && !isMoreDrawerOpen;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleModuleSelect(item.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
                isActive
                  ? 'text-teal-700 dark:text-teal-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <NavIcon name={item.iconName} className="w-5 h-5" />
              <span className="text-[11px] leading-tight mt-1 whitespace-nowrap truncate max-w-[68px]">
                {item.shortLabelBn}
              </span>
            </button>
          );
        })}

        {/* 5th Tab: All 10 Modules Drawer Trigger */}
        <button
          type="button"
          onClick={() => setIsMoreDrawerOpen((prev) => !prev)}
          className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
            isSecondaryActive || isMoreDrawerOpen
              ? 'text-teal-700 dark:text-teal-400 font-semibold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Grid className="w-5 h-5" />
          <span className="text-[11px] leading-tight mt-1 whitespace-nowrap">
            সকল মেনু
          </span>
        </button>
      </nav>

      {/* Mobile Bottom Sheet for All 10 Modules */}
      {isMoreDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="সকল মডিউল নেভিগেশন"
        >
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 p-4 pb-6 max-h-[82vh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  স্মার্ট হিসাব — সকল মডিউলসমূহ
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  যেকোনো বিভাগে যেতে ট্যাপ করুন
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreDrawerOpen(false)}
                aria-label="মেনু বন্ধ করুন"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {NAVIGATION_ITEMS.map((item) => {
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleModuleSelect(item.id)}
                    className={`min-h-[50px] p-3 rounded-2xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
                      isActive
                        ? 'border-teal-600 bg-teal-50/80 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-teal-700 text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <NavIcon name={item.iconName} className="w-4 h-4" />
                    </div>
                    <span className="text-sm leading-snug truncate">{item.labelBn}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  onOpenLoginView();
                }}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Google লগইন পৃষ্ঠা দেখুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
