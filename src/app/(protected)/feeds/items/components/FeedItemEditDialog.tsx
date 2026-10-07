'use client';

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
    name: '', category: 'CONCENTRATE', baseUnit: 'KG', purchaseUnit: 'KG', conversion: '1', notes: '',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!item || !open) return;
    setValues({ name: item.name, category: item.category, baseUnit: item.base_unit, purchaseUnit: item.purchase_unit, conversion: String(item.purchase_unit_quantity), notes: item.notes ?? '' });
    setMessage('');
  }, [item, open]);

  if (!open || !item) return null;

  function update<K extends keyof FeedItemFormValues>(key: K, value: FeedItemFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
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
          <div className="field"><label>Name</label><input required value={values.name} onChange={(e) => update('name', e.target.value)} /></div>
          <div className="field"><label>Category</label><select value={values.category} onChange={(e) => update('category', e.target.value as FeedCategory)}>{FEED_CATEGORIES.map((entry) => <option key={entry} value={entry}>{label(entry)}</option>)}</select></div>
          <div className="field"><label>Base unit</label><input list="feed-unit-list-edit" value={values.baseUnit} onChange={(e) => update('baseUnit', e.target.value)} /></div>
          <div className="field"><label>Purchase unit</label><input list="feed-unit-list-edit" value={values.purchaseUnit} onChange={(e) => update('purchaseUnit', e.target.value)} /></div>
          <div className="field"><label>Base quantity per purchase unit</label><input required type="number" min="0.001" step="0.001" inputMode="decimal" value={values.conversion} onChange={(e) => update('conversion', e.target.value)} /><span className="kpi-foot">Example: 1 BAG = 50 KG → enter 50.</span></div>
          <div className="field wide-field"><label>Notes</label><input value={values.notes} onChange={(e) => update('notes', e.target.value)} /></div>
        </div>
        <datalist id="feed-unit-list-edit">{FEED_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <div className="dialog-footer"><button type="button" className="btn secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</button><button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </dialog>
  );
}
