'use client';

import { useEffect, useRef } from 'react';

const successMessagePattern =
  /\b(saved|added|updated|deleted|created|successfully|confirmed|confirm|sent|activated|paused|completed|restored)\b/i;

export function isSuccessMessage(message: string): boolean {
  return (
    successMessagePattern.test(message) &&
    !/\b(could not|unable to|failed|error|must be|please correct|invalid|not configured)\b/i.test(
      message,
    )
  );
}

export function TimedNotice({
  message,
  onDismiss,
  className,
}: {
  message: string;
  onDismiss: () => void;
  className?: string;
}) {
  const success = isSuccessMessage(message);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => dismissRef.current(), 60_000);
    return () => window.clearTimeout(timeout);
  }, [message, success]);

  return (
    <p
      className={className ?? (success ? 'success-message' : 'auth-message')}
      role={success ? 'status' : 'alert'}
    >
      {message}
    </p>
  );
}
