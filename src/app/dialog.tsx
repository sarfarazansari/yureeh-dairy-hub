'use client';

import type { ReactNode } from 'react';
import { Dialog as ShadcnDialog, DialogContent } from '@/components/ui/dialog';

/** Compatibility wrapper that delegates modality and focus management to shadcn/Radix. */
export function Dialog({
  open,
  onOpenChange,
  labelledBy,
  children,
  className = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ShadcnDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-labelledby={labelledBy}
        className={`app-dialog max-h-[min(90dvh,48rem)] overflow-y-auto ${className}`}
      >
        {children}
      </DialogContent>
    </ShadcnDialog>
  );
}
