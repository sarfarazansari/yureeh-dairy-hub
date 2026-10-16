'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateBuffaloVendor } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../types';

export function BuffaloVendorForm({ buffalo, onCancel }: { buffalo: BuffaloDetail; onCancel: () => void }) {
  const vendor = buffalo.buffalo_purchases[0]?.vendors;
  const mutation = useUpdateBuffaloVendor();
  const [name, setName] = useState(vendor?.name ?? '');
  const [mobile, setMobile] = useState(vendor?.mobile ?? '');
  const [address, setAddress] = useState(vendor?.address ?? '');
  const [villageCity, setVillageCity] = useState(vendor?.village_city ?? '');
  const [state, setState] = useState(vendor?.state ?? '');
  const [notes, setNotes] = useState(vendor?.notes ?? '');
  const [message, setMessage] = useState('');

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setMessage('Vendor name is required.'); return; }
    setMessage('');
    try {
      await mutation.mutateAsync({ buffaloId: buffalo.id, vendor: { name: name.trim(), mobile: mobile.trim(), address: address.trim(), village_city: villageCity.trim(), state: state.trim(), notes: notes.trim() } });
      onCancel();
    } catch {
      // Mutation error is rendered below.
    }
  }

  return (
    <form className="card space-y-4" onSubmit={handleSave} noValidate>
      <div><h2 className="section-title">{vendor ? 'Edit vendor' : 'Add vendor'}</h2><p className="sub">Vendor details are shared with any purchase using this vendor.</p></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Vendor name"><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Mobile"><Input value={mobile} onChange={(event) => setMobile(event.target.value)} /></Field>
        <Field label="Village / city"><Input value={villageCity} onChange={(event) => setVillageCity(event.target.value)} /></Field>
        <Field label="State"><Input value={state} onChange={(event) => setState(event.target.value)} /></Field>
      </div>
      <Field label="Address"><Textarea value={address} rows={2} onChange={(event) => setAddress(event.target.value)} /></Field>
      <Field label="Vendor notes"><Textarea value={notes} rows={2} onChange={(event) => setNotes(event.target.value)} /></Field>
      {(message || mutation.isError) && <p role="alert" className="auth-message">{message || mutation.error?.message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save vendor'}</Button>
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><Label>{label}</Label>{children}</div>;
}
