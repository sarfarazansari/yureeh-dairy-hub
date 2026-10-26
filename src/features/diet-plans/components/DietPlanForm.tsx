'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-field';
import type { DietBuffaloOption } from '../types';
import type { DietPlanFormValues } from '../diet-plan.schema';
import { dietPlanSchema } from '@/features/diet-plans/diet-plan.schema';

type FeedOption = { id: string; name: string; base_unit: string; category: string };
type Props = {
  feeds: FeedOption[];
  buffaloes: DietBuffaloOption[];
  onDateChange: (date: string) => void;
  onSave: (values: DietPlanFormValues) => Promise<string | null>;
  busy: boolean;
  initialValues?: DietPlanFormValues;
  submitLabel?: string;
};

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const blankItem = () => ({ feedItemId: '', morningQuantity: 0, eveningQuantity: 0 });

export function DietPlanForm({ feeds, buffaloes, onDateChange, onSave, busy, initialValues, submitLabel = 'Save diet plan' }: Props) {
  const [values, setValues] = useState<DietPlanFormValues>(initialValues ?? {
    name: '', notes: '', startDate: localToday(), endDate: '', status: 'ACTIVE', items: [blankItem()], buffaloIds: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submitting = useRef(false);
  const selectedFeedIds = useMemo(() => new Set(values.items.map((item) => item.feedItemId)), [values.items]);

  useEffect(() => {
    onDateChange(values.startDate);
  }, [values.startDate, onDateChange]);

  useEffect(() => {
    if (initialValues) setValues(initialValues);
  }, [initialValues]);

  function setField<K extends keyof DietPlanFormValues>(key: K, value: DietPlanFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  }

  function updateItem(index: number, key: 'feedItemId' | 'morningQuantity' | 'eveningQuantity', value: string | number) {
    setValues((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting.current) return;
    submitting.current = true;
    setErrors({});
    const parsed = dietPlanSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      });
      setErrors(next);
      submitting.current = false;
      return;
    }
    try {
      const error = await onSave(parsed.data);
      if (error) setErrors({ form: error });
    } finally {
      submitting.current = false;
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 className="section-title">Plan details</h2>
      <div className="expense-form-grid">
        <div className="field">
          <Label htmlFor="diet-plan-name">Plan name</Label>
          <Input id="diet-plan-name" value={values.name} maxLength={120} disabled={busy} aria-invalid={!!errors.name} onChange={(e) => setField('name', e.target.value)} />
          {errors.name && <span className="auth-message">{errors.name}</span>}
        </div>
        <div className="field">
          <Label htmlFor="diet-plan-status">Status</Label>
          <Select value={values.status} onValueChange={(value) => setField('status', value as DietPlanFormValues['status'])} disabled={busy}><SelectTrigger id="diet-plan-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="PAUSED">Paused</SelectItem><SelectItem value="STOPPED">Stopped</SelectItem></SelectContent></Select>
        </div>
        <FormField id="diet-plan-start" label="Start date" error={errors.startDate}>
          {(controlProps) => (
            <DatePicker
              {...controlProps}
              value={values.startDate}
              disabled={busy}
              onChange={(value) => { setField('startDate', value); setField('buffaloIds', []); }}
              ariaLabel="Diet plan start date"
            />
          )}
        </FormField>
        <FormField id="diet-plan-end" label="End date (optional)" error={errors.endDate}>
          {(controlProps) => (
            <DatePicker
              {...controlProps}
              min={values.startDate}
              value={values.endDate ?? ''}
              clearable
              disabled={busy}
              onChange={(value) => setField('endDate', value)}
              ariaLabel="Diet plan end date"
            />
          )}
        </FormField>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <Label htmlFor="diet-plan-notes">Notes</Label>
          <Textarea id="diet-plan-notes" rows={2} maxLength={1000} value={values.notes ?? ''} disabled={busy} onChange={(e) => setField('notes', e.target.value)} />
        </div>
      </div>

      <div className="row" style={{ marginTop: 24 }}>
        <h2 className="section-title">Buffalo group</h2>
        <span className="tag">{values.buffaloIds.length} selected</span>
      </div>
      <p className="sub">Only buffaloes active on the plan start date are listed. Feed quantities below are totals for this entire group, not per buffalo.</p>
      <div className="management-stack" style={{ gap: 8, marginTop: 12 }}>
        {buffaloes.map((buffalo) => (
          <Label key={buffalo.id} className="row" style={{ justifyContent: 'flex-start', gap: 10, padding: '8px 0' }}>
            <Checkbox disabled={busy} checked={values.buffaloIds.includes(buffalo.id)} onCheckedChange={(checked) => setField('buffaloIds', checked === true ? [...values.buffaloIds, buffalo.id] : values.buffaloIds.filter((id) => id !== buffalo.id))} />
            <span><b>{buffalo.buffalo_code}</b>{buffalo.name ? ` · ${buffalo.name}` : ''}</span>
          </Label>
        ))}
        {!buffaloes.length && <div className="empty">No eligible buffaloes found for this start date.</div>}
      </div>
      {errors.buffaloIds && <span className="auth-message">{errors.buffaloIds}</span>}

      <div className="row" style={{ marginTop: 28 }}>
        <h2 className="section-title">Feed quantities per feeding</h2>
        <Button type="button" variant="outline" disabled={busy} onClick={() => setField('items', [blankItem(), ...values.items])}>+ Add feed</Button>
      </div>
      {errors.items && <span className="auth-message">{errors.items}</span>}
      <div className="management-stack" style={{ gap: 8, marginTop: 10 }}>
        {values.items.map((item, index) => {
          const feed = feeds.find((candidate) => candidate.id === item.feedItemId);
          return (
            <div className="card" key={`${item.feedItemId || "new"}-${index}`} style={{ padding: 10, borderColor: "var(--line)", background: "#fcfdfc" }}>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.35fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto]">
                <div className="field" style={{ gap: 4 }}>
                  <Label className="text-xs">Feed item</Label>
                  <Select value={item.feedItemId || undefined} onValueChange={(value) => updateItem(index, 'feedItemId', value)} disabled={busy}><SelectTrigger className="h-9"><SelectValue placeholder="Select feed" /></SelectTrigger><SelectContent>{feeds.map((candidate) => <SelectItem key={candidate.id} value={candidate.id} disabled={selectedFeedIds.has(candidate.id) && candidate.id !== item.feedItemId}>{candidate.name}</SelectItem>)}</SelectContent></Select>
                  {feed && <span className="sub text-xs">Unit: {feed.base_unit}</span>}
                </div>
                <div className="field" style={{ gap: 4 }}>
                  <Label className="text-xs">Morning total ({feed?.base_unit ?? 'unit'})</Label>
                  <Input className="h-9" type="number" min="0" step="0.001" disabled={busy} value={item.morningQuantity} onChange={(e) => updateItem(index, 'morningQuantity', e.target.value === '' ? 0 : Number(e.target.value))} />
                </div>
                <div className="field" style={{ gap: 4 }}>
                  <Label className="text-xs">Evening total ({feed?.base_unit ?? 'unit'})</Label>
                  <Input className="h-9" type="number" min="0" step="0.001" disabled={busy} value={item.eveningQuantity} onChange={(e) => updateItem(index, 'eveningQuantity', e.target.value === '' ? 0 : Number(e.target.value))} />
                </div>
                <div className="field" style={{ alignSelf: 'end', paddingBottom: 1 }}>
                  <Button type="button" variant="destructive" size="sm" disabled={busy || values.items.length === 1} onClick={() => setField('items', values.items.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="sub" style={{ marginTop: 12 }}>Scheduled slots: morning and evening (Asia/Kolkata). Exact clock times will be configured with the scheduler in the next phase.</p>
      {errors.form && <div className="auth-message" role="alert">{errors.form}</div>}
      <div className="row" style={{ marginTop: 20 }}>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  );
}
