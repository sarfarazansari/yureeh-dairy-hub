'use client';

import { useMemo, useRef, useState } from 'react';
import { todayLocal } from '../../../expenses/shared';
import type { FeedItem } from '@/lib/feed-types';
import type { FeedInventoryStock } from '@/lib/feed-inventory-types';
import { feedConsumptionSchema, type FeedConsumptionFormValues } from '../schema';

type Props = {
  feedItems: FeedItem[];
  stock: FeedInventoryStock[];
  onSave: (values: FeedConsumptionFormValues) => Promise<string | null>;
  onError?: (message: string) => void;
  busy: boolean;
  initialValues?: FeedConsumptionFormValues;
  submitLabel?: string;
  lockFeedItem?: boolean;
};

export function FeedConsumptionForm({
  feedItems,
  stock,
  onSave,
  onError,
  busy,
  initialValues,
  submitLabel = 'Record consumption',
  lockFeedItem = false,
}: Props) {
  const [values, setValues] = useState<FeedConsumptionFormValues>(
    initialValues ?? { feedItemId: '', businessDate: todayLocal(), quantity: 1, notes: '' },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submittingRef = useRef(false);

  const selectedFeed = feedItems.find((item) => item.id === values.feedItemId);
  const selectedStock = stock.find((item) => item.feed_item_id === values.feedItemId);
  const available = Number(selectedStock?.quantity_on_hand ?? 0);
  const quantity = Number(values.quantity);
  const estimatedCost = Number(selectedStock?.weighted_average_cost ?? 0);
  const remaining = useMemo(
    () => available - (Number.isFinite(quantity) ? quantity : 0),
    [available, quantity],
  );

  function update<K extends keyof FeedConsumptionFormValues>(
    key: K,
    value: FeedConsumptionFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current || busy) return;
    submittingRef.current = true;
    setErrors({});

    const parsed = feedConsumptionSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      submittingRef.current = false;
      return;
    }

    try {
      const error = await onSave(parsed.data);
      if (error) onError?.(error);
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 className="section-title">{submitLabel === 'Save changes' ? 'Edit feed consumption' : 'Record feed consumption'}</h2>

      <div className="expense-form-grid">
        <div className="field">
          <label>Consumption date</label>
          <input type="date" value={values.businessDate} onChange={(e) => update('businessDate', e.target.value)} />
          {errors.businessDate && <span className="auth-message">{errors.businessDate}</span>}
        </div>

        <div className="field">
          <label>Feed item</label>
          {lockFeedItem ? (
            <input value={selectedFeed?.name ?? '—'} readOnly />
          ) : (
            <select value={values.feedItemId} onChange={(e) => update('feedItemId', e.target.value)}>
              <option value="">Select feed item</option>
              {feedItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          )}
          {errors.feedItemId && <span className="auth-message">{errors.feedItemId}</span>}
        </div>

        <div className="field">
          <label>Unit</label>
          <input value={selectedFeed?.base_unit ?? '—'} readOnly />
        </div>

        <div className="field">
          <label>Available stock</label>
          <input
            value={selectedFeed ? `${available.toLocaleString('en-IN')} ${selectedFeed.base_unit}` : '—'}
            readOnly
          />
        </div>

        <div className="field">
          <label>Quantity</label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            inputMode="decimal"
            value={values.quantity}
            onChange={(e) => update('quantity', Number(e.target.value))}
          />
          {errors.quantity && <span className="auth-message">{errors.quantity}</span>}
        </div>

        <div className="field">
          <label>Remaining stock</label>
          <input
            value={selectedFeed ? `${remaining.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${selectedFeed.base_unit}` : '—'}
            readOnly
          />
        </div>

        <div className="field wide-field">
          <label>Notes</label>
          <input value={values.notes ?? ''} onChange={(e) => update('notes', e.target.value)} placeholder="Optional" />
        </div>
      </div>

      {selectedFeed && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="eyebrow">CONSUMPTION SUMMARY</div>
          <div className="row">
            <span>Available stock</span>
            <b>{available.toLocaleString('en-IN')} {selectedFeed.base_unit}</b>
          </div>
          <div className="row">
            <span>Consumption cost</span>
            <b>₹{(quantity * estimatedCost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
          </div>
        </div>
      )}

      <button type="submit" className="btn" disabled={busy || submittingRef.current || !feedItems.length}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
