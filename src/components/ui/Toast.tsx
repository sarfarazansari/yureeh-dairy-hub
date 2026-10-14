'use client';

import { useEffect, useRef } from 'react';
import { toast as sonnerToast } from 'sonner';

type Props = {
  message: string;
  type?: 'success' | 'error';
  onDismiss: () => void;
};

/**
 * Backwards-compatible adapter while feature pages are migrated.
 * Notifications are rendered by the global Sonner toaster; existing callers
 * can keep their current message state and dismiss callback.
 */
export function Toast({ message, type = 'success', onDismiss }: Props) {
  const dismissRef = useRef(onDismiss);
  const previousMessage = useRef('');
  const previousType = useRef<Props['type']>(undefined);

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
    const id = `yureeh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const dismiss = () => {
      sonnerToast.dismiss(id);
      dismissRef.current();
    };

    const options = {
      id,
      duration: type === 'error' ? 7000 : 4000,
      action: { label: 'Dismiss', onClick: dismiss },
    };

    if (type === 'error') sonnerToast.error(message, options);
    else sonnerToast.success(message, options);

    return () => {
      sonnerToast.dismiss(id);
    };
  }, [message, type]);

  return null;
}
