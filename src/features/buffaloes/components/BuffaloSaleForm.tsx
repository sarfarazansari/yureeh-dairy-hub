'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Input } from '@/components/ui/input';

import { useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { money } from '@/lib/farm-format';
import { useCreateBuffaloSale } from '../hooks/use-buffaloes';
import type { BuffaloDetail, BuffaloPaymentMethod } from '../types';
import { buffaloSaleSchema } from '../disposition.validation';
import { DispositionField, DISPOSITION_PAYMENT_METHODS, getDispositionToday } from './DispositionField';

export function BuffaloSaleForm({ buffalo }: { buffalo: BuffaloDetail }) {
  const mutation = useCreateBuffaloSale();
  const [saleDate, setSaleDate] = useState(getDispositionToday());
  const [buyerName, setBuyerName] = useState('');
  const [buyerMobile, setBuyerMobile] = useState('');
  const [buyerLocation, setBuyerLocation] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [initialPayment, setInitialPayment] = useState('0');
  const [paymentDate, setPaymentDate] = useState(getDispositionToday());
  const [paymentMethod, setPaymentMethod] = useState<BuffaloPaymentMethod>('CASH');
  const [dueDate, setDueDate] = useState('');
  const [terms, setTerms] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  const price = Number(salePrice) || 0;
  const paid = Number(initialPayment) || 0;
  const pending = Math.max(0, price - paid);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const parsed = buffaloSaleSchema.safeParse({
      sale_date: saleDate, buyer_name: buyerName, buyer_mobile: buyerMobile,
      buyer_location: buyerLocation, sale_price: salePrice, initial_payment: initialPayment,
      payment_method: paymentMethod, payment_date: paymentDate, payment_due_date: dueDate,
      payment_terms: terms, transaction_reference: reference, notes,
    });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? 'Check the sale details.');
      return;
    }
    try {
      await mutation.mutateAsync({ buffaloId: buffalo.id, input: parsed.data });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not record sale.');
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 className="section-title">Record buffalo sale</h2>
      <p className="sub">Recording a sale will mark this buffalo SOLD and prevent future production entries.</p>
      <div className="grid two">
        <DispositionField label="Sale date"><DatePicker value={saleDate} max={getDispositionToday()} onChange={setSaleDate} ariaLabel="Sale date" /></DispositionField>
        <DispositionField label="Buyer name"><Input required value={buyerName} onChange={(e) => setBuyerName(e.target.value)} /></DispositionField>
        <DispositionField label="Buyer mobile"><Input value={buyerMobile} onChange={(e) => setBuyerMobile(e.target.value)} /></DispositionField>
        <DispositionField label="Buyer location"><Input value={buyerLocation} onChange={(e) => setBuyerLocation(e.target.value)} /></DispositionField>
        <DispositionField label="Sale price (₹)"><Input required type="number" min="0.01" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></DispositionField>
        <DispositionField label="Received now (₹)"><Input required type="number" min="0" step="0.01" value={initialPayment} onChange={(e) => setInitialPayment(e.target.value)} /></DispositionField>
        <DispositionField label="Outstanding"><div className="calculated-balance">{money(pending)}</div></DispositionField>
        {paid > 0 && <DispositionField label="Payment date"><DatePicker value={paymentDate} max={getDispositionToday()} onChange={setPaymentDate} ariaLabel="Payment date" /></DispositionField>}
        {paid > 0 && <DispositionField label="Payment method"><Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as BuffaloPaymentMethod)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DISPOSITION_PAYMENT_METHODS.map((method) => <SelectItem key={method} value={method}>{method.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></DispositionField>}
        {pending > 0 && <DispositionField label="Due date"><DatePicker value={dueDate} min={saleDate} onChange={setDueDate} ariaLabel="Due date" /></DispositionField>}
        {pending > 0 && <DispositionField label="Payment terms"><Input value={terms} onChange={(e) => setTerms(e.target.value)} /></DispositionField>}
        <DispositionField label="Transaction reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></DispositionField>
        <DispositionField label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></DispositionField>
      </div>
      {(message || mutation.isError) && <p className="auth-message">{message || mutation.error?.message}</p>}
      <button className="btn" disabled={mutation.isPending}>{mutation.isPending ? 'Recording…' : 'Record sale'}</button>
    </form>
  );
}
