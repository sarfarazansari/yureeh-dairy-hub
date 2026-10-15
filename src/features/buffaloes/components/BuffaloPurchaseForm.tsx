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
import { useUpdateBuffaloPurchase } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../types';

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'] as const;

export function BuffaloPurchaseForm({ buffalo, onCancel }: { buffalo: BuffaloDetail; onCancel: () => void }) {
  const purchase = buffalo.buffalo_purchases[0];
  const mutation = useUpdateBuffaloPurchase();
  const [purchaseDate, setPurchaseDate] = useState(purchase?.purchase_date ?? '');
  const [purchasePrice, setPurchasePrice] = useState(purchase ? String(purchase.purchase_price) : '');
  const [dueDate, setDueDate] = useState(purchase?.payment_due_date ?? '');
  const [terms, setTerms] = useState(purchase?.payment_terms ?? '');
  const [method, setMethod] = useState(purchase?.payment_method ?? '');
  const [reference, setReference] = useState(purchase?.transaction_reference ?? '');
  const [notes, setNotes] = useState(purchase?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!purchase) return <div className="empty">No purchase record exists for this buffalo.</div>;

  const paid = Number(purchase.amount_paid);
  const price = Number(purchasePrice) || 0;
  const balance = Math.max(0, price - paid);
  const hasBalance = balance > 0;

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!purchaseDate) nextErrors.purchaseDate = 'Purchase date is required.';
    if (!Number.isFinite(price) || price <= 0) nextErrors.purchasePrice = 'Purchase price must be greater than ₹0.';
    if (paid > price) nextErrors.purchasePrice = 'Purchase price cannot be lower than the amount already paid.';
    if (hasBalance && !dueDate) nextErrors.dueDate = 'Due date is required while a balance remains.';
    if (dueDate && purchaseDate && dueDate < purchaseDate) nextErrors.dueDate = 'Due date cannot be earlier than the purchase date.';
    if (purchaseDate > localDateKey()) nextErrors.purchaseDate = 'Purchase date cannot be in the future.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await mutation.mutateAsync({
        buffaloId: buffalo.id,
        purchase: {
          purchase_date: purchaseDate,
          purchase_price: price,
          payment_due_date: hasBalance ? dueDate : null,
          payment_terms: hasBalance ? terms : '',
          payment_method: method ? (method as (typeof PAYMENT_METHODS)[number]) : null,
          transaction_reference: reference,
          notes,
        },
      });
      onCancel();
    } catch {
      // Mutation state is displayed below.
    }
  }

  return (
    <form className="card space-y-4" onSubmit={handleSave} noValidate>
      <div className="row">
        <div><h2 className="section-title">Edit purchase details</h2><p className="sub">Paid: {money(paid)} · Balance: {money(balance)}</p></div>
        <span className="tag">{purchase.payment_status}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Purchase date" error={errors.purchaseDate}><DatePicker value={purchaseDate} max={localDateKey()} onChange={setPurchaseDate} ariaLabel="Purchase date" aria-invalid={Boolean(errors.purchaseDate)} /></Field>
        <Field label="Purchase price · ₹" error={errors.purchasePrice}><Input type="number" min="0.01" step="0.01" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} aria-invalid={Boolean(errors.purchasePrice)} /></Field>
        <Field label="Payment method"><Select value={method || 'none'} onValueChange={(value) => setMethod(value === 'none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem>{PAYMENT_METHODS.map((value) => <SelectItem key={value} value={value}>{value.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Transaction reference"><Input value={reference} onChange={(event) => setReference(event.target.value)} /></Field>
        <Field label="Udhaar due date" error={errors.dueDate}><DatePicker value={dueDate} min={purchaseDate} disabled={!hasBalance} clearable onChange={setDueDate} ariaLabel="Udhaar due date" aria-invalid={Boolean(errors.dueDate)} /></Field>
        <Field label="Udhaar terms"><Input value={terms} disabled={!hasBalance} onChange={(event) => setTerms(event.target.value)} placeholder="Agreed settlement terms" /></Field>
      </div>
      <Field label="Purchase notes"><Textarea value={notes} rows={3} onChange={(event) => setNotes(event.target.value)} /></Field>
      {mutation.isError && <p role="alert" className="auth-message">{mutation.error.message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save purchase'}</Button>
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="field"><Label>{label}</Label>{children}{error && <p className="field-error" role="alert">{error}</p>}</div>;
}
