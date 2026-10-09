'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/date-format';
import { money } from '@/lib/farm-format';
import {
  useBuffaloDisposal,
  useBuffaloSale,
  useBuffaloSalePayments,
  useCreateBuffaloSale,
  useRecordBuffaloDisposal,
  useRecordBuffaloSalePayment,
} from '../hooks/use-buffaloes';
import type { BuffaloDetail, BuffaloPaymentMethod } from '../types';

const PAYMENT_METHODS: BuffaloPaymentMethod[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'];

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function BuffaloDispositionPanel({ buffalo }: { buffalo: BuffaloDetail }) {
  const saleQuery = useBuffaloSale(buffalo.id);
  const paymentsQuery = useBuffaloSalePayments(buffalo.id);
  const disposalQuery = useBuffaloDisposal(buffalo.id);
  const sale = saleQuery.data;
  const disposal = disposalQuery.data;

  if (saleQuery.isPending || disposalQuery.isPending) {
    return <div className="card"><h2 className="section-title">Sale and disposal</h2><div className="empty">Loading disposition records…</div></div>;
  }
  if (saleQuery.isError || disposalQuery.isError) {
    return <div className="card"><h2 className="section-title">Sale and disposal</h2><div className="empty">{saleQuery.error?.message ?? disposalQuery.error?.message}</div></div>;
  }

  if (sale) {
    return (
      <div className="management-stack">
        <div className="card">
          <h2 className="section-title">Sale record</h2>
          <div className="grid two">
            <p className="sub">Sale date: <b>{formatDate(sale.sale_date)}</b></p>
            <p className="sub">Buyer: <b>{sale.buyer_name}</b></p>
            <p className="sub">Buyer mobile: {sale.buyer_mobile || '—'}</p>
            <p className="sub">Buyer location: {sale.buyer_location || '—'}</p>
            <p className="sub">Sale price: <b>{money(Number(sale.sale_price))}</b></p>
            <p className="sub">Received: <b>{money(Number(sale.amount_received))}</b></p>
            <p className="sub">Outstanding: <b>{money(Number(sale.amount_pending))}</b></p>
            <p className="sub">Payment status: <b>{sale.payment_status}</b></p>
            <p className="sub">Due date: {formatDate(sale.payment_due_date)}</p>
            <p className="sub">Terms: {sale.payment_terms || '—'}</p>
            <p className="sub">Reference: {sale.transaction_reference || '—'}</p>
            <p className="sub">Notes: {sale.notes || '—'}</p>
          </div>
        </div>
        <div className="grid two">
          <SalePaymentForm saleId={sale.id} pending={Number(sale.amount_pending)} />
          <div className="card">
            <h2 className="section-title">Sale payment history</h2>
            {paymentsQuery.isPending ? <div className="empty">Loading payments…</div> : paymentsQuery.isError ? <div className="empty">{paymentsQuery.error.message}</div> : paymentsQuery.data?.length ? (
              <div className="table-wrap"><table className="table"><thead><tr><th>DATE</th><th>AMOUNT</th><th>METHOD</th><th>REFERENCE / NOTES</th></tr></thead><tbody>
                {paymentsQuery.data.map((payment) => <tr key={payment.id}><td>{formatDate(payment.payment_date)}</td><td>{money(Number(payment.amount))}</td><td>{payment.payment_method}</td><td>{[payment.transaction_reference, payment.notes].filter(Boolean).join(' · ') || '—'}</td></tr>)}
              </tbody></table></div>
            ) : <div className="empty">No sale payments recorded.</div>}
          </div>
        </div>
      </div>
    );
  }

  if (disposal) {
    return (
      <div className="card">
        <h2 className="section-title">Disposal record</h2>
        <p className="sub">Type: <b>{disposal.disposal_type.replace('_', ' ')}</b></p>
        <p className="sub">Effective date: <b>{formatDate(disposal.effective_date)}</b></p>
        <p className="sub">Reason: {disposal.reason}</p>
        <p className="sub">Notes: {disposal.notes || '—'}</p>
      </div>
    );
  }

  if (!['ACTIVE', 'DRY'].includes(buffalo.current_status)) {
    return (
      <div className="card">
        <h2 className="section-title">Sale and disposal</h2>
        <p className="sub">This buffalo is marked <b>{buffalo.current_status}</b>, but no matching sale or disposal transaction exists. Review its legacy status before recording a new transaction.</p>
      </div>
    );
  }

  return (
    <div className="grid two">
      <SaleForm buffalo={buffalo} />
      <DisposalForm buffalo={buffalo} />
    </div>
  );
}

function SaleForm({ buffalo }: { buffalo: BuffaloDetail }) {
  const mutation = useCreateBuffaloSale();
  const [saleDate, setSaleDate] = useState(todayLocal());
  const [buyerName, setBuyerName] = useState('');
  const [buyerMobile, setBuyerMobile] = useState('');
  const [buyerLocation, setBuyerLocation] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [initialPayment, setInitialPayment] = useState('0');
  const [paymentDate, setPaymentDate] = useState(todayLocal());
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
    if (!buyerName.trim() || price <= 0 || paid < 0 || paid > price) {
      setMessage('Enter a buyer name, a positive sale price, and a valid initial payment.');
      return;
    }
    if (pending > 0 && !dueDate) {
      setMessage('A due date is required while sale proceeds remain outstanding.');
      return;
    }
    try {
      await mutation.mutateAsync({
        buffaloId: buffalo.id,
        input: {
          sale_date: saleDate, buyer_name: buyerName, buyer_mobile: buyerMobile,
          buyer_location: buyerLocation, sale_price: price, initial_payment: paid,
          payment_method: paymentMethod, payment_date: paymentDate, payment_due_date: dueDate,
          payment_terms: terms, transaction_reference: reference, notes,
        },
      });
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
        {paid > 0 && <Field label="Payment method"><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as BuffaloPaymentMethod)}>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method.replace('_', ' ')}</option>)}</select></Field>}
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

