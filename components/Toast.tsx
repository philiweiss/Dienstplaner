import React from 'react';
import type { ToastItem } from '../hooks/useToast';

const variantStyles: Record<string, string> = {
  info: 'bg-slate-800 text-white border-slate-700',
  success: 'bg-green-600 text-white border-green-700',
  warning: 'bg-amber-600 text-white border-amber-700',
  error: 'bg-red-600 text-white border-red-700',
};

export const Toast: React.FC<{ toast: ToastItem; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  const style = variantStyles[toast.variant] || variantStyles.info;
  return (
    <div
      className={`min-w-[240px] max-w-sm shadow-lg rounded-md border p-3 mb-2 flex items-start gap-3 ${style} animate-toast-in transition-base`}
      role="alert"
    >
      <div className="flex-1">
        {toast.title && <div className="font-semibold text-sm">{toast.title}</div>}
        <div className="text-sm leading-snug">{toast.message}</div>
        {toast.actionLabel && toast.onAction && (
          <button
            onClick={() => { toast.onAction && toast.onAction(); onClose(toast.id); }}
            className="mt-2 text-xs underline decoration-2"
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="text-white/80 hover:text-white text-sm leading-none px-1"
        aria-label="Close"
        title="Schließen"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
