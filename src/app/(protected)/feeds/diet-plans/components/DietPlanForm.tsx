'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DietBuffaloOption, DietPlanFormValues } from '@/lib/diet-plan-types';
import { dietPlanSchema } from '../schema';

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
          <label htmlFor="diet-plan-name">Plan name</label>
          <input id="diet-plan-name" value={values.name} maxLength={120} onChange={(e) => setField('name', e.target.value)} />
          {errors.name && <span className="auth-message">{errors.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="diet-plan-status">Status</label>
          <select id="diet-plan-status" value={values.status} onChange={(e) => setField('status', e.target.value as DietPlanFormValues['status'])}>
            <option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="STOPPED">Stopped</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="diet-plan-start">Start date</label>
          <input id="diet-plan-start" type="date" value={values.startDate} onChange={(e) => { setField('startDate', e.target.value); setField('buffaloIds', []); }} />
          {errors.startDate && <span className="auth-message">{errors.startDate}</span>}
        </div>
        <div className="field">
          <label htmlFor="diet-plan-end">End date (optional)</label>
          <input id="diet-plan-end" type="date" min={values.startDate} value={values.endDate ?? ''} onChange={(e) => setField('endDate', e.target.value)} />
          {errors.endDate && <span className="auth-message">{errors.endDate}</span>}
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="diet-plan-notes">Notes</label>
          <textarea id="diet-plan-notes" rows={2} maxLength={1000} value={values.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} />
        </div>
      </div>

      <div className="row" style={{ marginTop: 24 }}>
        <h2 className="section-title">Buffalo group</h2>
        <span className="tag">{values.buffaloIds.length} selected</span>
      </div>
      <p className="sub">Only buffaloes active on the plan start date are listed. Feed quantities below are totals for this entire group, not per buffalo.</p>
      <div className="management-stack" style={{ gap: 8, marginTop: 12 }}>
        {buffaloes.map((buffalo) => (
          <label key={buffalo.id} className="row" style={{ justifyContent: 'flex-start', gap: 10, padding: '8px 0' }}>
            <input type="checkbox" checked={values.buffaloIds.includes(buffalo.id)} onChange={(e) => setField('buffaloIds', e.target.checked ? [...values.buffaloIds, buffalo.id] : values.buffaloIds.filter((id) => id !== buffalo.id))} />
            <span><b>{buffalo.buffalo_code}</b>{buffalo.name ? ` · ${buffalo.name}` : ''}</span>
          </label>
        ))}
        {!buffaloes.length && <div className="empty">No eligible buffaloes found for this start date.</div>}
      </div>
      {errors.buffaloIds && <span className="auth-message">{errors.buffaloIds}</span>}

      <div className="row" style={{ marginTop: 28 }}>
        <h2 className="section-title">Feed quantities per feeding</h2>
        <button type="button" className="date-chip" onClick={() => setField('items', [...values.items, blankItem()])}>Add feed</button>
      </div>
      {errors.items && <span className="auth-message">{errors.items}</span>}
      <div className="management-stack" style={{ gap: 12 }}>
        {values.items.map((item, index) => {
          const feed = feeds.find((candidate) => candidate.id === item.feedItemId);
          return (
            <div className="card" key={index} style={{ padding: 14 }}>
              <div className="expense-form-grid">
                <div className="field">
                  <label>Feed item</label>
                  <select value={item.feedItemId} onChange={(e) => updateItem(index, 'feedItemId', e.target.value)}>
                    <option value="">Select feed</option>
                    {feeds.map((candidate) => <option key={candidate.id} value={candidate.id} disabled={selectedFeedIds.has(candidate.id) && candidate.id !== item.feedItemId}>{candidate.name}</option>)}
                  </select>
                  {feed && <span className="sub">Unit: {feed.base_unit}</span>}
                </div>
                <div className="field">
                  <label>Morning total ({feed?.base_unit ?? 'unit'})</label>
                  <input type="number" min="0" step="0.001" value={item.morningQuantity} onChange={(e) => updateItem(index, 'morningQuantity', e.target.value === '' ? 0 : Number(e.target.value))} />
                </div>
                <div className="field">
                  <label>Evening total ({feed?.base_unit ?? 'unit'})</label>
                  <input type="number" min="0" step="0.001" value={item.eveningQuantity} onChange={(e) => updateItem(index, 'eveningQuantity', e.target.value === '' ? 0 : Number(e.target.value))} />
                </div>
                <div className="field" style={{ alignSelf: 'end' }}>
                  <button type="button" className="date-chip" disabled={values.items.length === 1} onClick={() => setField('items', values.items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="sub" style={{ marginTop: 12 }}>Scheduled slots: morning 7:00 AM and evening 7:00 PM (Asia/Kolkata). Automatic inventory posting is added in the next phase.</p>
      {errors.form && <div className="auth-message" role="alert">{errors.form}</div>}
      <div className="row" style={{ marginTop: 20 }}>
        <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}
