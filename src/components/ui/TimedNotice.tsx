'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function isSuccessMessage(message: string): boolean {
  return (
    /\b(saved|added|updated|deleted|created|successfully|confirmed|confirm|sent|activated|paused|completed|restored)\b/i.test(
      message,
    ) &&
    !/\b(could not|unable to|failed|error|must be|please correct|invalid|not configured)\b/i.test(
      message,
    )
  );
}

/** Legacy state-driven adapter; all visual notices are displayed through Sonner. */
export function TimedNotice({
  message,
  onDismiss,
  className,
}: {
  message: string;
  onDismiss: () => void;
  className?: string;
}) {
  const dismissRef = useRef(onDismiss);
  const previousMessage = useRef('');

  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    if (!message || previousMessage.current === message) return;
    previousMessage.current = message;
    const id = `yureeh-notice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const options = {
      id,
      duration: isSuccessMessage(message) ? 4000 : 7000,
      action: {
        label: 'Dismiss',
        onClick: () => {
          toast.dismiss(id);
          dismissRef.current();
        },
      },
    };
    if (isSuccessMessage(message)) toast.success(message, options);
    else toast.error(message, options);
    return () => { toast.dismiss(id); };
  }, [message]);

  // Retained for source compatibility with existing call sites.
  void className;
  return null;
}
