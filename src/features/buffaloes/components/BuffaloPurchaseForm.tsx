'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useState } from 'react';

import { DatePicker } from '@/components/ui/date-picker';
import { money } from '@/lib/farm-format';

import { useUpdateBuffaloPurchase } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../types';

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'] as const;

export function BuffaloPurchaseForm({
  buffalo,
  onCancel,
}: {
  buffalo: BuffaloDetail;
  onCancel: () => void;
}) {
  const purchase = buffalo.buffalo_purchases[0];
  const mutation = useUpdateBuffaloPurchase();

  const [purchaseDate, setPurchaseDate] = useState(purchase?.purchase_date ?? '');
  const [purchasePrice, setPurchasePrice] = useState(
    purchase ? String(purchase.purchase_price) : '',
  );
  const [dueDate, setDueDate] = useState(purchase?.payment_due_date ?? '');
  const [terms, setTerms] = useState(purchase?.payment_terms ?? '');
  const [method, setMethod] = useState(purchase?.payment_method ?? '');
  const [reference, setReference] = useState(purchase?.transaction_reference ?? '');
  const [notes, setNotes] = useState(purchase?.notes ?? '');

  if (!purchase) {
    return <div className="empty">No purchase record exists for this buffalo.</div>;
  }

  const paid = Number(purchase.amount_paid);
  const price = Number(purchasePrice) || 0;
  const balance = Math.max(0, price - paid);
  const hasBalance = balance > 0;

  async function handleSave() {
    if (!purchaseDate || price <= 0 || paid > price || (hasBalance && !dueDate)) return;

    try {
      await mutation.mutateAsync({
        buffaloId: buffalo.id,
        purchase: {
          purchase_date: purchaseDate,
          purchase_price: price,
          payment_due_date: hasBalance ? dueDate : null,
          payment_terms: hasBalance ? terms : '',
          payment_method: method
            ? (method as (typeof PAYMENT_METHODS)[number])
            : null,
          transaction_reference: reference,
          notes,
        },
      });

      onCancel();
    } catch {
      // Mutation state is shown below.
    }
  }

  return (
    <div className="card">
      <div className="row">
        <div>
          <h2 className="section-title">Edit purchase details</h2>
          <p className="sub">Paid: {money(paid)} · Balance: {money(balance)}</p>
        </div>
        <span className="tag">{purchase.payment_status}</span>
      </div>

      <div className="grid two">
        <Field label="Purchase Date">
          <DatePicker value={purchaseDate} max={localDateKey()} onChange={setPurchaseDate} ariaLabel="Purchase date" />
        </Field>

        <Field label="Purchase Price · ₹">
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={purchasePrice}
            onChange={(event) => setPurchasePrice(event.target.value)}
          />
        </Field>

        <Field label="Payment Method">
          <Select value={method || 'none'} onValueChange={(value) => setMethod(value === 'none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem>{PAYMENT_METHODS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
        </Field>

        <Field label="Transaction Reference">
          <Input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>

        <Field label="Udhaar Due Date">
          <DatePicker value={dueDate} min={purchaseDate} disabled={!hasBalance} clearable onChange={setDueDate} ariaLabel="Udhaar due date" />
        </Field>

        <Field label="Udhaar Terms">
          <Input
            value={terms}
            disabled={!hasBalance}
            onChange={(event) => setTerms(event.target.value)}
            placeholder="Agreed settlement terms"
          />
        </Field>
      </div>

      <Field label="Purchase Notes">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </Field>

      {paid > price && (
        <p className="auth-message">
          Purchase price cannot be lower than the amount already paid.
        </p>
      )}
      {mutation.isError && <p className="auth-message">{mutation.error.message}</p>}

      <button
        className="btn"
        type="button"
        disabled={mutation.isPending}
        onClick={() => void handleSave()}
      >
        {mutation.isPending ? 'Saving…' : 'Save purchase'}
      </button>{' '}
      <button className="btn" type="button" disabled={mutation.isPending} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
