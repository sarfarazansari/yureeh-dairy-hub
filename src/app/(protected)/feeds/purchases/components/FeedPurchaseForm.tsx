'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { todayLocal } from '../../../expenses/shared';
import type { FeedItem } from '@/lib/feed-types';
import type { ExpenseVendor } from '@/lib/expense-types';
import { feedPurchaseSchema, type FeedPurchaseFormValues } from '../schema';
import { getPurchasePreview } from '../services';

type Props = {
  feedItems: FeedItem[];
  vendors: Pick<ExpenseVendor, 'id' | 'name'>[];
  onSave: (values: FeedPurchaseFormValues) => Promise<string | null>;
  busy: boolean;
};

const money = (value: number) =>
  `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const initialValues: FeedPurchaseFormValues = {
  feedItemId: '',
  vendorId: '',
  businessDate: todayLocal(),
  purchaseQuantity: 1,
  rate: 0,
  paymentStatus: 'PAID',
  paidAmount: 0,
  paymentMethod: 'CASH',
  dueDate: '',
  notes: '',
};

export function FeedPurchaseForm({ feedItems, vendors, onSave, busy, initialValues: providedInitialValues, submitLabel = 'Record purchase' }: Props) {
  const formInitialValues = providedInitialValues ?? initialValues;
  const [values, setValues] = useState(formInitialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submittingRef = useRef(false);

  const feed = feedItems.find((item) => item.id === values.feedItemId);
  const preview = useMemo(
    () => getPurchasePreview(feed, Number(values.purchaseQuantity), Number(values.rate)),
    [feed, values.purchaseQuantity, values.rate],
  );

  const hasConversion =
    preview && preview.purchaseUnit !== preview.baseUnit;

  useEffect(() => {
    if (values.paymentStatus === 'PAID' && preview) {
      setValues((current) => ({ ...current, paidAmount: preview.total, dueDate: '' }));
    } else if (values.paymentStatus === 'CREDIT') {
      setValues((current) => ({ ...current, paidAmount: 0 }));
    }
  }, [values.paymentStatus, preview]);

  function update<K extends keyof FeedPurchaseFormValues>(
    key: K,
    value: FeedPurchaseFormValues[K],
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

    const parsed = feedPurchaseSchema.safeParse(values);
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
      if (!error) {
        setValues({ ...formInitialValues, businessDate: values.businessDate });
        setErrors({});
      } else {
        setErrors({ form: error });
      }
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 className="section-title">Record feed purchase</h2>

      <div className="expense-form-grid">
        <div className="field">
          <label>Purchase date</label>
          <input
            type="date"
            value={values.businessDate}
            onChange={(e) => update('businessDate', e.target.value)}
          />
          {errors.businessDate && <span className="auth-message">{errors.businessDate}</span>}
        </div>

        <div className="field">
          <label>Feed item</label>
          <select
            value={values.feedItemId}
            onChange={(e) => update('feedItemId', e.target.value)}
          >
            <option value="">Select feed item</option>
            {feedItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {errors.feedItemId && <span className="auth-message">{errors.feedItemId}</span>}
        </div>

        <div className="field">
          <label>Vendor</label>
          <select
            value={values.vendorId}
            onChange={(e) => update('vendorId', e.target.value)}
          >
            <option value="">Select vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Purchase unit</label>
          <input value={feed?.purchase_unit ?? '—'} readOnly />
        </div>

        <div className="field">
          <label>Quantity</label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            inputMode="decimal"
            value={values.purchaseQuantity}
            onChange={(e) => update('purchaseQuantity', Number(e.target.value))}
          />
          {errors.purchaseQuantity && (
            <span className="auth-message">{errors.purchaseQuantity}</span>
          )}
        </div>

        <div className="field">
          <label>Rate per purchase unit (₹)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={values.rate || ''}
            onChange={(e) => update('rate', Number(e.target.value))}
          />
          {errors.rate && <span className="auth-message">{errors.rate}</span>}
        </div>

        <div className="field">
          <label>Payment status</label>
          <select
            value={values.paymentStatus}
            onChange={(e) =>
              update(
                'paymentStatus',
                e.target.value as FeedPurchaseFormValues['paymentStatus'],
              )
            }
          >
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="CREDIT">Credit</option>
          </select>
        </div>

        <div className="field">
          <label>Paid amount (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.paidAmount}
            readOnly={values.paymentStatus === 'PAID' || values.paymentStatus === 'CREDIT'}
            onChange={(e) => update('paidAmount', Number(e.target.value))}
          />
          {errors.paidAmount && <span className="auth-message">{errors.paidAmount}</span>}
        </div>

        {values.paymentStatus !== 'CREDIT' && (
          <div className="field">
            <label>Payment method</label>
            <select
              value={values.paymentMethod}
              onChange={(e) => update('paymentMethod', e.target.value)}
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        )}

        {values.paymentStatus !== 'PAID' && (
          <div className="field">
            <label>Due date</label>
            <input
              type="date"
              value={values.dueDate}
              onChange={(e) => update('dueDate', e.target.value)}
            />
          </div>
        )}

        <div className="field wide-field">
          <label>Notes</label>
          <input
            value={values.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      {preview && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="eyebrow">PURCHASE SUMMARY</div>

          {hasConversion ? (
            <div className="row">
              <span>
                1 {preview.purchaseUnit} = {preview.purchaseUnitQuantity} {preview.baseUnit}
              </span>
              <b>
                {preview.baseQuantity.toLocaleString('en-IN')} {preview.baseUnit}
              </b>
            </div>
          ) : (
            <div className="row">
              <span>Total inventory quantity</span>
              <b>
                {preview.baseQuantity.toLocaleString('en-IN')} {preview.baseUnit}
              </b>
            </div>
          )}

          <div className="row">
            <span>Rate</span>
            <b>
              {money(preview.rate)} / {preview.purchaseUnit}
            </b>
          </div>

          <div className="row">
            <span>Total purchase amount</span>
            <b>{money(preview.total)}</b>
          </div>

          <div className="row">
            <span>Inventory cost</span>
            <b>
              {money(preview.inventoryUnitCost)} / {preview.baseUnit}
            </b>
          </div>
        </div>
      )}

      {errors.form && <span className="auth-message">{errors.form}</span>}

      <button type="submit" className="btn" disabled={busy || submittingRef.current || !feedItems.length}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
