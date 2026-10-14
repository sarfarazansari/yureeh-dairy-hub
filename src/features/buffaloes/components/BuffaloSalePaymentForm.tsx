'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Input } from '@/components/ui/input';

import { useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { money } from '@/lib/farm-format';
import { useRecordBuffaloSalePayment } from '../hooks/use-buffaloes';
import type { BuffaloPaymentMethod } from '../types';
import { buffaloSalePaymentSchema } from '../disposition.validation';
import { DispositionField, DISPOSITION_PAYMENT_METHODS, getDispositionToday } from './DispositionField';

export function BuffaloSalePaymentForm({ saleId, pending }: { saleId: string; pending: number }) {
  const mutation = useRecordBuffaloSalePayment();
  const [date, setDate] = useState(getDispositionToday());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<BuffaloPaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const parsed = buffaloSalePaymentSchema.safeParse({ payment_date: date, amount, payment_method: method, transaction_reference: reference, notes });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? 'Check the payment details.');
      return;
    }
    if (parsed.data.amount > pending) {
      setMessage('Payment cannot exceed the outstanding balance.');
      return;
    }
    try {
      await mutation.mutateAsync({ saleId, input: parsed.data });
      setAmount(''); setReference(''); setNotes('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not record payment.');
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 className="section-title">Record sale payment</h2>
      <p className="sub">Outstanding: <b>{money(pending)}</b></p>
      {pending <= 0 ? <div className="empty">Sale is fully paid.</div> : <>
        <div className="grid two">
          <DispositionField label="Payment date"><DatePicker value={date} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)} onChange={setDate} ariaLabel="Payment date" /></DispositionField>
          <DispositionField label="Amount (₹)"><Input required type="number" min="0.01" max={pending} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></DispositionField>
          <DispositionField label="Payment method"><Select value={method} onValueChange={(value) => setMethod(value as BuffaloPaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DISPOSITION_PAYMENT_METHODS.map((item) => <SelectItem key={item} value={item}>{item.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></DispositionField>
          <DispositionField label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></DispositionField>
          <DispositionField label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></DispositionField>
        </div>
        {(message || mutation.isError) && <p className="auth-message">{message || mutation.error?.message}</p>}
        <button className="btn" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Record payment'}</button>
      </>}
    </form>
  );
}
