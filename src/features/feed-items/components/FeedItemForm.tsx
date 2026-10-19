'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

import { useState } from 'react';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { FEED_CATEGORIES, FEED_UNITS, type FeedCategory } from '../types';

export type FeedItemFormValues = {
  name: string;
  category: FeedCategory;
  baseUnit: string;
  purchaseUnit: string;
  conversion: string;
  lowStockThreshold: string;
  notes: string;
};

type Props = {
  onSave: (values: FeedItemFormValues) => Promise<string | null>;
  busy: boolean;
  message: string;
};

const label = (value: string) => value.replaceAll('_', ' ');

const initialValues: FeedItemFormValues = {
  name: '',
  category: 'CONCENTRATE',
  baseUnit: 'KG',
  purchaseUnit: 'KG',
  conversion: '1',
  lowStockThreshold: '0',
  notes: '',
};

export function FeedItemForm({ onSave, busy, message }: Props) {
  const [values, setValues] = useState(initialValues);

  function update<K extends keyof FeedItemFormValues>(key: K, value: FeedItemFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const error = await onSave(values);
    if (!error) setValues(initialValues);
  }

  return (
    <div className="card space-y-3">
      <h2 className="section-title">Add feed item</h2>
      <p className="dialog-description">Create a physical feed master for inventory tracking.</p>
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="field"><Label htmlFor="feed-name">Name</Label><Input id="feed-name" required disabled={busy} value={values.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Poha Churi" /></div>
          <div className="field"><Label htmlFor="feed-category">Category</Label><Select value={values.category} disabled={busy} onValueChange={(value) => update('category', value as FeedCategory)}><SelectTrigger id="feed-category"><SelectValue /></SelectTrigger><SelectContent>{FEED_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select></div>
          <div className="field"><Label htmlFor="feed-base-unit">Base unit</Label><Input id="feed-base-unit" list="feed-unit-list" disabled={busy} value={values.baseUnit} onChange={(e) => update('baseUnit', e.target.value)} placeholder="KG" /></div>
          <div className="field"><Label htmlFor="feed-purchase-unit">Purchase unit</Label><Input id="feed-purchase-unit" list="feed-unit-list" disabled={busy} value={values.purchaseUnit} onChange={(e) => update('purchaseUnit', e.target.value)} placeholder="BAG" /></div>
          <div className="field"><Label htmlFor="feed-conversion">Base quantity per purchase unit</Label><Input id="feed-conversion" required type="number" min="0.001" step="0.001" inputMode="decimal" disabled={busy} value={values.conversion} onChange={(e) => update('conversion', e.target.value)} /><span className="kpi-foot">Example: 1 BAG = 50 KG → enter 50.</span></div>
          <div className="field"><Label htmlFor="feed-threshold">Low-stock threshold ({values.baseUnit || 'base unit'})</Label><Input id="feed-threshold" type="number" min="0" step="0.001" inputMode="decimal" disabled={busy} value={values.lowStockThreshold} onChange={(e) => update('lowStockThreshold', e.target.value)} /><span className="kpi-foot">Set 0 to disable low-stock alerts.</span></div>
          <div className="field wide-field"><Label htmlFor="feed-notes">Notes</Label><Textarea id="feed-notes" rows={2} disabled={busy} value={values.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Optional" /></div>
        </div>
        <datalist id="feed-unit-list">{FEED_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
        {message && <TimedNotice message={message} onDismiss={() => undefined} />}
        <Button className="text-white" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add feed item'}</Button>
      </form>
    </div>
  );
}
