'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { money } from '@/lib/farm-format';
import { localDateKey } from '@/lib/milk-entry-list';
import { useRecordBuffaloSalePayment } from '../hooks/use-buffaloes';
import type { BuffaloPaymentMethod } from '../types';
import { buffaloSalePaymentSchema } from '../disposition.validation';
import { DispositionField, DISPOSITION_PAYMENT_METHODS } from './DispositionField';

export function BuffaloSalePaymentForm({ saleId, pending }: { saleId: string; pending: number }) {
  const mutation = useRecordBuffaloSalePayment();
  const [date, setDate] = useState(localDateKey());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<BuffaloPaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const parsed = buffaloSalePaymentSchema.safeParse({ payment_date: date, amount, payment_method: method, transaction_reference: reference, notes });
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? 'Check the payment details.'); return; }
    if (parsed.data.amount > pending) { setMessage('Payment cannot exceed the outstanding balance.'); return; }
    try {
      await mutation.mutateAsync({ saleId, input: parsed.data });
      setAmount('');
      setReference('');
      setNotes('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not record payment.');
    }
  }

  return (
    <form className="card space-y-4" onSubmit={submit} noValidate>
      <h2 className="section-title">Record sale payment</h2>
      <p className="sub">Outstanding: <b>{money(pending)}</b></p>
      {pending <= 0 ? <div className="empty">Sale is fully paid.</div> : <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DispositionField label="Payment date"><DatePicker value={date} max={localDateKey()} onChange={setDate} ariaLabel="Payment date" /></DispositionField>
          <DispositionField label="Amount (₹)"><Input required type="number" inputMode="decimal" min="0.01" max={pending} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></DispositionField>
          <DispositionField label="Payment method"><Select value={method} onValueChange={(value) => setMethod(value as BuffaloPaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DISPOSITION_PAYMENT_METHODS.map((item) => <SelectItem key={item} value={item}>{item.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></DispositionField>
          <DispositionField label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></DispositionField>
        </div>
        <DispositionField label="Notes"><Textarea value={notes} rows={2} onChange={(e) => setNotes(e.target.value)} /></DispositionField>
        {(message || mutation.isError) && <p role="alert" className="auth-message">{message || mutation.error?.message}</p>}
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Record payment'}</Button>
      </>}
    </form>
  );
}
