'use client';

import { milkTxt } from '@/lib/farm-format';
import { AppShell } from '@/components/layout/AppShell';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { buffaloMilkQuantitySchema } from '@/lib/buffalo-validation';
import {
  getProductionSheet,
  saveProductionSheet,
  type BuffaloProductionAnimal,
} from './services/buffalo-production.service';
import { localDateKey, type MilkEntryShift } from '@/lib/milk-entry-list';
export default function DailyPerformancePage() {
  const [rows, setRows] = useState<BuffaloProductionAnimal[]>([]),
    [date, setDate] = useState(() => localDateKey(new Date())),
    [shift, setShift] = useState<MilkEntryShift>('MORNING'),
    [values, setValues] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const loadVersion = useRef(0);
  async function load() {
    const version = ++loadVersion.current;
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { buffaloes, production } = await getProductionSheet(supabase, date, shift);
      if (version !== loadVersion.current) return;
      setRows(buffaloes);
      setValues(
        Object.fromEntries(
          buffaloes.map((buffalo) => {
            const saved = production.find((record) => record.buffalo_id === buffalo.id);
            return [buffalo.id, saved ? String(saved.milk_quantity) : ''];
          }),
        ),
      );
    } catch (loadError) {
      if (version === loadVersion.current) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load production.');
      }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [date, shift]);
  const setValue = (id: string, value: string) => {
    setValues((current) => ({ ...current, [id]: value }));
    setMessage('');
  };
  const total = rows.reduce(
      (sum, animal) => sum + (values[animal.id]?.trim() ? Number(values[animal.id]) : 0),
      0,
    ),
    recorded = rows.filter((animal) => values[animal.id]?.trim()).length;
  async function save() {
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const submitted = [] as {
        buffalo_id: string;
        milk_quantity: number;
      }[];
      for (const animal of rows) {
        const value = (values[animal.id] ?? '').trim();
        if (!value) continue;
        const parsed = buffaloMilkQuantitySchema.safeParse(value);
        if (!parsed.success)
          throw new Error(
            `${animal.name || animal.buffalo_code}: ${parsed.error.issues[0]?.message ?? 'Enter a valid quantity.'}`,
          );
        submitted.push({ buffalo_id: animal.id, milk_quantity: parsed.data });
      }
      await saveProductionSheet(supabase, {
        businessDate: date,
        shift,
        buffaloIds: rows.map((animal) => animal.id),
        records: submitted,
      });
      setMessage('Production saved. Blank fields have no record; entered zero is recorded.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save production.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell title="Daily performance" subtitle="Record buffalo milk production by date and shift">
      <div className="card">
        <div className="row production-controls">
          <div>
            <h2 className="section-title">Herd production entry</h2>
            <p className="kpi-foot">
              Active and dry buffaloes are listed; other historical statuses are excluded. Fat,
              feed, health and medicine notes belong to other records.
            </p>
          </div>
          <label className="field production-date">
            <span>Business date</span>
            <input
              type="date"
              className="date-chip"
              value={date}
              disabled={busy}
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
              disabled={busy || loading}
              onClick={() => setShift(value)}
            >
              {value === 'MORNING' ? 'Morning' : 'Evening'}
            </button>
          ))}
        </div>
        <div className="row production-total">
          <span>
            {recorded} of {rows.length} buffaloes recorded
          </span>
          <b>{milkTxt(total)}</b>
        </div>
        {error && (
          <p className="auth-message" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <div className="empty">Loading buffaloes and saved production…</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>BUFFALO</th>
                  <th>MILK (L)</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((animal) => (
                  <tr key={animal.id}>
                    <td>
                      <b>{animal.name || animal.buffalo_code}</b>
                      <div className="kpi-foot">
                        {animal.buffalo_code}
                        {animal.current_status === 'DRY' ? ' · Dry' : ''}
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
                        disabled={busy || loading}
                        value={values[animal.id] ?? ''}
                        onChange={(event) => setValue(animal.id, event.target.value)}
                      />
                    </td>
                    <td>
                      {values[animal.id]?.trim() ? (
                        Number(values[animal.id]) === 0 ? (
                          <span className="tag gold">Recorded · 0 L</span>
                        ) : (
                          <span className="tag">Recorded</span>
                        )
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
        {!loading && !rows.length && (
          <div className="empty">
            No active or dry buffaloes found. Add relevant buffaloes before recording production.
          </div>
        )}
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <button
          className="btn"
          disabled={busy || loading || !rows.length}
          onClick={() => void save()}
        >
          {busy ? 'Saving…' : 'Save production'}
        </button>
      </div>
    </AppShell>
  );
}
