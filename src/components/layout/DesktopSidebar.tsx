import React from 'react';
import { ChevronLeft, ChevronRight, LogIn, Scissors } from 'lucide-react';
import { NAVIGATION_ITEMS } from '../../config/navigation';
import { ModuleId } from '../../types/models';
import { NavIcon } from './NavIcon';

export interface DesktopSidebarProps {
  activeModule: ModuleId;
  onSelectModule: (module: ModuleId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenLoginView: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeModule,
  onSelectModule,
  isCollapsed,
  onToggleCollapse,
  onOpenLoginView,
}) => {
  const groups: ('প্রধান মডিউল' | 'আর্থিক ব্যবস্থাপনা' | 'বিশ্লেষণ ও সিস্টেম')[] = [
    'প্রধান মডিউল',
    'আর্থিক ব্যবস্থাপনা',
    'বিশ্লেষণ ও সিস্টেম',
  ];

  return (
    <aside
      aria-label="প্রধান নেভিগেশন সাইডবার"
      className={`hidden lg:flex flex-col shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-none ${
        isCollapsed ? 'w-20' : 'w-68'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onSelectModule(ModuleId.DASHBOARD)}
          className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center shrink-0">
            <Scissors className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <span className="block text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                স্মার্ট হিসাব
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                গার্মেন্টস ও আর্থিক খতিয়ান
              </span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'সাইডবার বড় করুন' : 'সাইডবার ছোট করুন'}
          title={isCollapsed ? 'সাইডবার বড় করুন' : 'সাইডবার ছোট করুন'}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Modules List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((groupName) => {
          const groupItems = NAVIGATION_ITEMS.filter((item) => item.groupBn === groupName);
          return (
            <div key={groupName} className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 pb-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                  {groupName}
                </p>
              )}
              {groupItems.map((item) => {
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectModule(item.id)}
                    title={isCollapsed ? item.labelBn : undefined}
                    className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center ${
                      isCollapsed ? 'justify-center' : 'justify-start gap-3'
                    } text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <NavIcon
                      name={item.iconName}
                      className={`w-5 h-5 shrink-0 ${
                        isActive
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.labelBn}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Bottom Auth / Login View Trigger */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onOpenLoginView}
          title={isCollapsed ? 'লগইন পৃষ্ঠা দেখুন' : undefined}
          className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-start gap-3'
          } transition-colors cursor-pointer whitespace-nowrap`}
        >
          <LogIn className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
          {!isCollapsed && <span className="truncate">লগইন পৃষ্ঠা (Google)</span>}
        </button>
      </div>
    </aside>
  );
};
