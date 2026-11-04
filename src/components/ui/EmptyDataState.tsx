import React from 'react';
import { Database } from 'lucide-react';

export interface EmptyDataStateProps {
  titleBn: string;
  descriptionBn: string;
  tableNameHint?: string;
  actionLabelBn?: string;
  onActionClick?: () => void;
  icon?: React.ReactNode;
}

export const EmptyDataState: React.FC<EmptyDataStateProps> = ({
  titleBn,
  descriptionBn,
  tableNameHint,
  actionLabelBn,
  onActionClick,
  icon,
}) => {
  return (
    <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mb-3">
        {icon ?? <Database className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {titleBn}
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
        {descriptionBn}
      </p>
      {tableNameHint && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
          সুপাবেস টেবিল: {tableNameHint} · মুদ্রা: ৳ · তারিখ: DD-MM-YYYY
        </p>
      )}
      {actionLabelBn && onActionClick && (
        <button
          type="button"
          onClick={onActionClick}
          className="mt-4 min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white/90 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
        >
          <span>{actionLabelBn}</span>
        </button>
      )}
    </div>
  );
};
