'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { localDateKey } from '@/lib/milk-entry-list';
import { money, milkTxt } from '@/lib/farm-format';
import Link from 'next/link';
import { useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { AppShell } from '@/components/layout/AppShell';
import { KPI } from '@/components/ui/KPI';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


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
import type { CustomerPaymentMethod } from './types';
import { useIsViewer } from '@/lib/farm-access';
export default function CustomerDetailPage({ id }: { id: string }) {
  const isViewer = useIsViewer();
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
  const financialSummary = detailQuery.data?.financialSummary;
  const payments = paymentsQuery.data ?? [];
  const total = financialSummary?.total_milk_quantity ?? 0,
    rev = financialSummary?.total_sales_amount ?? 0,
    paymentsTotal = financialSummary?.total_payments_amount ?? 0,
    netBalance = rev - paymentsTotal,
    outstanding = Math.max(0, netBalance),
    customerCredit = Math.max(0, -netBalance),
    daily = Array.from(new Set(rows.map((r) => r.business_date)))
      .sort()
      .map((date) => {
        const d = rows.filter((r) => r.business_date === date);
        return {
          date: formatDate(date),
          milk: d.reduce((s, r) => s + Number(r.milk_quantity), 0),
          revenue: d.reduce((s, r) => s + Number(r.calculated_amount), 0),
        };
      });
  if (detailQuery.isPending) {
    return (
      <AppShell title="Customer details" subtitle="">
        <div className="empty">Loading customer…</div>
      </AppShell>
    );
  }

  if (detailQuery.isError) {
    return (
      <AppShell title="Customer details" subtitle="">
        <div className="empty">{detailQuery.error.message}</div>
      </AppShell>
    );
  }

  if (!c) {
    return (
      <AppShell title="Customer details" subtitle="">
        <div className="empty">Customer not found.</div>
      </AppShell>
    );
  }

  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentMessage('');
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentMessage('Payment amount must be greater than ₹0.');
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
      title={c.name}
      subtitle={`${c.pricing_type === 'FAT_BASED' ? 'Fat based' : 'Fixed per litre'} · default rate ₹${c.default_rate}`}
    >
      <Link href="/customers" style={{ fontSize: 12, color: '#277452' }}>
        ← All customers
      </Link>
      <div className="grid kpis">
        <KPI label="TOTAL MILK" value={milkTxt(total)} foot={`${financialSummary?.entry_count ?? 0} entries`} />
        <KPI label="TOTAL SALES" value={money(rev)} foot={total ? `${money(rev / total)} per litre` : 'No sales'} />
        <KPI label="PAYMENTS RECEIVED" value={money(paymentsTotal)} foot={`${financialSummary?.payment_count ?? 0} payments recorded`} accent />
        <KPI
          label="OUTSTANDING"
          value={money(outstanding)}
          foot={customerCredit ? `Customer credit: ${money(customerCredit)}` : outstanding ? 'Amount currently receivable' : 'Fully settled'}
        />
      </div>
      <div className="card">
        <h2 className="section-title">Recent milk and revenue trend</h2>
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
        {!isViewer && <div className="card">
          <h2 className="section-title">Record customer payment</h2>
          <p className="sub">
            Current outstanding: <b>{money(outstanding)}</b>
            {customerCredit > 0 && <> · Customer credit: <b>{money(customerCredit)}</b></>}
          </p>
          <form onSubmit={recordPayment}>
            <div className="grid two">
              <div className="field">
                <Label htmlFor="customer-payment-date">Payment date</Label>
                <DatePicker id="customer-payment-date" value={paymentDate} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)} disabled={paymentMutation.isPending} onChange={setPaymentDate} ariaLabel="Payment date" />
              </div>
              <div className="field">
                <Label htmlFor="customer-payment-amount">Amount · ₹</Label>
                <Input id="customer-payment-amount" type="number" min="0.01" step="0.01" value={paymentAmount} disabled={paymentMutation.isPending} onChange={(event) => setPaymentAmount(event.target.value)} placeholder={outstanding ? outstanding.toFixed(2) : 'Advance payment'} />
              </div>
            </div>
            <div className="grid two">
              <div className="field">
                <Label htmlFor="customer-payment-method">Payment method</Label>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as CustomerPaymentMethod)} disabled={paymentMutation.isPending}><SelectTrigger id="customer-payment-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select>
              </div>
              <div className="field">
                <Label htmlFor="customer-payment-reference">Reference</Label>
                <Input id="customer-payment-reference" value={paymentReference} disabled={paymentMutation.isPending} onChange={(event) => setPaymentReference(event.target.value)} placeholder="UPI / bank reference (optional)" />
              </div>
            </div>
            <div className="field">
              <Label htmlFor="customer-payment-notes">Notes</Label>
              <Input id="customer-payment-notes" value={paymentNotes} disabled={paymentMutation.isPending} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Optional payment note" />
            </div>
            {paymentMessage && <p className="success-message">{paymentMessage}</p>}
            <Button type="submit" disabled={paymentMutation.isPending}>
              {paymentMutation.isPending ? 'Recording…' : outstanding > 0 ? 'Record payment' : 'Record advance'}
            </Button>
          </form>
        </div>}
      </div>

      <div style={{ height: 14 }} />
      <div className="card">
        <h2 className="section-title">Recent payment history (latest 500)</h2>
        {paymentsQuery.isPending ? (
          <div className="empty">Loading payments…</div>
        ) : paymentsQuery.isError ? (
          <div className="list-error" role="alert"><span>{paymentsQuery.error.message}</span><Button type="button" variant="outline" onClick={() => void paymentsQuery.refetch()}>Retry</Button></div>
        ) : payments.length ? (
          <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]"><Table className="min-w-[600px]"><TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>AMOUNT</TableHead><TableHead>METHOD</TableHead><TableHead>REFERENCE</TableHead></TableRow></TableHeader><TableBody>{payments.map((payment) => <TableRow key={payment.id}><TableCell>{formatDate(payment.payment_date)}</TableCell><TableCell>{money(payment.amount)}</TableCell><TableCell>{paymentMethodLabel(payment.payment_method)}</TableCell><TableCell>{payment.transaction_reference || '—'}</TableCell></TableRow>)}</TableBody></Table></div>
        ) : (
          <div className="empty">No customer payments recorded yet.</div>
        )}
      </div>

      <div style={{ height: 14 }} />
      <div className="card">
        <h2 className="section-title">Recent entry history (latest 500)</h2>
                <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]"><Table className="min-w-[750px]"><TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>SHIFT</TableHead><TableHead>MILK</TableHead><TableHead>FAT</TableHead><TableHead>RATE SNAPSHOT</TableHead><TableHead>AMOUNT</TableHead></TableRow></TableHeader><TableBody>{rows.map((r) => <TableRow key={r.id}><TableCell>{formatDate(r.business_date)}</TableCell><TableCell>{r.shift}</TableCell><TableCell>{milkTxt(Number(r.milk_quantity))}</TableCell><TableCell>{r.fat == null ? '—' : `${r.fat}%`}</TableCell><TableCell>{r.pricing_type === 'FIXED_PER_LITRE' ? `₹${r.applied_rate}/L` : `₹${r.applied_rate}/fat`}</TableCell><TableCell>{money(Number(r.calculated_amount))}</TableCell></TableRow>)}</TableBody></Table></div>
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
