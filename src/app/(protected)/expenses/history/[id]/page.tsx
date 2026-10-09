'use client';
import { formatDate, formatDateTime } from '@/lib/date-format';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExpenseShell, money, todayLocal } from '../../shared';
import type { ExpenseRow } from '@/lib/expense-types';

type ExpensePayment = {
  id: string;
  payment_date: string;
  amount: number | string;
  payment_method: string;
  transaction_reference: string | null;
  notes: string | null;
  created_at: string;
};

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER'] as const;

export default function ExpenseDetail({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState(''),
    [row, setRow] = useState<ExpenseRow | null>(null),
    [payments, setPayments] = useState<ExpensePayment[]>([]),
    [paymentDate, setPaymentDate] = useState(todayLocal()),
    [amount, setAmount] = useState(''),
    [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('CASH'),
    [reference, setReference] = useState(''),
    [notes, setNotes] = useState(''),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');

  const load = useCallback(async (expenseId: string) => {
    if (!supabase) return;
    const [expenseResult, paymentsResult] = await Promise.all([
      supabase.from('expenses').select('*').eq('id', expenseId).is('deleted_at', null).maybeSingle(),
      supabase
        .from('expense_payments')
        .select('id,payment_date,amount,payment_method,transaction_reference,notes,created_at')
        .eq('expense_id', expenseId)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    if (expenseResult.error || paymentsResult.error) {
      setError((expenseResult.error ?? paymentsResult.error)!.message);
      return;
    }
    setRow(expenseResult.data as ExpenseRow | null);
    setPayments((paymentsResult.data ?? []) as ExpensePayment[]);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.resolve(params).then((p) => {
      if (!alive) return;
      setId(p.id);
      void load(p.id);
    });
    return () => {
      alive = false;
    };
  }, [params, load]);

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !row) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a payment amount greater than ₹0.');
      return;
    }
    if (value > Number(row.pending_amount)) {
      setError('Payment cannot exceed the pending expense balance.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { error: paymentError } = await supabase.rpc('record_expense_payment', {
        p_expense_id: row.id,
        p_payment_date: paymentDate,
        p_amount: value,
        p_payment_method: method,
        p_transaction_reference: reference.trim() || null,
        p_notes: notes.trim() || null,
      });
      if (paymentError) throw new Error(paymentError.message);
      setAmount('');
      setReference('');
      setNotes('');
      setMessage('Payment recorded.');
      await load(row.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not record payment.');
    } finally {
      setSaving(false);
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
      {error && <p className="auth-message">{error}</p>}
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
            <section className="card">
              <h2 className="section-title">Record supplier payment</h2>
              {Number(row.pending_amount) > 0 ? (
                <form className="expense-form-grid" onSubmit={recordPayment}>
                  <div className="field">
                    <label>Payment date</label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Amount · pending {money(Number(row.pending_amount))}</label>
                    <input
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
                    <label>Payment method</label>
                    <select value={method} onChange={(e) => setMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}>
                      {PAYMENT_METHODS.map((value) => (
                        <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Transaction reference (optional)</label>
                    <input value={reference} onChange={(e) => setReference(e.target.value)} />
                  </div>
                  <div className="field wide-field">
                    <label>Notes (optional)</label>
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <button className="btn" disabled={saving}>
                    {saving ? 'Recording…' : 'Record payment'}
                  </button>
                </form>
              ) : (
                <p className="kpi-foot">This expense is fully paid.</p>
              )}
              <p className="kpi-foot" style={{ marginTop: 12 }}>
                Payments recorded after this feature is enabled have dated ledger entries. Earlier paid amounts remain as undated historical totals.
              </p>
            </section>
            <section className="card">
              <h2 className="section-title">Payment history</h2>
              {payments.length ? (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>DATE</th><th>AMOUNT</th><th>METHOD</th><th>REFERENCE / NOTES</th></tr></thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{formatDate(payment.payment_date)}</td>
                          <td>{money(Number(payment.amount))}</td>
                          <td>{payment.payment_method.replaceAll('_', ' ')}</td>
                          <td>{[payment.transaction_reference, payment.notes].filter(Boolean).join(' · ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
