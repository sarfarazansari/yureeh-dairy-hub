'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { localDateKey } from '@/lib/milk-entry-list';
import { money } from '@/lib/farm-format';
import { useRecordBuffaloPurchasePayment } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../types';

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'] as const;

export function BuffaloPurchasePaymentForm({ buffalo }: { buffalo: BuffaloDetail }) {
  const mutation = useRecordBuffaloPurchasePayment();
  const purchase = buffalo.buffalo_purchases[0];
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDateKey());
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purchase) return;
    setMessage('');
    const paymentAmount = Number(amount);
    const pending = Number(purchase.amount_pending);
    if (!date || date > localDateKey()) { setMessage('Payment date cannot be in the future.'); return; }
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) { setMessage('Payment amount must be greater than ₹0.'); return; }
    if (paymentAmount > pending) { setMessage('Payment cannot exceed the outstanding purchase balance.'); return; }
    try {
      await mutation.mutateAsync({
        buffaloId: buffalo.id,
        payment: { payment_date: date, amount: paymentAmount, payment_method: method, transaction_reference: reference, notes },
      });
      setAmount('');
      setReference('');
      setNotes('');
    } catch {
      // Mutation state is displayed below.
    }
  }

  const canRecordPayment = Boolean(purchase && Number(purchase.amount_pending) > 0);
  return (
    <form className="card space-y-4" onSubmit={handleSave} noValidate>
      <h2 className="section-title">Purchase payment</h2>
      <p className="sub">Pending: {money(Number(purchase?.amount_pending ?? 0))}</p>
      {purchase ? <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Payment date"><DatePicker value={date} max={localDateKey()} onChange={setDate} ariaLabel="Payment date" /></Field>
          <Field label="Amount · ₹"><Input type="number" inputMode="decimal" min="0.01" max={purchase.amount_pending} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
          <Field label="Method"><Select value={method} onValueChange={(value) => setMethod(value as (typeof PAYMENT_METHODS)[number])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((value) => <SelectItem key={value} value={value}>{value.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Reference"><Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Optional transaction reference" /></Field>
        </div>
        <Field label="Notes"><Textarea value={notes} rows={2} onChange={(event) => setNotes(event.target.value)} /></Field>
      </> : <div className="empty">No purchase record exists.</div>}
      {message && <p role="alert" className="auth-message">{message}</p>}
      {mutation.isError && <p role="alert" className="auth-message">{mutation.error.message}</p>}
      <Button type="submit" disabled={mutation.isPending || !canRecordPayment}>{mutation.isPending ? 'Recording…' : 'Record payment'}</Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><Label>{label}</Label>{children}</div>;
}
