'use client';

import { useState } from 'react';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { FEED_CATEGORIES, FEED_UNITS, type FeedCategory } from '@/lib/feed-types';

export type FeedItemFormValues = {
  name: string;
  category: FeedCategory;
  baseUnit: string;
  purchaseUnit: string;
  conversion: string;
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
    <div className="card">
      <h2 className="section-title">Add feed item</h2>
      <p className="dialog-description">Create a physical feed master for inventory tracking.</p>
      <form onSubmit={submit}>
        <div className="expense-form-grid">
          <div className="field"><label>Name</label><input required value={values.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Poha Churi" /></div>
          <div className="field"><label>Category</label><select value={values.category} onChange={(e) => update('category', e.target.value as FeedCategory)}>{FEED_CATEGORIES.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div>
          <div className="field"><label>Base unit</label><input list="feed-unit-list" value={values.baseUnit} onChange={(e) => update('baseUnit', e.target.value)} placeholder="KG" /></div>
          <div className="field"><label>Purchase unit</label><input list="feed-unit-list" value={values.purchaseUnit} onChange={(e) => update('purchaseUnit', e.target.value)} placeholder="BAG" /></div>
          <div className="field"><label>Base quantity per purchase unit</label><input required type="number" min="0.001" step="0.001" inputMode="decimal" value={values.conversion} onChange={(e) => update('conversion', e.target.value)} /><span className="kpi-foot">Example: 1 BAG = 50 KG → enter 50.</span></div>
          <div className="field wide-field"><label>Notes</label><input value={values.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Optional" /></div>
        </div>
        <datalist id="feed-unit-list">{FEED_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
        {message && <TimedNotice message={message} onDismiss={() => undefined} />}
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Add feed item'}</button>
      </form>
    </div>
  );
}
