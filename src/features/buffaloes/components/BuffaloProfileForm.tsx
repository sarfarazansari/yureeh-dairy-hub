'use client';

import { useState } from 'react';

import { useUpdateBuffaloProfile } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../types';

export function BuffaloProfileForm({
  buffalo,
  onCancel,
}: {
  buffalo: BuffaloDetail;
  onCancel: () => void;
}) {
  const mutation = useUpdateBuffaloProfile();
  const [code, setCode] = useState(buffalo.buffalo_code);
  const [name, setName] = useState(buffalo.name ?? '');
  const [breed, setBreed] = useState(buffalo.breed ?? '');
  const [color, setColor] = useState(buffalo.color ?? '');
  const [identificationMark, setIdentificationMark] = useState(
    buffalo.identification_mark ?? '',
  );
  const [ageMonths, setAgeMonths] = useState(
    buffalo.age_at_purchase_months == null ? '' : String(buffalo.age_at_purchase_months),
  );
  const [notes, setNotes] = useState(buffalo.notes ?? '');

  async function handleSave() {
    if (!code.trim() || !breed.trim()) return;

    const age = ageMonths.trim() ? Number(ageMonths) : null;

    if (age !== null && (!Number.isInteger(age) || age < 0)) {
      return;
    }

    try {
      await mutation.mutateAsync({
        buffaloId: buffalo.id,
        profile: {
          buffalo_code: code,
          name,
          breed,
          color,
          identification_mark: identificationMark,
          age_at_purchase_months: age,
          notes,
        },
      });

      onCancel();
    } catch {
      // The mutation error is rendered below.
    }
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <h2 className="section-title">Edit buffalo profile</h2>

      <div className="grid two">
        <Field label="Buffalo Code">
          <input value={code} onChange={(event) => setCode(event.target.value)} />
        </Field>

        <Field label="Name">
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <Field label="Breed">
          <input value={breed} onChange={(event) => setBreed(event.target.value)} />
        </Field>

        <Field label="Color">
          <input value={color} onChange={(event) => setColor(event.target.value)} />
        </Field>

        <Field label="Identification Mark">
          <input
            value={identificationMark}
            onChange={(event) => setIdentificationMark(event.target.value)}
          />
        </Field>

        <Field label="Age at Purchase · Months">
          <input
            type="number"
            min="0"
            step="1"
            value={ageMonths}
            onChange={(event) => setAgeMonths(event.target.value)}
          />
        </Field>
      </div>

      <Field label="Notes">
        <input value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      {mutation.isError && <p className="auth-message">{mutation.error.message}</p>}

      <button className="btn" type="button" disabled={mutation.isPending} onClick={() => void handleSave()}>
        {mutation.isPending ? 'Saving…' : 'Save changes'}
      </button>{' '}
      <button className="btn" type="button" disabled={mutation.isPending} onClick={onCancel}>
        Cancel
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
