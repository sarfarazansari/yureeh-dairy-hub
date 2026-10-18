'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FEED_CATEGORIES, FEED_UNITS, type FeedCategory, type FeedItem } from '../types';
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
    name: '', category: 'CONCENTRATE', baseUnit: 'KG', purchaseUnit: 'KG',
    conversion: '1', lowStockThreshold: '0', notes: '',
  });

  useEffect(() => {
    if (!item || !open) return;
    setValues({
      name: item.name,
      category: item.category,
      baseUnit: item.base_unit,
      purchaseUnit: item.purchase_unit,
      conversion: String(item.purchase_unit_quantity),
      lowStockThreshold: String(item.low_stock_threshold ?? 0),
      notes: item.notes ?? '',
    });
  }, [item, open]);

  function update<K extends keyof FeedItemFormValues>(key: K, value: FeedItemFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!item || busy) return;
    try {
      const error = await onSave(values, item.id);
      if (error) toast.error(error);
      else {
        toast.success('Feed item updated.');
        onOpenChange(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save feed item.');
    }
  }

  return (
    <Dialog open={open && !!item} onOpenChange={onOpenChange}>
      <DialogContent className="app-dialog max-h-[min(90dvh,48rem)] overflow-y-auto feed-item-edit-dialog">
        <form onSubmit={submit}>
          <DialogHeader className="mb-5">
            <p className="eyebrow">FEED MASTER</p>
            <DialogTitle>Edit feed item</DialogTitle>
            <DialogDescription>Update the feed definition used for inventory and consumption tracking.</DialogDescription>
          </DialogHeader>
          <fieldset disabled={busy} className="dialog-form-grid expense-form-grid min-w-0 border-0 p-0">
            <div className="field"><Label htmlFor="feed-edit-name">Name</Label><Input id="feed-edit-name" required value={values.name} onChange={(e) => update('name', e.target.value)} /></div>
            <div className="field"><Label htmlFor="feed-edit-category">Category</Label><Select value={values.category} disabled={busy} onValueChange={(value) => update('category', value as FeedCategory)}><SelectTrigger id="feed-edit-category"><SelectValue /></SelectTrigger><SelectContent>{FEED_CATEGORIES.map((entry) => <SelectItem key={entry} value={entry}>{label(entry)}</SelectItem>)}</SelectContent></Select></div>
            <div className="field"><Label htmlFor="feed-edit-base-unit">Base unit</Label><Input id="feed-edit-base-unit" list="feed-unit-list-edit" value={values.baseUnit} onChange={(e) => update('baseUnit', e.target.value)} /></div>
            <div className="field"><Label htmlFor="feed-edit-purchase-unit">Purchase unit</Label><Input id="feed-edit-purchase-unit" list="feed-unit-list-edit" value={values.purchaseUnit} onChange={(e) => update('purchaseUnit', e.target.value)} /></div>
            <div className="field"><Label htmlFor="feed-edit-conversion">Base quantity per purchase unit</Label><Input id="feed-edit-conversion" required type="number" min="0.001" step="0.001" inputMode="decimal" value={values.conversion} onChange={(e) => update('conversion', e.target.value)} /><span className="kpi-foot">Example: 1 BAG = 50 KG → enter 50.</span></div>
            <div className="field"><Label htmlFor="feed-edit-threshold">Low-stock threshold ({values.baseUnit || 'base unit'})</Label><Input id="feed-edit-threshold" type="number" min="0" step="0.001" inputMode="decimal" value={values.lowStockThreshold} onChange={(e) => update('lowStockThreshold', e.target.value)} /><span className="kpi-foot">Set 0 to disable low-stock alerts.</span></div>
            <div className="field wide-field"><Label htmlFor="feed-edit-notes">Notes</Label><Textarea id="feed-edit-notes" rows={2} value={values.notes} onChange={(e) => update('notes', e.target.value)} /></div>
          </fieldset>
          <datalist id="feed-unit-list-edit">{FEED_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
          <DialogFooter className="mt-5">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true" />Saving…</> : 'Save changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
