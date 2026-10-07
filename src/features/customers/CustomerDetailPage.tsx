'use client';

import { localDateKey } from '@/lib/milk-entry-list';
import { money, milkTxt } from '@/lib/farm-format';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { KPI } from '@/components/ui/KPI';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate } from '@/lib/date-format';
import {
  useCustomerDetailQuery,
  useCustomerPaymentsQuery,
  useRecordCustomerPaymentMutation,
} from './customer.queries';
import type { CustomerPaymentMethod } from './services/customer.service';
export default function CustomerDetailPage({ id }: { id: string }) {
  const detailQuery = useCustomerDetailQuery(id);
  const paymentsQuery = useCustomerPaymentsQuery(id);
  const paymentMutation = useRecordCustomerPaymentMutation();
  const [paymentDate, setPaymentDate] = useState(() => localDateKey());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const c = detailQuery.data?.customer ?? null;
  const rows = detailQuery.data?.entries ?? [];
  const payments = paymentsQuery.data ?? [];
  const total = rows.reduce((s, r) => s + Number(r.milk_quantity), 0),
    rev = rows.reduce((s, r) => s + Number(r.calculated_amount), 0),
    fatDen = rows.reduce((s, r) => s + (r.fat == null ? 0 : Number(r.milk_quantity)), 0),
    fatNum = rows.reduce((s, r) => s + Number(r.milk_quantity) * Number(r.fat ?? 0), 0),
    avgFat = fatDen ? fatNum / fatDen : null,
    paymentsTotal = payments.reduce((s, p) => s + Number(p.amount), 0),
    outstanding = Math.max(0, rev - paymentsTotal),
    daily = Array.from(new Set(rows.map((r) => r.business_date)))
      .sort()
      .map((date) => {
        const d = rows.filter((r) => r.business_date === date);
        return {
          date: formatDate(date, 'D MMM'),
          milk: d.reduce((s, r) => s + Number(r.milk_quantity), 0),
          revenue: d.reduce((s, r) => s + Number(r.calculated_amount), 0),
        };
      });
  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentMessage('');
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentMessage('Payment amount must be greater than ₹0.');
      return;
    }
    if (amount > outstanding) {
      setPaymentMessage(`Payment cannot be greater than the outstanding balance of ${money(outstanding)}.`);
      return;
    }
    try {
      await paymentMutation.mutateAsync({
        customerId: id,
        payment: {
          payment_date: paymentDate,
          amount,
          payment_method: paymentMethod,
          transaction_reference: paymentReference,
          notes: paymentNotes,
        },
      });
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
      setPaymentMessage('Payment recorded successfully.');
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : 'Could not record customer payment.');
    }
  }

  return (
    <AppShell
      title={c?.name ?? 'Customer details'}
      subtitle={`${c?.pricing_type === 'FAT_BASED' ? 'Fat based' : 'Fixed per litre'} · default rate ₹${c?.default_rate ?? '—'}`}
    >
      <Link href="/customers" style={{ fontSize: 12, color: '#277452' }}>
        ← All customers
      </Link>
      {detailQuery.isError && <p className="auth-message">{detailQuery.error.message}</p>}
      <div className="grid kpis">
        <KPI label="TOTAL MILK" value={milkTxt(total)} foot={`${rows.length} entries`} />
        <KPI label="TOTAL SALES" value={money(rev)} foot={total ? `${money(rev / total)} per litre` : 'No sales'} />
        <KPI label="PAYMENTS RECEIVED" value={money(paymentsTotal)} foot={`${payments.length} payment${payments.length === 1 ? '' : 's'}`} accent />
        <KPI label="OUTSTANDING" value={money(outstanding)} foot={outstanding ? 'Amount currently receivable' : 'Fully settled'} />
      </div>
      <div className="card">
        <h2 className="section-title">Milk and revenue trend</h2>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily}>
              <CartesianGrid vertical={false} stroke="#eef1ed" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: '#9ba69f' }}
              />
              <YAxis hide />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="milk"
                name="Milk (L)"
                stroke="#267052"
                fill="#367d5d22"
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue (₹)"
                stroke="#d7a85e"
                fill="#d7a85e22"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ height: 14 }} />
      <div className="grid two">
        <div className="card">
          <h2 className="section-title">Customer information</h2>
          <p className="sub">Phone: {c.phone || '—'}</p>
          <p className="sub">Address: {c.address || '—'}</p>
          <p className="sub">Notes: {c.notes || '—'}</p>
        </div>
        <div className="card">
          <h2 className="section-title">Record customer payment</h2>
          <p className="sub">Current outstanding: <b>{money(outstanding)}</b></p>
          <form onSubmit={recordPayment}>
            <div className="grid two">
              <div className="field">
                <label htmlFor="customer-payment-date">Payment date</label>
                <input id="customer-payment-date" type="date" value={paymentDate} disabled={paymentMutation.isPending || outstanding <= 0} onChange={(event) => setPaymentDate(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="customer-payment-amount">Amount · ₹</label>
                <input id="customer-payment-amount" type="number" min="0.01" step="0.01" value={paymentAmount} disabled={paymentMutation.isPending || outstanding <= 0} onChange={(event) => setPaymentAmount(event.target.value)} placeholder={outstanding ? outstanding.toFixed(2) : '0.00'} />
              </div>
            </div>
            <div className="grid two">
              <div className="field">
                <label htmlFor="customer-payment-method">Payment method</label>
                <select id="customer-payment-method" value={paymentMethod} disabled={paymentMutation.isPending || outstanding <= 0} onChange={(event) => setPaymentMethod(event.target.value as CustomerPaymentMethod)}>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="customer-payment-reference">Reference</label>
                <input id="customer-payment-reference" value={paymentReference} disabled={paymentMutation.isPending || outstanding <= 0} onChange={(event) => setPaymentReference(event.target.value)} placeholder="UPI / bank reference (optional)" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="customer-payment-notes">Notes</label>
              <input id="customer-payment-notes" value={paymentNotes} disabled={paymentMutation.isPending || outstanding <= 0} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Optional payment note" />
            </div>
            {paymentMessage && <p className="success-message">{paymentMessage}</p>}
            <button className="btn" disabled={paymentMutation.isPending || outstanding <= 0}>
              {paymentMutation.isPending ? 'Recording…' : outstanding > 0 ? 'Record payment' : 'Fully settled'}
            </button>
          </form>
        </div>
      </div>

      <div style={{ height: 14 }} />
      <div className="card">
        <h2 className="section-title">Payment history</h2>
        {paymentsQuery.isPending ? (
          <div className="empty">Loading payments…</div>
        ) : paymentsQuery.isError ? (
          <div className="empty">{paymentsQuery.error.message}</div>
        ) : payments.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>DATE</th><th>AMOUNT</th><th>METHOD</th><th>REFERENCE</th></tr></thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.payment_date)}</td>
                    <td>{money(payment.amount)}</td>
                    <td>{paymentMethodLabel(payment.payment_method)}</td>
                    <td>{payment.transaction_reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">No customer payments recorded yet.</div>
        )}
      </div>

      <div style={{ height: 14 }} />
      <div className="card">
        <h2 className="section-title">Entry history</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>SHIFT</th>
                <th>MILK</th>
                <th>FAT</th>
                <th>RATE SNAPSHOT</th>
                <th>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.business_date)}</td>
                  <td>{r.shift}</td>
                  <td>{milkTxt(Number(r.milk_quantity))}</td>
                  <td>{r.fat == null ? '—' : `${r.fat}%`}</td>
                  <td>
                    {r.pricing_type === 'FIXED_PER_LITRE'
                      ? '₹' + r.applied_rate + '/L'
                      : '₹' + r.applied_rate + '/fat'}
                  </td>
                  <td>{money(Number(r.calculated_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <div className="empty">No entries for this customer yet.</div>}
      </div>
    </AppShell>
  );
}


function paymentMethodLabel(method: CustomerPaymentMethod) {
  if (method === 'BANK_TRANSFER') return 'Bank transfer';
  if (method === 'UPI') return 'UPI';
  if (method === 'CASH') return 'Cash';
  return 'Other';
}
