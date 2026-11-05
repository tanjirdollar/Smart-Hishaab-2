import React from 'react';

export interface PageHeaderProps {
  titleBn: string;
  subtitleBn: string;
  moduleIndexBn?: string;
  primaryActionLabelBn?: string;
  onPrimaryAction?: () => void;
  primaryActionIcon?: React.ReactNode;
  secondaryActionLabelBn?: string;
  onSecondaryAction?: () => void;
  secondaryActionIcon?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  titleBn,
  subtitleBn,
  moduleIndexBn,
  primaryActionLabelBn,
  onPrimaryAction,
  primaryActionIcon,
  secondaryActionLabelBn,
  onSecondaryAction,
  secondaryActionIcon,
}) => {
  return (
    <div className="w-full max-w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 pb-4 sm:pb-5 border-b border-slate-200 dark:border-slate-800">
      <div className="space-y-1 min-w-0">
        {moduleIndexBn && (
          <p className="text-xs font-medium text-teal-700 dark:text-teal-400 break-words">
            {moduleIndexBn}
          </p>
        )}
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight break-words">
          {titleBn}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed break-words">
          {subtitleBn}
        </p>
      </div>

      {(primaryActionLabelBn || secondaryActionLabelBn) && (
        <div className="flex flex-col xs:flex-row sm:flex-row flex-wrap items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
          {secondaryActionLabelBn && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="min-h-[44px] w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {secondaryActionIcon}
              <span className="truncate">{secondaryActionLabelBn}</span>
            </button>
          )}

          {primaryActionLabelBn && onPrimaryAction && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="min-h-[44px] w-full sm:w-auto px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {primaryActionIcon}
              <span className="truncate">{primaryActionLabelBn}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
