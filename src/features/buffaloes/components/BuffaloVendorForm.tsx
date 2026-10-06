'use client';

import { useState } from 'react';

import { useUpdateBuffaloVendor } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../types';

export function BuffaloVendorForm({
  buffalo,
  onCancel,
}: {
  buffalo: BuffaloDetail;
  onCancel: () => void;
}) {
  const vendor = buffalo.buffalo_purchases[0]?.vendors;
  const mutation = useUpdateBuffaloVendor();

  const [name, setName] = useState(vendor?.name ?? '');
  const [mobile, setMobile] = useState(vendor?.mobile ?? '');
  const [address, setAddress] = useState(vendor?.address ?? '');
  const [villageCity, setVillageCity] = useState(vendor?.village_city ?? '');
  const [state, setState] = useState(vendor?.state ?? '');
  const [notes, setNotes] = useState(vendor?.notes ?? '');

  async function handleSave() {
    if (!name.trim()) return;

    try {
      await mutation.mutateAsync({
        buffaloId: buffalo.id,
        vendor: { name, mobile, address, village_city: villageCity, state, notes },
      });
      onCancel();
    } catch {
      // Mutation state is shown below.
    }
  }

  return (
    <div className="card">
      <div className="row">
        <div>
          <h2 className="section-title">{vendor ? 'Edit vendor' : 'Add vendor'}</h2>
          <p className="sub">Vendor details are shared with any purchase using this vendor.</p>
        </div>
      </div>

      <div className="grid two">
        <Field label="Vendor Name">
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <Field label="Mobile">
          <input value={mobile} onChange={(event) => setMobile(event.target.value)} />
        </Field>

        <Field label="Village / City">
          <input
            value={villageCity}
            onChange={(event) => setVillageCity(event.target.value)}
          />
        </Field>

        <Field label="State">
          <input value={state} onChange={(event) => setState(event.target.value)} />
        </Field>
      </div>

      <Field label="Address">
        <textarea value={address} onChange={(event) => setAddress(event.target.value)} rows={2} />
      </Field>

      <Field label="Vendor Notes">
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
      </Field>

      {mutation.isError && <p className="auth-message">{mutation.error.message}</p>}

      <button
        className="btn"
        type="button"
        disabled={mutation.isPending}
        onClick={() => void handleSave()}
      >
        {mutation.isPending ? 'Saving…' : 'Save vendor'}
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
