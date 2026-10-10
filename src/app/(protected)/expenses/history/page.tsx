'use client';
import { formatDate } from '@/lib/date-format';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateExpenseTotal, expensePaymentStatus } from '@/lib/expenses';
import { ExpenseShell, money, ensureExpenseCategories } from '../shared';
import type {
  ExpenseBuffaloOption,
  ExpenseCategory,
  ExpenseRow,
  ExpenseVendor,
} from '@/lib/expense-types';
import { Dialog } from '@/app/dialog';
import { TimedNotice } from '@/components/ui/TimedNotice';
export default function ExpenseHistory() {
  const [rows, setRows] = useState<ExpenseRow[]>([]),
    [ledgerExpenseIds, setLedgerExpenseIds] = useState<Set<string>>(new Set()),
    [feedPurchaseExpenseIds, setFeedPurchaseExpenseIds] = useState<Set<string>>(new Set()),
    [categories, setCategories] = useState<
      Pick<ExpenseCategory, 'id' | 'name' | 'category_group'>[]
    >([]),
    [vendors, setVendors] = useState<Pick<ExpenseVendor, 'id' | 'name'>[]>([]),
    [buffaloes, setBuffaloes] = useState<ExpenseBuffaloOption[]>([]),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [category, setCategory] = useState(''),
    [group, setGroup] = useState(''),
    [vendor, setVendor] = useState(''),
    [status, setStatus] = useState(''),
    [method, setMethod] = useState(''),
    [outstandingOnly, setOutstandingOnly] = useState(
      () =>
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('outstanding') === 'true',
    ),
    [buffalo, setBuffalo] = useState(''),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('date'),
    [editing, setEditing] = useState<ExpenseRow | null>(null),
    [pendingDelete, setPendingDelete] = useState<ExpenseRow | null>(null),
    [deleteBusy, setDeleteBusy] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function load() {
    if (!supabase) return;
    try {
      await ensureExpenseCategories(supabase);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load categories');
    }
    let q = supabase
      .from('expenses')
      .select('*')
      .is('deleted_at', null)
      .order('business_date', { ascending: false })
      .limit(1000);
    if (from) q = q.gte('business_date', from);
    if (to) q = q.lte('business_date', to);
    if (category) q = q.eq('category_id', category);
    if (group) q = q.eq('category_group_snapshot', group);
    if (vendor) q = q.eq('vendor_id', vendor);
    if (status) q = q.eq('payment_status', status);
    if (method) q = q.eq('payment_method', method);
    if (buffalo) q = q.eq('buffalo_id', buffalo);
    if (outstandingOnly) q = q.gt('pending_amount', 0);
    const [e, c, v, b] = await Promise.all([
      q,
      supabase.from('expense_categories').select('id,name,category_group').order('name'),
      supabase.from('expense_vendors').select('id,name').order('name'),
      supabase.from('buffaloes').select('id,name,buffalo_code').order('buffalo_code'),
    ]);
    if (e.error) setMessage(e.error.message);
    setRows(e.data ?? []);
    const expenseIds = (e.data ?? []).map((expense) => expense.id);
    if (expenseIds.length) {
      const [paymentResult, purchaseResult] = await Promise.all([
        supabase.from('expense_payments').select('expense_id').in('expense_id', expenseIds),
        supabase.from('feed_purchases').select('expense_id').eq('status', 'ACTIVE').in('expense_id', expenseIds),
      ]);
      if (paymentResult.error) setMessage(paymentResult.error.message);
      if (purchaseResult.error) setMessage(purchaseResult.error.message);
      setLedgerExpenseIds(new Set((paymentResult.data ?? []).map((payment) => payment.expense_id)));
      setFeedPurchaseExpenseIds(new Set((purchaseResult.data ?? []).map((purchase) => purchase.expense_id).filter((id): id is string => Boolean(id))));
    } else {
      setLedgerExpenseIds(new Set());
      setFeedPurchaseExpenseIds(new Set());
    }
    setCategories(c.data ?? []);
    setVendors(v.data ?? []);
    setBuffaloes(b.data ?? []);
  }
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [from, to, category, group, vendor, status, method, buffalo, outstandingOnly]);
  const visible = useMemo(
    () =>
      rows
        .filter((r) =>
          `${r.category_name_snapshot} ${r.vendor_name_snapshot ?? ''} ${r.description ?? ''}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'amount'
            ? Number(b.total_amount) - Number(a.total_amount)
            : sort === 'pending'
              ? Number(b.pending_amount) - Number(a.pending_amount)
              : sort === 'category'
                ? a.category_name_snapshot.localeCompare(b.category_name_snapshot)
                : b.business_date.localeCompare(a.business_date),
        ),
    [rows, search, sort],
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const amount =
        editing.quantity !== '' &&
        editing.quantity != null &&
        editing.rate !== '' &&
        editing.rate != null
          ? calculateExpenseTotal(editing.quantity, editing.rate)
          : Number(editing.total_amount);
      const paid = Number(editing.paid_amount);
      if (!amount || amount <= 0) throw new Error('Total must be greater than zero.');
      const payment_status = expensePaymentStatus(amount, paid);
      const { error } = await supabase!
        .from('expenses')
        .update({
          business_date: editing.business_date,
          category_id: editing.category_id,
          vendor_id: editing.vendor_id || null,
          buffalo_id: editing.buffalo_id || null,
          description: editing.description || null,
          quantity: editing.quantity === '' ? null : Number(editing.quantity),
          unit: editing.unit || null,
          rate: editing.rate === '' ? null : Number(editing.rate),
          total_amount: amount,
          paid_amount: paid,
          payment_status,
          payment_method: payment_status === 'CREDIT' ? 'CREDIT' : editing.payment_method,
          due_date: editing.due_date || null,
          notes: editing.notes || null,
          receipt_reference: editing.receipt_reference || null,
        })
        .eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      setMessage('Expense updated.');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not update expense.');
    } finally {
      setBusy(false);
    }
  }
  async function confirmDelete() {
    if (!pendingDelete || !supabase) return;
    setDeleteBusy(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', pendingDelete.id);
      if (error) throw error;
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : 'Could not delete expense.');
    } finally {
      setDeleteBusy(false);
    }
  }
  return (
    <ExpenseShell title="Expense history" subtitle="Filter, review and edit farm expenses">
      <div className="card">
        <div className="expense-form-grid">
          <div className="field">
            <label>From date</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>To date</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field">
            <label>Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Category, vendor, description"
            />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Category group</label>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">All groups</option>
              {[
                'FEED',
                'ANIMAL',
                'FARM_OPERATIONS',
                'TRANSPORT',
                'UTILITIES',
                'LABOUR',
                'EQUIPMENT',
                'ADMIN',
                'OTHER',
              ].map((g) => (
                <option key={g} value={g}>
                  {g.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Vendor</label>
            <select value={vendor} onChange={(e) => setVendor(e.target.value)}>
              <option value="">All vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Payment status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['PAID', 'PARTIAL', 'CREDIT'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Payment method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">All methods</option>
              {['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER', 'CREDIT'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Buffalo</label>
            <select value={buffalo} onChange={(e) => setBuffalo(e.target.value)}>
              <option value="">All buffaloes</option>
              {buffaloes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.buffalo_code}
                </option>
              ))}
            </select>
          </div>
          <label className="field">
            <span>Outstanding only</span>
            <input
              type="checkbox"
              checked={outstandingOnly}
              onChange={(e) => setOutstandingOnly(e.target.checked)}
            />
          </label>
          <div className="field">
            <label>Sort by</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="date">Date</option>
              <option value="amount">Amount</option>
              <option value="category">Category</option>
              <option value="pending">Pending amount</option>
            </select>
          </div>
        </div>
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <Dialog
          open={!!editing}
          onOpenChange={(open) => {
            if (!open && !busy) setEditing(null);
          }}
          labelledBy="edit-expense-title"
          className="expense-edit-dialog"
        >
          {editing && (
            <form className="edit-box expense-edit-form" onSubmit={save}>
              <div className="dialog-header">
                <div>
                  <p className="eyebrow">EXPENSE</p>
                  <h2 className="dialog-title" id="edit-expense-title">
                    Edit expense
                  </h2>
                  <p className="dialog-description">
                    {editing.category_name_snapshot} · {formatDate(editing.business_date)}
                  </p>
                </div>
                <button
                  className="dialog-close"
                  type="button"
                  aria-label="Close expense editor"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  ×
                </button>
              </div>
              <div className="expense-form-grid">
                <div className="field">
                  <label>Date</label>
                  <input
                    type="date"
                    required
                    value={editing.business_date}
                    onChange={(e) => setEditing({ ...editing, business_date: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Category</label>
                  <select
                    value={editing.category_id}
                    onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Vendor</label>
                  <select
                    value={editing.vendor_id ?? ''}
                    onChange={(e) => setEditing({ ...editing, vendor_id: e.target.value })}
                  >
                    <option value="">No vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Quantity (blank for direct amount)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={editing.quantity ?? ''}
                    onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Unit</label>
                  <input
                    value={editing.unit ?? ''}
                    onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Rate</label>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={editing.rate ?? ''}
                    onChange={(e) => setEditing({ ...editing, rate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Direct total (used if quantity/rate blank)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editing.total_amount}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        total_amount: e.target.value,
                        quantity: '',
                        rate: '',
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>Paid amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.paid_amount}
                    onChange={(e) => setEditing({ ...editing, paid_amount: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Payment method</label>
                  <select
                    value={editing.payment_method ?? 'CASH'}
                    onChange={(e) => setEditing({ ...editing, payment_method: e.target.value })}
                  >
                    {['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER'].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Due date</label>
                  <input
                    type="date"
                    value={editing.due_date ?? ''}
                    onChange={(e) => setEditing({ ...editing, due_date: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Buffalo</label>
                  <select
                    value={editing.buffalo_id ?? ''}
                    onChange={(e) => setEditing({ ...editing, buffalo_id: e.target.value })}
                  >
                    <option value="">Farm-wide</option>
                    {buffaloes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name || b.buffalo_code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Receipt / reference</label>
                  <input
                    value={editing.receipt_reference ?? ''}
                    onChange={(e) => setEditing({ ...editing, receipt_reference: e.target.value })}
                  />
                </div>
                <div className="field wide-field">
                  <label>Description / notes</label>
                  <input
                    value={editing.description ?? ''}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="dialog-footer">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button disabled={busy} className="btn">
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </Dialog>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>CATEGORY / GROUP</th>
                <th>VENDOR</th>
                <th>DESCRIPTION</th>
                <th>QUANTITY</th>
                <th>TOTAL</th>
                <th>PAID</th>
                <th>PENDING</th>
                <th>STATUS</th>
                <th>METHOD</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.business_date)}</td>
                  <td>
                    {r.category_name_snapshot}
                    <div className="kpi-foot">{r.category_group_snapshot.replaceAll('_', ' ')}</div>
                  </td>
                  <td>{r.vendor_name_snapshot ?? '—'}</td>
                  <td>{r.description ?? '—'}</td>
                  <td>{r.quantity == null ? '—' : `${r.quantity} ${r.unit ?? ''}`}</td>
                  <td>{money(Number(r.total_amount))}</td>
                  <td>{money(Number(r.paid_amount))}</td>
                  <td>{money(Number(r.pending_amount))}</td>
                  <td>
                    <span className={`tag ${r.payment_status === 'PAID' ? '' : 'gold'}`}>
                      {r.payment_status}
                    </span>
                  </td>
                  <td>{r.payment_method ?? '—'}</td>
                  <td className="expense-row-actions">
                    <Link className="date-chip" href={`/expenses/history/${r.id}`}>
                      View
                    </Link>{' '}
                    <button
                      type="button"
                      className="date-chip"
                      disabled={ledgerExpenseIds.has(r.id) || feedPurchaseExpenseIds.has(r.id)}
                      title={feedPurchaseExpenseIds.has(r.id) ? 'Managed by Feed Purchases. Use the Feed Purchases module.' : ledgerExpenseIds.has(r.id) ? 'This expense has dated payments and is locked to preserve its ledger.' : undefined}
                      onClick={() => setEditing({ ...r })}
                    >
                      Edit
                    </button>{' '}
                    <button
                      type="button"
                      className="date-chip"
                      disabled={ledgerExpenseIds.has(r.id) || feedPurchaseExpenseIds.has(r.id)}
                      title={feedPurchaseExpenseIds.has(r.id) ? 'Managed by Feed Purchases. Use the Feed Purchases module.' : ledgerExpenseIds.has(r.id) ? 'This expense has dated payments and cannot be deleted.' : undefined}
                      onClick={() => setPendingDelete(r)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && <div className="empty">No expenses match these filters.</div>}
        <p className="kpi-foot">
          Showing at most 1,000 most recent expenses. Feed-purchase expenses are managed in Feed Purchases; expenses with dated payment-ledger entries are locked to preserve reconciliation.
        </p>
        <Dialog
          open={!!pendingDelete}
          onOpenChange={(open) => {
            if (!open && !deleteBusy) setPendingDelete(null);
          }}
          labelledBy="delete-expense-title"
          className="delete-dialog"
        >
          {pendingDelete && (
            <>
              <div className="dialog-header">
                <div>
                  <h2 className="dialog-title" id="delete-expense-title">
                    Delete expense?
                  </h2>
                  <p className="dialog-description">
                    This expense will be removed from active records and retained in audit history.
                  </p>
                </div>
                <button
                  className="dialog-close"
                  type="button"
                  aria-label="Close delete dialog"
                  disabled={deleteBusy}
                  onClick={() => setPendingDelete(null)}
                >
                  ×
                </button>
              </div>
              <div className="delete-summary">
                <b>{pendingDelete.category_name_snapshot}</b>
                <span>{formatDate(pendingDelete.business_date)}</span>
                <span>
                  {pendingDelete.vendor_name_snapshot ?? 'No vendor'} ·{' '}
                  {money(Number(pendingDelete.total_amount))}
                </span>
              </div>
              <div className="dialog-footer">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={deleteBusy}
                  onClick={() => setPendingDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn destructive"
                  disabled={deleteBusy}
                  onClick={confirmDelete}
                >
                  {deleteBusy ? 'Deleting…' : 'Delete expense'}
                </button>
              </div>
            </>
          )}
        </Dialog>
      </div>
    </ExpenseShell>
  );
}
