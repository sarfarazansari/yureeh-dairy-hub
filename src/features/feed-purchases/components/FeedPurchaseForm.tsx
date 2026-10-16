'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { todayLocal } from '@/features/expenses/utils/expense-format';
import type { FeedItem } from '@/lib/feed-types';
import type { ExpenseVendor } from '@/lib/expense-types';
import { feedPurchaseSchema, type FeedPurchaseFormValues } from '@/features/feed-purchases/feed-purchases.schema';
import { getPurchasePreview } from '@/features/feed-purchases/feed-purchases.service';

type Props = {
  feedItems: FeedItem[];
  vendors: Pick<ExpenseVendor, 'id' | 'name'>[];
  onSave: (values: FeedPurchaseFormValues) => Promise<string | null>;
  busy: boolean;
  initialValues?: FeedPurchaseFormValues;
  submitLabel?: string;
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
          <Label htmlFor="feed-purchase-date">Purchase date</Label>
          <DatePicker id="feed-purchase-date" value={values.businessDate} max={todayLocal()} onChange={(value) => update('businessDate', value)} ariaLabel="Purchase date" aria-invalid={!!errors.businessDate} />
          <p className="kpi-foot">Today or an earlier date.</p>
          {errors.businessDate && <span className="auth-message">{errors.businessDate}</span>}
        </div>

        <div className="field">
          <Label htmlFor="feed-purchase-item">Feed item</Label>
          <Select value={values.feedItemId || undefined} onValueChange={(value) => update('feedItemId', value)}><SelectTrigger id="feed-purchase-item"><SelectValue placeholder="Select feed item" /></SelectTrigger><SelectContent>{feedItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
          {errors.feedItemId && <span className="auth-message">{errors.feedItemId}</span>}
        </div>

        <div className="field">
          <Label htmlFor="feed-purchase-vendor">Vendor</Label>
          <Select value={values.vendorId || "none"} onValueChange={(value) => update('vendorId', value === 'none' ? '' : value)}><SelectTrigger id="feed-purchase-vendor"><SelectValue placeholder="No vendor" /></SelectTrigger><SelectContent><SelectItem value="none">No vendor</SelectItem>{vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent></Select>
        </div>

        <div className="field">
          <Label htmlFor="feed-purchase-unit">Purchase unit</Label>
          <Input id="feed-purchase-unit" value={feed?.purchase_unit ?? '—'} readOnly aria-describedby="feed-purchase-unit-help" />
          <p id="feed-purchase-unit-help" className="kpi-foot">Unit is controlled by the selected feed item.</p>
        </div>

        <div className="field">
          <Label htmlFor="feed-purchase-quantity">Quantity</Label>
          <Input
            id="feed-purchase-quantity"
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
          <Label htmlFor="feed-purchase-rate">Rate per purchase unit (₹)</Label>
          <Input
            id="feed-purchase-rate"
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
          <Label htmlFor="feed-purchase-status">Payment status</Label>
          <Select value={values.paymentStatus} onValueChange={(value) => update('paymentStatus', value as FeedPurchaseFormValues['paymentStatus'])}><SelectTrigger id="feed-purchase-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PAID">Paid</SelectItem><SelectItem value="PARTIAL">Partial</SelectItem><SelectItem value="CREDIT">Credit</SelectItem></SelectContent></Select>
        </div>

        <div className="field">
          <Label htmlFor="feed-purchase-paid">Paid amount (₹)</Label>
          <Input
            id="feed-purchase-paid"
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
            <Label htmlFor="feed-purchase-method">Payment method</Label>
            <Select value={values.paymentMethod} onValueChange={(value) => update('paymentMethod', value)}><SelectTrigger id="feed-purchase-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem><SelectItem value="CARD">Card</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select>
          </div>
        )}

        {values.paymentStatus !== 'PAID' && (
          <div className="field">
            <Label htmlFor="feed-purchase-due-date">Due date</Label>
            <DatePicker id="feed-purchase-due-date" value={values.dueDate || ""} min={values.businessDate} clearable onChange={(value) => update('dueDate', value)} ariaLabel="Due date" aria-invalid={!!errors.dueDate} />
            <p className="kpi-foot">Optional; cannot be earlier than purchase date. Hidden for fully paid purchases.</p>
          </div>
        )}

        <div className="field wide-field">
          <Label htmlFor="feed-purchase-notes">Notes</Label>
          <Textarea id="feed-purchase-notes"
            value={values.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Optional"
            rows={3}
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

      <Button type="submit" disabled={busy || !feedItems.length}>
        {busy ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
