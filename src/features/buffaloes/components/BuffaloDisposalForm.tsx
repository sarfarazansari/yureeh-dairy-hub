'use client';

import { useState } from 'react';
import { useRecordBuffaloDisposal } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../types';
import { buffaloDisposalSchema } from '../disposition.validation';
import { DispositionField, getDispositionToday } from './DispositionField';

export function BuffaloDisposalForm({ buffalo }: { buffalo: BuffaloDetail }) {
  const mutation = useRecordBuffaloDisposal();
  const [type, setType] = useState<'DEATH' | 'TRANSFER_OUT' | 'OTHER'>('DEATH');
  const [date, setDate] = useState(getDispositionToday());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const parsed = buffaloDisposalSchema.safeParse({ disposal_type: type, effective_date: date, reason, notes });
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? 'Check the disposal details.'); return; }
    try {
      await mutation.mutateAsync({ buffaloId: buffalo.id, input: parsed.data });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not record disposal.');
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 className="section-title">Record non-sale disposal</h2>
      <p className="sub">Use this for death, transfer out, or another permanent removal. A disposal cannot be undone through status editing.</p>
      <div className="grid two">
        <DispositionField label="Disposal type"><select value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="DEATH">Death</option><option value="TRANSFER_OUT">Transfer out</option><option value="OTHER">Other</option></select></DispositionField>
        <DispositionField label="Effective date"><input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></DispositionField>
        <DispositionField label="Reason"><input required value={reason} onChange={(e) => setReason(e.target.value)} /></DispositionField>
        <DispositionField label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></DispositionField>
      </div>
      {(message || mutation.isError) && <p className="auth-message">{message || mutation.error?.message}</p>}
      <button className="btn" disabled={mutation.isPending}>{mutation.isPending ? 'Recording…' : 'Record disposal'}</button>
    </form>
  );
}
