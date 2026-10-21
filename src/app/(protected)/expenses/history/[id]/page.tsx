'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, formatDateTime } from '@/lib/date-format';
import Link from 'next/link';
import { DatePicker } from '@/components/ui/date-picker';
import { useEffect, useState } from 'react';
import { ExpenseShell } from '@/features/expenses/components/ExpenseNavigationShell';
import { money, todayLocal } from '@/features/expenses/utils/expense-format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { useExpenseDetailQuery, useRecordExpensePaymentMutation } from '@/features/expenses/expense.queries';
import { useIsViewer } from '@/lib/farm-access';

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER'] as const;

export default function ExpenseDetail({ params }: { params: Promise<{ id: string }> }) {
  const isViewer = useIsViewer();
  const [id, setId] = useState(''),
    [paymentDate, setPaymentDate] = useState(todayLocal()),
    [amount, setAmount] = useState(''),
    [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('CASH'),
    [reference, setReference] = useState(''),
    [notes, setNotes] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');

  const expenseQuery = useExpenseDetailQuery(id);
  const paymentMutation = useRecordExpensePaymentMutation();
  const row = expenseQuery.data?.row ?? null;
  const payments = expenseQuery.data?.payments ?? [];
  const saving = paymentMutation.isPending;

  useEffect(() => {
    let alive = true;
    Promise.resolve(params).then((p) => {
      if (alive) setId(p.id);
    });
    return () => {
      alive = false;
    };
  }, [params]);

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!row || saving) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a payment amount greater than ₹0.');
      return;
    }
    if (value > Number(row.pending_amount)) {
      setError('Payment cannot exceed the pending expense balance.');
      return;
    }
    if (!paymentDate || paymentDate > todayLocal()) {
      setError('Payment date must be today or earlier.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await paymentMutation.mutateAsync({
        expenseId: row.id,
        paymentDate,
        amount: value,
        paymentMethod: method,
        transactionReference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      setAmount('');
      setReference('');
      setNotes('');
      setMessage('Payment recorded.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not record payment.');
    }
  }

  const fields: [string, string | null | undefined][] = [
    ['Date', row?.business_date ? formatDate(row.business_date) : null],
    ['Category', row?.category_name_snapshot],
    ['Group', row?.category_group_snapshot?.replaceAll('_', ' ')],
    ['Vendor', row?.vendor_name_snapshot],
    ['Description', row?.description],
    ['Quantity', row?.quantity == null ? null : `${row.quantity} ${row.unit ?? ''}`],
    ['Rate', row?.rate == null ? null : money(Number(row.rate))],
    ['Total amount', row ? money(Number(row.total_amount)) : null],
    ['Paid amount', row ? money(Number(row.paid_amount)) : null],
    ['Pending amount', row ? money(Number(row.pending_amount)) : null],
    ['Payment status', row?.payment_status],
    ['Payment method (latest/initial)', row?.payment_method],
    ['Due date', row?.due_date ? formatDate(row.due_date) : null],
    ['Buffalo', row?.buffalo_code_snapshot],
    ['Receipt / reference', row?.receipt_reference],
    ['Notes', row?.notes],
    ['Created at', row?.created_at ? formatDateTime(row.created_at) : null],
  ];

  return (
    <ExpenseShell
      title="Expense detail"
      subtitle="Review the expense balance and dated payments"
    >
      <Link href="/expenses/history" style={{ fontSize: 12, color: '#277452' }}>
        ← Expense history
      </Link>
      {(error || expenseQuery.error) && <p className="auth-message">{error || expenseQuery.error?.message}</p>}
      {message && <p className="auth-message">{message}</p>}
      {row ? (
        <>
          <div className="card detail-grid">
            {fields.map(([label, value]) => (
              <div className="detail-item" key={label}>
                <span className="kpi-label">{label}</span>
                <b>{value || '—'}</b>
              </div>
            ))}
          </div>
          <div className="grid two" style={{ marginTop: 15 }}>
            {!isViewer && <section className="card">
              <h2 className="section-title">Record supplier payment</h2>
              {Number(row.pending_amount) > 0 ? (
                <form className="expense-form-grid" onSubmit={recordPayment}>
                  <div className="field">
                    <Label htmlFor="expense-payment-date">Payment date</Label>
                    <DatePicker id="expense-payment-date" value={paymentDate} max={todayLocal()} onChange={setPaymentDate} ariaLabel="Payment date" />
                    <p className="kpi-foot">Payment date must be today or earlier.</p>
                  </div>
                  <div className="field">
                    <Label htmlFor="expense-payment-amount">Amount · pending {money(Number(row.pending_amount))}</Label>
                    <Input
                      id="expense-payment-amount"
                      type="number"
                      min="0.01"
                      max={Number(row.pending_amount)}
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <Label htmlFor="expense-payment-method">Payment method</Label>
                    <Select value={method} onValueChange={(value) => setMethod(value as (typeof PAYMENT_METHODS)[number])}><SelectTrigger id="expense-payment-method"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="field">
                    <Label htmlFor="expense-payment-reference">Transaction reference (optional)</Label>
                    <Input id="expense-payment-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
                  </div>
                  <div className="field wide-field">
                    <Label htmlFor="expense-payment-notes">Notes (optional)</Label>
                    <Textarea id="expense-payment-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Recording…' : 'Record payment'}
                  </Button>
                </form>
              ) : (
                <p className="kpi-foot">This expense is fully paid.</p>
              )}
              <p className="kpi-foot" style={{ marginTop: 12 }}>
                Payments recorded after this feature is enabled have dated ledger entries. Earlier paid amounts remain as undated historical totals.
              </p>
            </section>}
            <section className="card">
              <h2 className="section-title">Payment history</h2>
              {payments.length ? (
                <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]"><Table className="min-w-[650px]"><TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>AMOUNT</TableHead><TableHead>METHOD</TableHead><TableHead>REFERENCE / NOTES</TableHead></TableRow></TableHeader><TableBody>
                  {payments.map((payment) => <TableRow key={payment.id}><TableCell>{formatDate(payment.payment_date)}</TableCell><TableCell>{money(Number(payment.amount))}</TableCell><TableCell>{payment.payment_method.replaceAll('_', ' ')}</TableCell><TableCell>{[payment.transaction_reference, payment.notes].filter(Boolean).join(' · ') || '—'}</TableCell></TableRow>)}
                </TableBody></Table></div>
              ) : (
                <div className="empty">No dated payment entries yet.</div>
              )}
            </section>
          </div>
        </>
      ) : (
        !error && <div className="empty">Loading expense {id}…</div>
      )}
    </ExpenseShell>
  );
}
