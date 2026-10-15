'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

type Props = {
  message: string;
  type?: 'success' | 'error' | 'info';
  onDismiss: () => void;
};

/** Compatibility adapter for state-driven notifications. */
export function Toast({ message, type = 'success', onDismiss }: Props) {
  const dismissRef = useRef(onDismiss);
  const previousMessage = useRef('');
  const previousType = useRef<Props['type']>();

  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    if (!message) {
      previousMessage.current = '';
      previousType.current = undefined;
      return;
    }
    if (previousMessage.current === message && previousType.current === type) return;
    previousMessage.current = message;
    previousType.current = type;
    const id = `yureeh-toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const options = {
      id,
      duration: type === 'error' ? 7000 : 4000,
      action: {
        label: 'Dismiss',
        onClick: () => {
          toast.dismiss(id);
          dismissRef.current();
        },
      },
    };
    if (type === 'error') toast.error(message, options);
    else if (type === 'info') toast.info(message, options);
    else toast.success(message, options);
    return () => toast.dismiss(id);
  }, [message, type]);

  return null;
}
