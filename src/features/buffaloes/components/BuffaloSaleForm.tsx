'use client';

import { useState } from 'react';
import { money } from '@/lib/farm-format';
import { useCreateBuffaloSale } from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../types';
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
        <Field label="Sale date"><input required type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} /></Field>
        <Field label="Buyer name"><input required value={buyerName} onChange={(e) => setBuyerName(e.target.value)} /></Field>
        <Field label="Buyer mobile"><input value={buyerMobile} onChange={(e) => setBuyerMobile(e.target.value)} /></Field>
        <Field label="Buyer location"><input value={buyerLocation} onChange={(e) => setBuyerLocation(e.target.value)} /></Field>
        <Field label="Sale price (₹)"><input required type="number" min="0.01" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></Field>
        <Field label="Received now (₹)"><input required type="number" min="0" step="0.01" value={initialPayment} onChange={(e) => setInitialPayment(e.target.value)} /></Field>
        <Field label="Outstanding"><div className="calculated-balance">{money(pending)}</div></Field>
        {paid > 0 && <Field label="Payment date"><input required type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></Field>}
        {paid > 0 && <Field label="Payment method"><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as BuffaloPaymentMethod)}>{DISPOSITION_PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.replace('_', ' ')}</option>)}</select></Field>}
        {pending > 0 && <Field label="Due date"><input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>}
        {pending > 0 && <Field label="Payment terms"><input value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>}
        <Field label="Transaction reference"><input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
      {(message || mutation.isError) && <p className="auth-message">{message || mutation.error?.message}</p>}
      <button className="btn" disabled={mutation.isPending}>{mutation.isPending ? 'Recording…' : 'Record sale'}</button>
    </form>
  );
}
