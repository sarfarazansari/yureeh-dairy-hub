'use client';

import { useState } from 'react';

import { useChangeBuffaloStatus } from '../hooks/use-buffaloes';
import { BUFFALO_STATUSES, type BuffaloDetail } from '../types';



export function BuffaloStatusForm({ buffalo }: { buffalo: BuffaloDetail }) {
  const mutation = useChangeBuffaloStatus();

  const isTerminal = ['SOLD', 'DECEASED', 'OTHER'].includes(buffalo.current_status);
  const STATUSES = BUFFALO_STATUSES.filter((value) =>
    !['SOLD', 'DECEASED', 'OTHER'].includes(value) || value === buffalo.current_status,
  );
  const [status, setStatus] = useState<(typeof STATUSES)[number]>(
    buffalo.current_status as (typeof STATUSES)[number],
  );
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');

  async function handleSave() {
    if (status === buffalo.current_status) return;

    try {
      await mutation.mutateAsync({
        buffaloId: buffalo.id,
        status,
        effectiveDate,
        notes,
      });

      setNotes('');
    } catch {
      // The mutation error is rendered below.
    }
  }

  return (
    <div className="card">
      <h2 className="section-title">Buffalo status</h2>
      <p className="sub">
        Current status: <b>{buffalo.current_status}</b>. Sale, death, and other permanent removals must use the transaction workflows.
      </p>

      <div className="grid two">
        <Field label="Status">
          <select
            disabled={isTerminal}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as (typeof STATUSES)[number])
            }
          >
            {STATUSES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>

        <Field label="Effective Date">
          <input
            type="date"
            value={effectiveDate}
            onChange={(event) => setEffectiveDate(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Reason / Notes">
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional"
        />
      </Field>

      {mutation.isError && <p className="auth-message">{mutation.error.message}</p>}

      <button
        className="btn"
        type="button"
        disabled={isTerminal || mutation.isPending || status === buffalo.current_status}
        onClick={() => void handleSave()}
      >
        {mutation.isPending ? 'Saving…' : 'Save status change'}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
