'use client';

import type { ReactNode } from 'react';
import type { BuffaloPaymentMethod } from '../types';

export const DISPOSITION_PAYMENT_METHODS: BuffaloPaymentMethod[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'];

export function getDispositionToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function DispositionField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}
