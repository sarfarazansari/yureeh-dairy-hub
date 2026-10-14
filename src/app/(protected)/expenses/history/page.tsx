'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/date-format';
import Link from 'next/link';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateExpenseTotal, expensePaymentStatus } from '@/lib/expenses';
import { ExpenseShell, money, ensureExpenseCategories, todayLocal } from '../shared';
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
        <div className="mb-4 max-w-md"><Label className="mb-2 block">Date range</Label><DateRangePicker from={from} to={to} max={todayLocal()} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); }} /></div>
          <div className="field">
            <Label>Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Category, vendor, description"
            />
          </div>
          <div className="field">
            <Label>Category</Label>
            <Select value={category || 'all'} onValueChange={(value) => setCategory(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label>Category group</Label>
            <Select value={group || 'all'} onValueChange={(value) => setGroup(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All groups</SelectItem>{['FEED','ANIMAL','FARM_OPERATIONS','TRANSPORT','UTILITIES','LABOUR','EQUIPMENT','ADMIN','OTHER'].map((g) => <SelectItem key={g} value={g}>{g.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label>Vendor</Label>
            <Select value={vendor || 'all'} onValueChange={(value) => setVendor(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All vendors</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label>Payment status</Label>
            <Select value={status || 'all'} onValueChange={(value) => setStatus(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{['PAID','PARTIAL','CREDIT'].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label>Payment method</Label>
            <Select value={method || 'all'} onValueChange={(value) => setMethod(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All methods</SelectItem>{['CASH','UPI','BANK_TRANSFER','CARD','OTHER','CREDIT'].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label>Buffalo</Label>
            <Select value={buffalo || 'all'} onValueChange={(value) => setBuffalo(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All buffaloes</SelectItem>{buffaloes.map((b) => <SelectItem key={b.id} value={b.id}>{b.name || b.buffalo_code}</SelectItem>)}</SelectContent></Select>
          </div>
          <Label className="field">
            <span>Outstanding only</span>
            <Checkbox checked={outstandingOnly} onCheckedChange={(checked) => setOutstandingOnly(checked === true)} />
          </Label>
          <div className="field">
            <Label>Sort by</Label>
            <Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date">Date</SelectItem><SelectItem value="amount">Amount</SelectItem><SelectItem value="category">Category</SelectItem><SelectItem value="pending">Pending amount</SelectItem></SelectContent></Select>
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
                  <Label>Date</Label>
                  <DatePicker value={editing.business_date} max={new Date().toLocaleDateString('en-CA')} onChange={(value) => setEditing({ ...editing, business_date: value })} ariaLabel="Expense date" />
                </div>
                <div className="field">
                  <Label>Category</Label>
                  <Select value={editing.category_id} onValueChange={(value) => setEditing({ ...editing, category_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="field">
                  <Label>Vendor</Label>
                  <Select value={editing.vendor_id || 'none'} onValueChange={(value) => setEditing({ ...editing, vendor_id: value === 'none' ? '' : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No vendor</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="field">
                  <Label>Quantity (blank for direct amount)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    value={editing.quantity ?? ''}
                    onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                  />
                </div>
                <div className="field">
                  <Label>Unit</Label>
                  <Input
                    value={editing.unit ?? ''}
                    onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                  />
                </div>
                <div className="field">
                  <Label>Rate</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={editing.rate ?? ''}
                    onChange={(e) => setEditing({ ...editing, rate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <Label>Direct total (used if quantity/rate blank)</Label>
                  <Input
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
                  <Label>Paid amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.paid_amount}
                    onChange={(e) => setEditing({ ...editing, paid_amount: e.target.value })}
                  />
                </div>
                <div className="field">
                  <Label>Payment method</Label>
                  <Select value={editing.payment_method ?? 'CASH'} onValueChange={(value) => setEditing({ ...editing, payment_method: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['CASH','UPI','BANK_TRANSFER','CARD','OTHER'].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="field">
                  <Label>Due date</Label>
                  <DatePicker value={editing.due_date ?? ''} min={editing.business_date} clearable onChange={(value) => setEditing({ ...editing, due_date: value })} ariaLabel="Due date" />
                </div>
                <div className="field">
                  <Label>Buffalo</Label>
                  <Select value={editing.buffalo_id || 'none'} onValueChange={(value) => setEditing({ ...editing, buffalo_id: value === 'none' ? '' : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Farm-wide</SelectItem>{buffaloes.map((b) => <SelectItem key={b.id} value={b.id}>{b.name || b.buffalo_code}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="field">
                  <Label>Receipt / reference</Label>
                  <Input
                    value={editing.receipt_reference ?? ''}
                    onChange={(e) => setEditing({ ...editing, receipt_reference: e.target.value })}
                  />
                </div>
                <div className="field wide-field">
                  <Label>Description / notes</Label>
                  <Input
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
