'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { milkTxt } from '@/lib/farm-format';
import { localDateKey, type MilkEntryShift } from '@/lib/milk-entry-list';
import { buffaloMilkQuantitySchema } from './validation';
import type { BuffaloProductionAnimal } from './types';
import { useProductionSheetQuery, useSaveProductionSheetMutation } from './buffalo-production.queries';

export default function DailyPerformancePage() {
  const [date, setDate] = useState(() => localDateKey());
  const [shift, setShift] = useState<MilkEntryShift>('MORNING');
  const [values, setValues] = useState<Record<string, string>>({});
  const [fatValue, setFatValue] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const sheetQuery = useProductionSheetQuery(date, shift);
  const saveMutation = useSaveProductionSheetMutation();
  const rows: BuffaloProductionAnimal[] = sheetQuery.data?.buffaloes ?? [];
  const production = sheetQuery.data?.production ?? [];
  const savedFat = sheetQuery.data?.fatPercentage ?? '';
  const getFatValue = () => fatValue ?? savedFat;

  const savedValues = useMemo(
    () => Object.fromEntries(production.map((record) => [record.buffalo_id, String(record.milk_quantity)])),
    [production],
  );
  const getValue = (id: string) => values[id] ?? savedValues[id] ?? '';
  const isDirty = (id: string) => Object.prototype.hasOwnProperty.call(values, id) && values[id] !== (savedValues[id] ?? '');
  const savedCount = rows.filter((animal) => Object.prototype.hasOwnProperty.call(savedValues, animal.id)).length;
  const hasFatChanges = fatValue !== null && fatValue !== savedFat;
  const changedCount = rows.filter((animal) => isDirty(animal.id)).length + (hasFatChanges ? 1 : 0);
  const total = rows.reduce((sum, animal) => {
    const value = getValue(animal.id);
    return sum + (value.trim() ? Number(value) : 0);
  }, 0);
  const entered = rows.filter((animal) => getValue(animal.id).trim()).length;

  async function save() {
    setMessage('');
    setError('');
    try {
      const submitted: { buffalo_id: string; milk_quantity: number }[] = [];
      for (const animal of rows) {
        const value = getValue(animal.id).trim();
        if (!value) continue;
        const parsed = buffaloMilkQuantitySchema.safeParse(value);
        if (!parsed.success) throw new Error(`${animal.name || animal.buffalo_code}: ${parsed.error.issues[0]?.message ?? 'Enter a valid quantity.'}`);
        submitted.push({ buffalo_id: animal.id, milk_quantity: parsed.data });
      }
      const fat = getFatValue().trim();
      if (fat && (!/^\d+(\.\d{1,2})?$/.test(fat) || Number(fat) < 0 || Number(fat) > 100)) {
        throw new Error('Enter pooled milk fat between 0 and 100, with at most 2 decimal places.');
      }
      await saveMutation.mutateAsync({
        businessDate: date, shift, buffaloIds: rows.map((animal) => animal.id),
        records: submitted, fatPercentage: fat ? Number(fat) : null,
      });
      setFatValue(null);
      setMessage('Production and pooled milk fat saved. Blank buffalo fields have no record; entered zero is recorded.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save production.');
    }
  }

  function updateQuantity(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
    setMessage('');
    setError('');
  }

  function statusFor(animal: BuffaloProductionAnimal) {
    if (isDirty(animal.id)) return { label: 'Unsaved changes', className: 'production-status production-status-unsaved' };
    if (Object.prototype.hasOwnProperty.call(savedValues, animal.id)) return { label: 'Saved', className: 'production-status production-status-saved' };
    if (getValue(animal.id).trim()) return { label: 'Not saved', className: 'production-status production-status-unsaved' };
    return { label: 'No record', className: 'production-status production-status-empty' };
  }

  return (
    <AppShell title="Daily performance" subtitle="Record buffalo milk production by date and shift">
      <section className="card production-sheet">
        <div className="row production-controls">
          <div className="production-heading">
            <h2 className="section-title">Herd production entry</h2>
            <p className="kpi-foot">Buffaloes are listed according to their status on the selected date. Only buffaloes that were active on that date are editable. Saving production also updates the farm milk pool.</p>
          </div>
          <div className="field production-date">
            <Label htmlFor="production-business-date">Business date</Label>
            <DatePicker id="production-business-date" value={date} max={localDateKey()} disabled={saveMutation.isPending} onChange={(value) => { setDate(value); setValues({}); setFatValue(null); setMessage(''); setError(''); }} ariaLabel="Business date" />
          </div>
        </div>

        <div className="date-range-segment production-shift" role="group" aria-label="Production shift">
          {(['MORNING', 'EVENING'] as const).map((value) => (
            <Button key={value} variant={shift === value ? 'default' : 'outline'} size="sm" type="button"
              className={shift === value ? 'active' : ''} aria-pressed={shift === value}
              disabled={saveMutation.isPending || sheetQuery.isFetching}
              onClick={() => { setShift(value); setValues({}); setFatValue(null); setMessage(''); setError(''); }}>
              {value === 'MORNING' ? 'Morning' : 'Evening'}
            </Button>
          ))}
        </div>

        <div className="production-fat-row">
          <div className="field production-fat-field">
            <Label htmlFor="pooled-milk-fat">Mixed milk fat (%) · {shift === 'MORNING' ? 'Morning' : 'Evening'}</Label>
            <Input id="pooled-milk-fat" type="number" min="0" max="100" step="0.01" inputMode="decimal"
              placeholder="Enter pooled milk fat" disabled={saveMutation.isPending || sheetQuery.isFetching}
              value={getFatValue()} aria-describedby="pooled-milk-fat-help"
              onChange={(event) => { setFatValue(event.target.value); setMessage(''); setError(''); }} />
          </div>
          <p id="pooled-milk-fat-help" className="kpi-foot">Enter the fat measured from the combined milk, once per shift — not per buffalo.</p>
        </div>

        <div className="production-summary" aria-live="polite">
          <div className="production-summary-stat"><span className="production-summary-label">Saved records</span><strong>{savedCount}<span> / {rows.length}</span></strong></div>
          <div className="production-summary-stat"><span className="production-summary-label">Current total</span><strong>{milkTxt(total)}</strong></div>
          <div className="production-summary-stat"><span className="production-summary-label">Unsaved changes</span><strong>{changedCount}</strong></div>
        </div>

        {error && <p className="auth-message" role="alert">{error}</p>}
        {sheetQuery.isError && <p className="auth-message" role="alert">{sheetQuery.error.message}</p>}
        {sheetQuery.isPending ? <div className="empty">Loading buffaloes and saved production…</div> : (
          <>
            <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)] production-desktop-table"><Table className="production-table min-w-[650px]"><TableHeader><TableRow><TableHead>BUFFALO</TableHead><TableHead>MILK (L)</TableHead><TableHead>STATUS</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map((animal) => { const status = statusFor(animal); return <TableRow key={animal.id}><TableCell><b>{animal.name || animal.buffalo_code}</b><div className="text-xs text-muted-foreground">{animal.buffalo_code}</div></TableCell><TableCell><Input aria-label={`${animal.name || animal.buffalo_code} milk quantity in litres`} className="production-input" type="number" min="0" step="0.001" inputMode="decimal" placeholder="No record" disabled={saveMutation.isPending || sheetQuery.isFetching} value={getValue(animal.id)} onChange={(event) => updateQuantity(animal.id, event.target.value)} /></TableCell><TableCell><span className={status.className}>{status.label}</span></TableCell></TableRow>; })}</TableBody>
            </Table></div>
            <div className="production-mobile-list">
              {rows.map((animal) => {
                const status = statusFor(animal);
                return <article className="production-animal-card" key={animal.id}>
                  <div className="production-animal-heading">
                    <div className="production-animal-identity"><b>{animal.name || animal.buffalo_code}</b><span className="kpi-foot">{animal.buffalo_code}</span></div>
                    <span className={status.className}>{status.label}</span>
                  </div>
                  <div className="field production-mobile-quantity">
                    <Label htmlFor={`milk-${animal.id}`}>Milk quantity (L)</Label>
                    <Input id={`milk-${animal.id}`} type="number" min="0" step="0.001" inputMode="decimal" placeholder="No record"
                      disabled={saveMutation.isPending || sheetQuery.isFetching} value={getValue(animal.id)}
                      onChange={(event) => updateQuantity(animal.id, event.target.value)} />
                  </div>
                </article>;
              })}
            </div>
          </>
        )}
        {!sheetQuery.isPending && !rows.length && <div className="empty">No active buffaloes found. Add active buffaloes before recording production.</div>}
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <div className="production-save-bar">
          <div className="production-save-context"><span>{entered} of {rows.length} filled</span><strong>{milkTxt(total)}</strong></div>
          <Button className="production-save-button" type="button" disabled={saveMutation.isPending || sheetQuery.isPending || !rows.length || sheetQuery.isFetching} onClick={() => void save()}>
            {saveMutation.isPending ? 'Saving production…' : 'Save production'}
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
