import React from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';

const ToastContainer: React.FC = () => {
  const { toasts, remove } = useToast();
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onClose={remove} />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;
