'use client';

import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: FeedItemFormValues) => Promise<string | null>;
  busy: boolean;
};

const label = (value: string) => value.replaceAll('_', ' ');
const initialValues: FeedItemFormValues = {
  name: '', category: 'CONCENTRATE', baseUnit: 'KG', purchaseUnit: 'KG',
  conversion: '1', lowStockThreshold: '0', notes: '',
};

export function FeedItemForm({ open, onOpenChange, onSave, busy }: Props) {
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    if (!open) setValues(initialValues);
  }, [open]);

  function update<K extends keyof FeedItemFormValues>(key: K, value: FeedItemFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    try {
      const error = await onSave(values);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success('Feed item created.');
      setValues(initialValues);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save feed item.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!busy) onOpenChange(nextOpen); }}>
      <DialogContent className="app-dialog max-h-[min(90dvh,48rem)] overflow-y-auto feed-item-add-dialog">
        <form onSubmit={submit}>
          <DialogHeader className="mb-5">
            <p className="eyebrow">FEED MASTER</p>
            <DialogTitle>Add feed item</DialogTitle>
            <DialogDescription>Create a physical feed master for purchase, inventory and consumption tracking.</DialogDescription>
          </DialogHeader>
          <fieldset disabled={busy} className="dialog-form-grid min-w-0 border-0 p-0">
            <div className="field"><Label htmlFor="feed-add-name">Name</Label><Input id="feed-add-name" required value={values.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Poha Churi" autoComplete="off" /></div>
            <div className="field"><Label htmlFor="feed-add-category">Category</Label><Select value={values.category} onValueChange={(value) => update('category', value as FeedCategory)}><SelectTrigger id="feed-add-category"><SelectValue /></SelectTrigger><SelectContent>{FEED_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{label(item)}</SelectItem>)}</SelectContent></Select></div>
            <div className="field"><Label htmlFor="feed-add-base-unit">Base unit</Label><Input id="feed-add-base-unit" list="feed-add-unit-list" value={values.baseUnit} onChange={(e) => update('baseUnit', e.target.value)} placeholder="KG" required /></div>
            <div className="field"><Label htmlFor="feed-add-purchase-unit">Purchase unit</Label><Input id="feed-add-purchase-unit" list="feed-add-unit-list" value={values.purchaseUnit} onChange={(e) => update('purchaseUnit', e.target.value)} placeholder="BAG" required /></div>
            <div className="field"><Label htmlFor="feed-add-conversion">Base quantity per purchase unit</Label><Input id="feed-add-conversion" required type="number" min="0.001" step="0.001" inputMode="decimal" value={values.conversion} onChange={(e) => update('conversion', e.target.value)} /><span className="kpi-foot">Example: 1 BAG = 50 KG → enter 50.</span></div>
            <div className="field"><Label htmlFor="feed-add-threshold">Low-stock threshold ({values.baseUnit || 'base unit'})</Label><Input id="feed-add-threshold" type="number" min="0" step="0.001" inputMode="decimal" value={values.lowStockThreshold} onChange={(e) => update('lowStockThreshold', e.target.value)} /><span className="kpi-foot">Set 0 to disable low-stock alerts.</span></div>
            <div className="field wide-field"><Label htmlFor="feed-add-notes">Notes (optional)</Label><Textarea id="feed-add-notes" rows={2} value={values.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Add a note if needed" /></div>
          </fieldset>
          <datalist id="feed-add-unit-list">{FEED_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
          <DialogFooter className="mt-5">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Saving…</> : 'Add feed item'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
