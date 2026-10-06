'use client';

import { useState } from 'react';

import { money } from '@/lib/farm-format';

import { useRecordBuffaloPurchasePayment } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../services/buffalo.service';

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'] as const;

export function BuffaloPurchasePaymentForm({ buffalo }: { buffalo: BuffaloDetail }) {
  const mutation = useRecordBuffaloPurchasePayment();
  const purchase = buffalo.buffalo_purchases[0];
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  async function handleSave() {
    if (!purchase) return;

    const paymentAmount = Number(amount);
    const pending = Number(purchase.amount_pending);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > pending) {
      return;
    }

    try {
      await mutation.mutateAsync({
        buffaloId: buffalo.id,
        payment: {
          payment_date: date,
          amount: paymentAmount,
          payment_method: method,
          transaction_reference: reference,
          notes,
        },
      });

      setAmount('');
      setReference('');
      setNotes('');
    } catch {
      // The mutation error is rendered below.
    }
  }

  return (
    <div className="card">
      <h2 className="section-title">Purchase payment</h2>
      <p className="sub">Pending: {money(Number(purchase?.amount_pending ?? 0))}</p>

      <div className="grid two">
        <Field label="Payment Date">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>

        <Field label="Amount · ₹">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>

        <Field label="Method">
          <select
            value={method}
            onChange={(event) =>
              setMethod(event.target.value as (typeof PAYMENT_METHODS)[number])
            }
          >
            {PAYMENT_METHODS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>

        <Field label="Reference">
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Optional transaction reference"
          />
        </Field>
      </div>

      <Field label="Notes">
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional"
        />
      </Field>

      {mutation.isError && <p className="auth-message">{mutation.error.message}</p>}

      <button
        className="btn"
        type="button"
        disabled={mutation.isPending || !purchase || Number(purchase.amount_pending) <= 0}
        onClick={() => void handleSave()}
      >
        {mutation.isPending ? 'Recording…' : 'Record payment'}
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
