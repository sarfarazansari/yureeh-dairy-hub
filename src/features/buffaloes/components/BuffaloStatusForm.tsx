'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { localDateKey } from '@/lib/milk-entry-list';
import { useChangeBuffaloStatus } from '../hooks/use-buffaloes';
import { BUFFALO_STATUSES, type BuffaloDetail } from '../types';

export function BuffaloStatusForm({ buffalo }: { buffalo: BuffaloDetail }) {
  const mutation = useChangeBuffaloStatus();
  const isTerminal = ['SOLD', 'DECEASED', 'OTHER'].includes(buffalo.current_status);
  const statuses = BUFFALO_STATUSES.filter((value) => !['SOLD', 'DECEASED', 'OTHER'].includes(value) || value === buffalo.current_status);
  const [status, setStatus] = useState<(typeof statuses)[number]>(buffalo.current_status as (typeof statuses)[number]);
  const [effectiveDate, setEffectiveDate] = useState(localDateKey());
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === buffalo.current_status) return;
    if (!effectiveDate || effectiveDate > localDateKey()) { setMessage('Effective date cannot be in the future.'); return; }
    setMessage('');
    try {
      await mutation.mutateAsync({ buffaloId: buffalo.id, status, effectiveDate, notes });
      setNotes('');
    } catch {
      // Mutation error is rendered below.
    }
  }

  return (
    <form className="card space-y-4" onSubmit={handleSave} noValidate>
      <h2 className="section-title">Buffalo status</h2>
      <p className="sub">Current status: <b>{buffalo.current_status}</b>. Sale, death, and other permanent removals must use the transaction workflows.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Status"><Select disabled={isTerminal} value={status} onValueChange={(value) => setStatus(value as (typeof statuses)[number])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Effective date"><DatePicker value={effectiveDate} max={localDateKey()} onChange={setEffectiveDate} ariaLabel="Effective date" /></Field>
      </div>
      <Field label="Reason / notes"><Textarea value={notes} rows={2} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" /></Field>
      {(message || mutation.isError) && <p role="alert" className="auth-message">{message || mutation.error?.message}</p>}
      <Button type="submit" disabled={isTerminal || mutation.isPending || status === buffalo.current_status}>{mutation.isPending ? 'Saving…' : 'Save status change'}</Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><Label>{label}</Label>{children}</div>;
}
