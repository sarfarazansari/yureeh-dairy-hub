'use client';

import { useState } from 'react';

import { money } from '@/lib/farm-format';

import { useUpdateBuffaloPurchase } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../services/buffalo.service';

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
          <input
            type="date"
            value={purchaseDate}
            onChange={(event) => setPurchaseDate(event.target.value)}
          />
        </Field>

        <Field label="Purchase Price · ₹">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={purchasePrice}
            onChange={(event) => setPurchasePrice(event.target.value)}
          />
        </Field>

        <Field label="Payment Method">
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="">Not specified</option>
            {PAYMENT_METHODS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>

        <Field label="Transaction Reference">
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>

        <Field label="Udhaar Due Date">
          <input
            type="date"
            value={dueDate}
            disabled={!hasBalance}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </Field>

        <Field label="Udhaar Terms">
          <input
            value={terms}
            disabled={!hasBalance}
            onChange={(event) => setTerms(event.target.value)}
            placeholder="Agreed settlement terms"
          />
        </Field>
      </div>

      <Field label="Purchase Notes">
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
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
      <label>{label}</label>
      {children}
    </div>
  );
}
