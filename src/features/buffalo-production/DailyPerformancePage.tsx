'use client';

import { useMemo, useState } from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { milkTxt } from '@/lib/farm-format';
import { localDateKey, type MilkEntryShift } from '@/lib/milk-entry-list';
import { buffaloMilkQuantitySchema } from './validation';
import type { BuffaloProductionAnimal } from './types';
import {
  useProductionSheetQuery,
  useSaveProductionSheetMutation,
} from './buffalo-production.queries';

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
  const getFatValue = () => fatValue ?? sheetQuery.data?.fatPercentage ?? '';

  const savedValues = useMemo(
    () => Object.fromEntries(
      production.map((record) => [record.buffalo_id, String(record.milk_quantity)]),
    ),
    [production],
  );
  const getValue = (buffaloId: string) => values[buffaloId] ?? savedValues[buffaloId] ?? '';
  const total = rows.reduce((sum, animal) => {
    const value = getValue(animal.id);
    return sum + (value.trim() ? Number(value) : 0);
  }, 0);
  const recorded = rows.filter((animal) => getValue(animal.id).trim()).length;

  async function save() {
    setMessage('');
    setError('');
    try {
      const submitted: { buffalo_id: string; milk_quantity: number }[] = [];
      for (const animal of rows) {
        const value = getValue(animal.id).trim();
        if (!value) continue;
        const parsed = buffaloMilkQuantitySchema.safeParse(value);
        if (!parsed.success) {
          throw new Error(
            `${animal.name || animal.buffalo_code}: ${parsed.error.issues[0]?.message ?? 'Enter a valid quantity.'}`,
          );
        }
        submitted.push({ buffalo_id: animal.id, milk_quantity: parsed.data });
      }

      const fat = getFatValue().trim();
      if (fat && (!/^\d+(\.\d{1,2})?$/.test(fat) || Number(fat) < 0 || Number(fat) > 100)) {
        throw new Error('Enter pooled milk fat between 0 and 100, with at most 2 decimal places.');
      }

      await saveMutation.mutateAsync({
        businessDate: date,
        shift,
        buffaloIds: rows.map((animal) => animal.id),
        records: submitted,
        fatPercentage: fat ? Number(fat) : null,
      });
      setFatValue(null);
      setMessage('Production and pooled milk fat saved. Blank buffalo fields have no record; entered zero is recorded.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save production.');
    }
  }

  return (
    <AppShell title="Daily performance" subtitle="Record buffalo milk production by date and shift">
      <div className="card">
        <div className="row production-controls">
          <div>
            <h2 className="section-title">Herd production entry</h2>
            <p className="kpi-foot">
              Buffaloes are listed according to their status on the selected date. Only buffaloes that were active on that date are editable. Saving
              production also updates the farm milk pool.
            </p>
          </div>
          <label className="field production-date">
            <span>Business date</span>
            <input
              type="date"
              className="date-chip"
              value={date}
              disabled={saveMutation.isPending}
              onChange={(event) => {
                setDate(event.target.value);
                setValues({});
                setFatValue(null);
              }}
            />
          </label>
        </div>

        <div className="date-range-segment" role="group" aria-label="Production shift">
          {(['MORNING', 'EVENING'] as const).map((value) => (
            <button
              type="button"
              key={value}
              className={`date-chip ${shift === value ? 'active' : ''}`}
              aria-pressed={shift === value}
              disabled={saveMutation.isPending || sheetQuery.isFetching}
              onClick={() => {
                setShift(value);
                setValues({});
                setFatValue(null);
              }}
            >
              {value === 'MORNING' ? 'Morning' : 'Evening'}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginTop: 12, marginBottom: 12, alignItems: 'end' }}>
          <label className="field" style={{ maxWidth: 320, flex: 1 }}>
            <span>Mixed milk fat (%) · {shift === 'MORNING' ? 'Morning' : 'Evening'}</span>
            <input
              aria-label="Mixed milk fat percentage"
              className="date-chip"
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              placeholder="Enter pooled milk fat"
              disabled={saveMutation.isPending || sheetQuery.isFetching}
              value={getFatValue()}
              onChange={(event) => {
                setFatValue(event.target.value);
                setMessage('');
              }}
            />
          </label>
          <span className="kpi-foot">Enter the fat measured from the combined milk, once per shift — not per buffalo.</span>
        </div>

        <div className="row production-total">
          <span>{recorded} of {rows.length} buffaloes recorded</span>
          <b>{milkTxt(total)}</b>
        </div>

        {error && <p className="auth-message" role="alert">{error}</p>}
        {sheetQuery.isError && (
          <p className="auth-message" role="alert">{sheetQuery.error.message}</p>
        )}

        {sheetQuery.isPending ? (
          <div className="empty">Loading buffaloes and saved production…</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>BUFFALO</th><th>MILK (L)</th><th>STATUS</th></tr></thead>
              <tbody>
                {rows.map((animal) => (
                  <tr key={animal.id}>
                    <td>
                      <b>{animal.name || animal.buffalo_code}</b>
                      <div className="kpi-foot">
                        {animal.buffalo_code}
                      </div>
                    </td>
                    <td>
                      <input
                        aria-label={`${animal.name || animal.buffalo_code} milk quantity in litres`}
                        className="date-chip production-input"
                        type="number"
                        min="0"
                        step="0.001"
                        inputMode="decimal"
                        placeholder="No record"
                        disabled={saveMutation.isPending || sheetQuery.isFetching}
                        value={getValue(animal.id)}
                        onChange={(event) => {
                          setValues((current) => ({ ...current, [animal.id]: event.target.value }));
                          setMessage('');
                        }}
                      />
                    </td>
                    <td>
                      {values[animal.id]?.trim() ? (
                        Number(getValue(animal.id)) === 0
                          ? <span className="tag gold">Recorded · 0 L</span>
                          : <span className="tag">Recorded</span>
                      ) : (
                        <span className="kpi-foot">No record</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!sheetQuery.isPending && !rows.length && (
          <div className="empty">No active buffaloes found. Add active buffaloes before recording production.</div>
        )}
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <button className="btn" disabled={saveMutation.isPending || sheetQuery.isPending || !rows.length} onClick={() => void save()}>
          {saveMutation.isPending ? 'Saving…' : 'Save production'}
        </button>
      </div>
    </AppShell>
  );
}
