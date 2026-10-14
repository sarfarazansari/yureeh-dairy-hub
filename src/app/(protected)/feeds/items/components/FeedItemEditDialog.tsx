'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useEffect, useState } from 'react';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { FEED_CATEGORIES, FEED_UNITS, type FeedCategory, type FeedItem } from '@/lib/feed-types';
import type { FeedItemFormValues } from './FeedItemForm';

type Props = {
  item: FeedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: FeedItemFormValues, id: string) => Promise<string | null>;
  busy: boolean;
};

const label = (value: string) => value.replaceAll('_', ' ');

export function FeedItemEditDialog({ item, open, onOpenChange, onSave, busy }: Props) {
  const [values, setValues] = useState<FeedItemFormValues>({
    name: '', category: 'CONCENTRATE', baseUnit: 'KG', purchaseUnit: 'KG', conversion: '1', lowStockThreshold: '0', notes: '',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!item || !open) return;
    setValues({ name: item.name, category: item.category, baseUnit: item.base_unit, purchaseUnit: item.purchase_unit, conversion: String(item.purchase_unit_quantity), lowStockThreshold: String(item.low_stock_threshold ?? 0), notes: item.notes ?? '' });
    setMessage('');
  }, [item, open]);

  if (!open || !item) return null;

  function update<K extends keyof FeedItemFormValues>(key: K, value: FeedItemFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!item) return;
    const error = await onSave(values, item.id);
    if (error) setMessage(error);
    else onOpenChange(false);
  }

  return (
    <dialog open className="app-dialog" aria-labelledby="feed-edit-title">
      <form onSubmit={submit}>
        <div className="dialog-header">
          <div><p className="eyebrow">FEED MASTER</p><h2 id="feed-edit-title" className="dialog-title">Edit feed item</h2><p className="dialog-description">Update the feed definition used for inventory and consumption tracking.</p></div>
          <button type="button" className="dialog-close" onClick={() => onOpenChange(false)} disabled={busy} aria-label="Close edit dialog">×</button>
        </div>
        <div className="dialog-form-grid expense-form-grid">
          <div className="field"><Label>Name</Label><Input required value={values.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div className="field"><Label>Category</Label><Select value={values.category} onValueChange={(value) => update('category', value as FeedCategory)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FEED_CATEGORIES.map((entry) => <SelectItem key={entry} value={entry}>{label(entry)}</SelectItem>)}</SelectContent></Select></div>
          <div className="field"><Label>Base unit</Label><Input list="feed-unit-list-edit" value={values.baseUnit} onChange={(e) => update('baseUnit', e.target.value)} /></div>
          <div className="field"><Label>Purchase unit</Label><Input list="feed-unit-list-edit" value={values.purchaseUnit} onChange={(e) => update('purchaseUnit', e.target.value)} /></div>
          <div className="field"><Label>Base quantity per purchase unit</Label><Input required type="number" min="0.001" step="0.001" inputMode="decimal" value={values.conversion} onChange={(e) => update('conversion', e.target.value)} /><span className="kpi-foot">Example: 1 BAG = 50 KG → enter 50.</span></div>
          <div className="field"><Label>Low-stock threshold ({values.baseUnit || 'base unit'})</Label><Input type="number" min="0" step="0.001" inputMode="decimal" value={values.lowStockThreshold} onChange={(e) => update('lowStockThreshold', e.target.value)} /><span className="kpi-foot">Set 0 to disable low-stock alerts.</span></div>
          <div className="field wide-field"><Label>Notes</Label><Input value={values.notes} onChange={(e) => update('notes', e.target.value)} /></div>
        </div>
        <datalist id="feed-unit-list-edit">{FEED_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <div className="dialog-footer"><button type="button" className="btn secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</button><button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </dialog>
  );
}
