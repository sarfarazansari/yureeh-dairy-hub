'use client';

import { X } from 'lucide-react';

type Props = {
  message: string;
  type?: 'success' | 'error';
  onDismiss: () => void;
};

export function Toast({ message, type = 'success', onDismiss }: Props) {
  if (!message) return null;

  return (
    <div className={`app-toast app-toast-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      <button type="button" aria-label="Dismiss notification" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
