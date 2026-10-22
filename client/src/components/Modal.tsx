import React, { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  isLoading = false
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-md bg-[#171719] rounded-3xl shadow-card p-5 sm:p-6 border border-[#303034] max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-[#A1A1AA] hover:text-white p-1.5 rounded-xl hover:bg-[#202023] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3.5 mb-4 pr-6 sm:pr-0">
          <div className={`p-2.5 rounded-2xl flex-shrink-0 ${confirmVariant === 'danger' ? 'bg-rose-950/40 text-rose-400 border border-rose-800' : 'bg-[#202023] text-[#C6FF3D] border border-[#303034]'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-white bg-[#202023] hover:bg-[#26262A] border border-[#303034] rounded-xl transition-colors disabled:opacity-50 text-center"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full sm:w-auto px-5 py-2.5 text-xs font-black rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
              confirmVariant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-subtle'
                : 'bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] shadow-glow-lime'
            }`}
          >
            {isLoading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