function SalePaymentForm({ saleId, pending }: { saleId: string; pending: number }) {
  const mutation = useRecordBuffaloSalePayment();
  const [date, setDate] = useState(todayLocal());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<BuffaloPaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const value = Number(amount);
    if (value <= 0 || value > pending) {
      setMessage('Payment must be greater than ₹0 and cannot exceed the outstanding balance.');
      return;
    }
    try {
      await mutation.mutateAsync({ saleId, input: { payment_date: date, amount: value, payment_method: method, transaction_reference: reference, notes } });
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
          <Field label="Payment date"><input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Amount (₹)"><input required type="number" min="0.01" max={pending} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Payment method"><select value={method} onChange={(e) => setMethod(e.target.value as BuffaloPaymentMethod)}>{PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}</select></Field>
          <Field label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        {(message || mutation.isError) && <p className="auth-message">{message || mutation.error?.message}</p>}
        <button className="btn" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Record payment'}</button>
      </>}
    </form>
  );
}

function DisposalForm({ buffalo }: { buffalo: BuffaloDetail }) {
  const mutation = useRecordBuffaloDisposal();
  const [type, setType] = useState<'DEATH' | 'TRANSFER_OUT' | 'OTHER'>('DEATH');
  const [date, setDate] = useState(todayLocal());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!reason.trim()) { setMessage('A disposal reason is required.'); return; }
    try {
      await mutation.mutateAsync({ buffaloId: buffalo.id, input: { disposal_type: type, effective_date: date, reason, notes } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not record disposal.');
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2 className="section-title">Record non-sale disposal</h2>
      <p className="sub">Use this for death, transfer out, or another permanent removal. A disposal cannot be undone through status editing.</p>
      <div className="grid two">
        <Field label="Disposal type"><select value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="DEATH">Death</option><option value="TRANSFER_OUT">Transfer out</option><option value="OTHER">Other</option></select></Field>
        <Field label="Effective date"><input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Reason"><input required value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
      {(message || mutation.isError) && <p className="auth-message">{message || mutation.error?.message}</p>}
      <button className="btn" disabled={mutation.isPending}>{mutation.isPending ? 'Recording…' : 'Record disposal'}</button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}
