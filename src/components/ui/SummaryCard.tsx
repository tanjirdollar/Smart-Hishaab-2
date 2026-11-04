import React from 'react';
import { formatTaka } from '../../utils/formatters';

export interface SummaryCardProps {
  titleBn: string;
  amount: number | null;
  customValueBn?: string;
  subtitleBn: string;
  dbColumnHint?: string;
  icon: React.ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'danger' | 'accent';
}

const ICON_CONTAINER_STYLES: Record<NonNullable<SummaryCardProps['tone']>, string> = {
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  positive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  accent: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
};

export const SummaryCard: React.FC<SummaryCardProps> = ({
  titleBn,
  amount,
  customValueBn,
  subtitleBn,
  dbColumnHint,
  icon,
  tone = 'default',
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-snug">
            {titleBn}
          </p>
          <p className="mt-2 text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {customValueBn !== undefined ? customValueBn : formatTaka(amount, true)}
          </p>
        </div>
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ICON_CONTAINER_STYLES[tone]}`}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="truncate">{subtitleBn}</span>
        {dbColumnHint && (
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
            {dbColumnHint}
          </span>
        )}
      </div>
    </div>
  );
};
