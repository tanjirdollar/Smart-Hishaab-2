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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
      <div className="space-y-1">
        {moduleIndexBn && (
          <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
            {moduleIndexBn}
          </p>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {titleBn}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          {subtitleBn}
        </p>
      </div>

      {(primaryActionLabelBn || secondaryActionLabelBn) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {secondaryActionLabelBn && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {secondaryActionIcon}
              <span>{secondaryActionLabelBn}</span>
            </button>
          )}

          {primaryActionLabelBn && onPrimaryAction && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {primaryActionIcon}
              <span>{primaryActionLabelBn}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
