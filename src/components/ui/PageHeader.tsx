import React from 'react';

interface PageHeaderProps {
  titleBn: string;
  subtitleBn?: string;
  moduleIndexBn?: string;
  actions?: React.ReactNode;
  primaryActionLabelBn?: string;
  primaryActionIcon?: React.ReactNode;
  onPrimaryAction?: () => void;
  secondaryActionLabelBn?: string;
  secondaryActionIcon?: React.ReactNode;
  onSecondaryAction?: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  titleBn,
  actions,
  primaryActionLabelBn,
  primaryActionIcon,
  onPrimaryAction,
  secondaryActionLabelBn,
  secondaryActionIcon,
  onSecondaryAction,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
      <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
        {titleBn}
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {secondaryActionLabelBn && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {secondaryActionIcon}
            <span>{secondaryActionLabelBn}</span>
          </button>
        )}
        {primaryActionLabelBn && onPrimaryAction && (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-2xs cursor-pointer"
          >
            {primaryActionIcon}
            <span>{primaryActionLabelBn}</span>
          </button>
        )}
      </div>
    </div>
  );
};
