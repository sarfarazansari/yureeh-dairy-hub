'use client';

import { useEffect, useMemo, useState } from 'react';

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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sheetQuery = useProductionSheetQuery(date, shift);
  const saveMutation = useSaveProductionSheetMutation();
  const rows: BuffaloProductionAnimal[] = sheetQuery.data?.buffaloes ?? [];

  useEffect(() => {
    const production = sheetQuery.data?.production ?? [];
    setValues(
      Object.fromEntries(
        rows.map((buffalo) => {
          const saved = production.find((record) => record.buffalo_id === buffalo.id);
          return [buffalo.id, saved ? String(saved.milk_quantity) : ''];
        }),
      ),
    );
  }, [sheetQuery.data, rows]);

  const total = useMemo(
    () =>
      rows.reduce(
        (sum, animal) => sum + (values[animal.id]?.trim() ? Number(values[animal.id]) : 0),
        0,
      ),
    [rows, values],
  );
  const recorded = rows.filter((animal) => values[animal.id]?.trim()).length;

  async function save() {
    setMessage('');
    setError('');
    try {
      const submitted: { buffalo_id: string; milk_quantity: number }[] = [];
      for (const animal of rows) {
        const value = (values[animal.id] ?? '').trim();
        if (!value) continue;
        const parsed = buffaloMilkQuantitySchema.safeParse(value);
        if (!parsed.success) {
          throw new Error(
            `${animal.name || animal.buffalo_code}: ${parsed.error.issues[0]?.message ?? 'Enter a valid quantity.'}`,
          );
        }
        submitted.push({ buffalo_id: animal.id, milk_quantity: parsed.data });
      }

      await saveMutation.mutateAsync({
        businessDate: date,
        shift,
        buffaloIds: rows.map((animal) => animal.id),
        records: submitted,
      });
      setMessage('Production saved. Blank fields have no record; entered zero is recorded.');
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
              Active and dry buffaloes are listed; other historical statuses are excluded. Saving
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
              onChange={(event) => setDate(event.target.value)}
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
              onClick={() => setShift(value)}
            >
              {value === 'MORNING' ? 'Morning' : 'Evening'}
            </button>
          ))}
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
                        {animal.buffalo_code}{animal.current_status === 'DRY' ? ' · Dry' : ''}
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
                        value={values[animal.id] ?? ''}
                        onChange={(event) => {
                          setValues((current) => ({ ...current, [animal.id]: event.target.value }));
                          setMessage('');
                        }}
                      />
                    </td>
                    <td>
                      {values[animal.id]?.trim() ? (
                        Number(values[animal.id]) === 0
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
          <div className="empty">No active or dry buffaloes found. Add relevant buffaloes before recording production.</div>
        )}
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <button className="btn" disabled={saveMutation.isPending || sheetQuery.isPending || !rows.length} onClick={() => void save()}>
          {saveMutation.isPending ? 'Saving…' : 'Save production'}
        </button>
      </div>
    </AppShell>
  );
}
