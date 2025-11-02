import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number; // ms
}

interface ToastContextType {
  toasts: ToastItem[];
  remove: (id: string) => void;
  push: (toast: Omit<ToastItem, 'id'>) => string;
  info: (message: string, opts?: Omit<ToastItem, 'id' | 'message' | 'variant'>) => string;
  success: (message: string, opts?: Omit<ToastItem, 'id' | 'message' | 'variant'>) => string;
  warn: (message: string, opts?: Omit<ToastItem, 'id' | 'message' | 'variant'>) => string;
  error: (message: string, opts?: Omit<ToastItem, 'id' | 'message' | 'variant'>) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = randomId();
    const duration = toast.duration ?? 4500;
    setToasts(prev => [...prev, { ...toast, id, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const make = useCallback((variant: ToastVariant) => (message: string, opts?: Omit<ToastItem, 'id' | 'message' | 'variant'>) => {
    return push({ message, variant, ...(opts || {}) });
  }, [push]);

  const value: ToastContextType = {
    toasts,
    remove,
    push,
    info: make('info'),
    success: make('success'),
    warn: make('warning'),
    error: make('error'),
  };

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
};

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
