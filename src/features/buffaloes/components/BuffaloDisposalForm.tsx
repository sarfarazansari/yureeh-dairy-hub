'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { localDateKey } from '@/lib/milk-entry-list';
import { useRecordBuffaloDisposal } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../types';
import { buffaloDisposalSchema } from '../disposition.validation';
import { DispositionField } from './DispositionField';

export function BuffaloDisposalForm({ buffalo }: { buffalo: BuffaloDetail }) {
  const mutation = useRecordBuffaloDisposal();
  const [type, setType] = useState<'DEATH' | 'TRANSFER_OUT' | 'OTHER'>('DEATH');
  const [date, setDate] = useState(localDateKey());
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
    <form className="card space-y-4" onSubmit={submit} noValidate>
      <h2 className="section-title">Record non-sale disposal</h2>
      <p className="sub">Use this for death, transfer out, or another permanent removal. Disposals cannot be undone through status editing.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DispositionField label="Disposal type"><Select value={type} onValueChange={(value) => setType(value as typeof type)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DEATH">Death</SelectItem><SelectItem value="TRANSFER_OUT">Transfer out</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></DispositionField>
        <DispositionField label="Effective date"><DatePicker value={date} max={localDateKey()} onChange={setDate} ariaLabel="Effective date" /></DispositionField>
        <DispositionField label="Reason"><Input required value={reason} onChange={(e) => setReason(e.target.value)} /></DispositionField>
        <DispositionField label="Notes"><Textarea value={notes} rows={3} onChange={(e) => setNotes(e.target.value)} /></DispositionField>
      </div>
      {(message || mutation.isError) && <p role="alert" className="auth-message">{message || mutation.error?.message}</p>}
      <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Recording…' : 'Record disposal'}</Button>
    </form>
  );
}
