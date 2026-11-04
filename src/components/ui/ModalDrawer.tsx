import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  titleBn: string;
  subtitleBn?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export const ModalDrawer: React.FC<ModalDrawerProps> = ({
  isOpen,
  onClose,
  titleBn,
  subtitleBn,
  children,
  maxWidthClass = 'max-w-2xl',
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-drawer-title"
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl`}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2
              id="modal-drawer-title"
              className="text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              {titleBn}
            </h2>
            {subtitleBn && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitleBn}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="min-w-[44px] min-h-[44px] -mr-2 -my-1 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
