'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { todayLocal } from '../../expenses/shared';
import type { FeedItem } from '@/lib/feed-types';
import type { ExpenseVendor } from '@/lib/expense-types';
import { feedPurchaseSchema, type FeedPurchaseFormValues } from '../schema';
import { getPurchasePreview } from '../services';

type Props = {
  feedItems: FeedItem[];
  vendors: Pick<ExpenseVendor, 'id' | 'name'>[];
  onSave: (values: FeedPurchaseFormValues) => Promise<string | null>;
  busy: boolean;
  message: string;
};

const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function FeedPurchaseForm({ feedItems, vendors, onSave, busy, message }: Props) {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FeedPurchaseFormValues>({
    resolver: zodResolver(feedPurchaseSchema),
    defaultValues: {
      businessDate: todayLocal(),
      paymentStatus: 'PAID',
      paidAmount: 0,
      paymentMethod: 'CASH',
      vendorId: '',
      dueDate: '',
      notes: '',
      purchaseQuantity: 1,
      rate: 0,
    },
  });
  const feedId = watch('feedItemId');
  const quantity = Number(watch('purchaseQuantity'));
  const rate = Number(watch('rate'));
  const status = watch('paymentStatus');
  const paid = Number(watch('paidAmount'));
  const feed = feedItems.find((item) => item.id === feedId);
  const preview = useMemo(() => getPurchasePreview(feed, quantity, rate), [feed, quantity, rate]);

  useEffect(() => {
    if (status === 'PAID' && preview) setValue('paidAmount', preview.total);
    if (status === 'CREDIT') setValue('paidAmount', 0);
    if (status === 'PARTIAL' && preview && (paid <= 0 || paid >= preview.total)) setValue('paidAmount', Math.round(preview.total / 2 * 100) / 100);
  }, [status, preview, setValue]);

  async function submit(values: FeedPurchaseFormValues) {
    const error = await onSave(values);
    if (!error) reset({ ...values, feedItemId: '', vendorId: '', purchaseQuantity: 1, rate: 0, paidAmount: 0, notes: '', dueDate: '' });
  }

  return (
    <form className="card" onSubmit={handleSubmit(submit)}>
      <h2 className="section-title">Record feed purchase</h2>
      <div className="expense-form-grid">
        <div className="field"><label>Business date</label><input type="date" {...register('businessDate')} />{errors.businessDate && <span className="auth-message">{errors.businessDate.message}</span>}</div>
        <div className="field"><label>Feed</label><select {...register('feedItemId')}><option value="">Select feed item</option>{feedItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.feedItemId && <span className="auth-message">{errors.feedItemId.message}</span>}</div>
        <div className="field"><label>Vendor (optional)</label><select {...register('vendorId')}><option value="">No vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></div>
        <div className="field"><label>Purchase unit</label><input value={feed?.purchase_unit ?? '—'} readOnly /></div>
        <div className="field"><label>Quantity</label><input type="number" min="0.001" step="0.001" inputMode="decimal" {...register('purchaseQuantity')} />{errors.purchaseQuantity && <span className="auth-message">{errors.purchaseQuantity.message}</span>}</div>
        <div className="field"><label>Rate · ₹ per {feed?.purchase_unit ?? 'unit'}</label><input type="number" min="0.01" step="0.01" inputMode="decimal" {...register('rate')} />{errors.rate && <span className="auth-message">{errors.rate.message}</span>}</div>
        <div className="field"><label>Payment status</label><select {...register('paymentStatus')}><option value="PAID">Paid</option><option value="PARTIAL">Partial</option><option value="CREDIT">Credit</option></select></div>
        <div className="field"><label>Paid amount · ₹</label><input type="number" min="0" step="0.01" {...register('paidAmount')} />{errors.paidAmount && <span className="auth-message">{errors.paidAmount.message}</span>}</div>
        <div className="field"><label>Payment method</label><select {...register('paymentMethod')} disabled={status === 'CREDIT'}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CARD">Card</option><option value="OTHER">Other</option><option value="CREDIT">Credit</option></select></div>
        <div className="field"><label>Due date</label><input type="date" {...register('dueDate')} /></div>
        <div className="field wide-field"><label>Notes</label><input {...register('notes')} placeholder="Optional" /></div>
      </div>
      {preview && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="eyebrow">INVENTORY PREVIEW</div>
          <div className="row"><span>{preview.purchaseUnitQuantity} {preview.purchaseUnit} = {preview.purchaseUnitQuantity} {preview.baseUnit}</span><b>{preview.baseQuantity.toLocaleString('en-IN')} {preview.baseUnit}</b></div>
          <div className="row"><span>Rate</span><b>{money(preview.rate)} / {preview.purchaseUnit}</b></div>
          <div className="row"><span>Total</span><b>{money(preview.total)}</b></div>
          <div className="row"><span>Inventory cost</span><b>{money(preview.inventoryUnitCost)} / {preview.baseUnit}</b></div>
        </div>
      )}
      {message && <TimedNotice message={message} onDismiss={() => undefined} />}
      <button className="btn" disabled={busy || !feedItems.length}>{busy ? 'Saving…' : 'Record purchase'}</button>
    </form>
  );
}