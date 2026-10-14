'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog as ShadcnDialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/date-format';
import Link from 'next/link';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DatePicker } from '@/components/ui/date-picker';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateExpenseTotal, expensePaymentStatus } from '@/lib/expenses';
import { ExpenseShell, money, ensureExpenseCategories, todayLocal } from '../shared';
import type { ExpenseBuffaloOption, ExpenseCategory, ExpenseRow, ExpenseVendor } from '@/lib/expense-types';
import { TimedNotice } from '@/components/ui/TimedNotice';
export default function ExpenseHistory() {
  const [rows, setRows] = useState<ExpenseRow[]>([]),
    [ledgerExpenseIds, setLedgerExpenseIds] = useState<Set<string>>(new Set()),
    [feedPurchaseExpenseIds, setFeedPurchaseExpenseIds] = useState<Set<string>>(new Set()),
    [categories, setCategories] = useState<
      Pick<ExpenseCategory, 'id' | 'name' | 'category_group'>[]
    >([]),
    [loadError, setLoadError] = useState(false),
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
    if (!supabase) {
      setMessage('Supabase is not configured.');
      setLoadError(true);
      return;
    }
    setLoadError(false);
    try {
      await ensureExpenseCategories(supabase);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load categories');
      setLoadError(true);
      return;
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
    if (e.error || c.error || v.error || b.error) {
      const error = e.error ?? c.error ?? v.error ?? b.error;
      setMessage(error.message);
      setLoadError(true);
      return;
    }
    setRows(e.data ?? []);
    const expenseIds = (e.data ?? []).map((expense) => expense.id);
    if (expenseIds.length) {
      const [paymentResult, purchaseResult] = await Promise.all([
        supabase.from('expense_payments').select('expense_id').in('expense_id', expenseIds),
        supabase.from('feed_purchases').select('expense_id').eq('status', 'ACTIVE').in('expense_id', expenseIds),
      ]);
      if (paymentResult.error || purchaseResult.error) {
        setMessage((paymentResult.error ?? purchaseResult.error)!.message);
        setLoadError(true);
        return;
      }
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
    if (!editing || !supabase || busy) return;
    setMessage('');
    setBusy(true);
    try {
      if (loadError) throw new Error('Expense status could not be verified. Reload and try again.');
      if (ledgerExpenseIds.has(editing.id) || feedPurchaseExpenseIds.has(editing.id)) {
        throw new Error('This expense is locked. Use its payment ledger or Feed Purchases workflow.');
      }
      if (!editing.business_date || editing.business_date > todayLocal()) {
        throw new Error('Business date must be today or earlier.');
      }
      if (editing.due_date && editing.due_date < editing.business_date) {
        throw new Error('Due date cannot be earlier than the business date.');
      }
      if (!editing.category_id || !categories.some((item) => item.id === editing.category_id)) {
        throw new Error('Choose a valid expense category.');
      }
      const amount =
        editing.quantity !== '' &&
        editing.quantity != null &&
        editing.rate !== '' &&
        editing.rate != null
          ? calculateExpenseTotal(editing.quantity, editing.rate)
          : Number(editing.total_amount);
      const paid = Number(editing.paid_amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Total must be greater than zero.');
      if (!Number.isFinite(paid) || paid < 0 || paid > amount) {
        throw new Error('Paid amount must be between zero and the total amount.');
      }
      if (editing.quantity !== '' && editing.quantity != null && Number(editing.quantity) <= 0) {
        throw new Error('Quantity must be greater than zero.');
      }
      if (editing.rate !== '' && editing.rate != null && Number(editing.rate) <= 0) {
        throw new Error('Rate must be greater than zero.');
      }
      if (editing.quantity !== '' && editing.quantity != null && (!editing.unit || !String(editing.unit).trim())) {
        throw new Error('Choose a unit for quantity-based expenses.');
      }
      const payment_status = expensePaymentStatus(amount, paid);
      const { error } = await supabase
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
    if (!pendingDelete || !supabase || deleteBusy) return;
    setDeleteBusy(true);
    try {
      if (ledgerExpenseIds.has(pendingDelete.id) || feedPurchaseExpenseIds.has(pendingDelete.id)) {
        throw new Error('This expense is locked and cannot be deleted from expense history.');
      }
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
            <Label htmlFor="expense-history-search">Search</Label>
            <Input
              id="expense-history-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Category, vendor, description"
            />
          </div>
          <div className="field">
            <Label htmlFor="expense-filter-category">Category</Label>
            <Select value={category || 'all'} onValueChange={(value) => setCategory(value === 'all' ? '' : value)}><SelectTrigger id="expense-filter-category"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label htmlFor="expense-filter-group">Category group</Label>
            <Select value={group || 'all'} onValueChange={(value) => setGroup(value === 'all' ? '' : value)}><SelectTrigger id="expense-filter-group"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All groups</SelectItem>{['FEED','ANIMAL','FARM_OPERATIONS','TRANSPORT','UTILITIES','LABOUR','EQUIPMENT','ADMIN','OTHER'].map((g) => <SelectItem key={g} value={g}>{g.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label htmlFor="expense-filter-vendor">Vendor</Label>
            <Select value={vendor || 'all'} onValueChange={(value) => setVendor(value === 'all' ? '' : value)}><SelectTrigger id="expense-filter-vendor"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All vendors</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label htmlFor="expense-filter-status">Payment status</Label>
            <Select value={status || 'all'} onValueChange={(value) => setStatus(value === 'all' ? '' : value)}><SelectTrigger id="expense-filter-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{['PAID','PARTIAL','CREDIT'].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label htmlFor="expense-filter-method">Payment method</Label>
            <Select value={method || 'all'} onValueChange={(value) => setMethod(value === 'all' ? '' : value)}><SelectTrigger id="expense-filter-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All methods</SelectItem>{['CASH','UPI','BANK_TRANSFER','CARD','OTHER','CREDIT'].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label htmlFor="expense-filter-buffalo">Buffalo</Label>
            <Select value={buffalo || 'all'} onValueChange={(value) => setBuffalo(value === 'all' ? '' : value)}><SelectTrigger id="expense-filter-buffalo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All buffaloes</SelectItem>{buffaloes.map((b) => <SelectItem key={b.id} value={b.id}>{b.name || b.buffalo_code}</SelectItem>)}</SelectContent></Select>
          </div>
          <Label className="field">
            <span>Outstanding only</span>
            <Checkbox checked={outstandingOnly} onCheckedChange={(checked) => setOutstandingOnly(checked === true)} />
          </Label>
          <div className="field">
            <Label htmlFor="expense-filter-sort">Sort by</Label>
            <Select value={sort} onValueChange={setSort}><SelectTrigger id="expense-filter-sort"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date">Date</SelectItem><SelectItem value="amount">Amount</SelectItem><SelectItem value="category">Category</SelectItem><SelectItem value="pending">Pending amount</SelectItem></SelectContent></Select>
          </div>
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <ShadcnDialog open={!!editing} onOpenChange={(open) => { if (!open && !busy) setEditing(null); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          {editing && (
            <form className="expense-edit-form" onSubmit={save}>
              <DialogHeader>
                <div>
                  <p className="eyebrow">EXPENSE</p>
                  <DialogTitle id="edit-expense-title">
                    Edit expense
                  </DialogTitle>
                  <DialogDescription>
                    {editing.category_name_snapshot} · {formatDate(editing.business_date)}
                  </DialogDescription>
                </div>
              </DialogHeader>
              <div className="expense-form-grid">
                <div className="field">
                  <Label htmlFor="expense-edit-date">Date</Label>
                  <DatePicker id="expense-edit-date" value={editing.business_date} max={todayLocal()} onChange={(value) => setEditing({ ...editing, business_date: value })} ariaLabel="Expense date" />
                </div>
                <div className="field">
                  <Label htmlFor="expense-edit-category">Category</Label>
                  <Select value={editing.category_id} onValueChange={(value) => setEditing({ ...editing, category_id: value })}><SelectTrigger id="expense-edit-category"><SelectValue /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="field">
                  <Label htmlFor="expense-edit-vendor">Vendor</Label>
                  <Select value={editing.vendor_id || 'none'} onValueChange={(value) => setEditing({ ...editing, vendor_id: value === 'none' ? '' : value })}><SelectTrigger id="expense-edit-vendor"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No vendor</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="field">
                  <Label htmlFor="expense-edit-quantity">Quantity (blank for direct amount)</Label>
                  <Input
                    id="expense-edit-quantity"
                    type="number"
                    min="0"
                    step="0.001"
                    value={editing.quantity ?? ''}
                    onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                  />
                </div>
                <div className="field">
                  <Label htmlFor="expense-edit-unit">Unit</Label>
                  <Input
                    id="expense-edit-unit"
                    value={editing.unit ?? ''}
                    onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                  />
                </div>
                <div className="field">
                  <Label htmlFor="expense-edit-rate">Rate</Label>
                  <Input
                    id="expense-edit-rate"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={editing.rate ?? ''}
                    onChange={(e) => setEditing({ ...editing, rate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <Label htmlFor="expense-edit-total">Direct total (used if quantity/rate blank)</Label>
                  <Input
                    id="expense-edit-total"
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
                  <Label htmlFor="expense-edit-paid">Paid amount</Label>
                  <Input
                    id="expense-edit-paid"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.paid_amount}
                    onChange={(e) => setEditing({ ...editing, paid_amount: e.target.value })}
                  />
                </div>
                <div className="field">
                  <Label htmlFor="expense-edit-method">Payment method</Label>
                  <Select value={editing.payment_method ?? 'CASH'} onValueChange={(value) => setEditing({ ...editing, payment_method: value })}><SelectTrigger id="expense-edit-method"><SelectValue /></SelectTrigger><SelectContent>{['CASH','UPI','BANK_TRANSFER','CARD','OTHER'].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="field">
                  <Label htmlFor="expense-edit-due">Due date</Label>
                  <DatePicker id="expense-edit-due" value={editing.due_date ?? ''} min={editing.business_date} clearable onChange={(value) => setEditing({ ...editing, due_date: value })} ariaLabel="Due date" />
                  <p className="kpi-foot">Due date cannot be before the business date.</p>
                </div>
                <div className="field">
                  <Label htmlFor="expense-edit-buffalo">Buffalo</Label>
                  <Select value={editing.buffalo_id || 'none'} onValueChange={(value) => setEditing({ ...editing, buffalo_id: value === 'none' ? '' : value })}><SelectTrigger id="expense-edit-buffalo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Farm-wide</SelectItem>{buffaloes.map((b) => <SelectItem key={b.id} value={b.id}>{b.name || b.buffalo_code}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="field">
                  <Label htmlFor="expense-edit-receipt">Receipt / reference</Label>
                  <Input
                    id="expense-edit-receipt"
                    value={editing.receipt_reference ?? ''}
                    onChange={(e) => setEditing({ ...editing, receipt_reference: e.target.value })}
                  />
                </div>
                <div className="field wide-field">
                  <Label htmlFor="expense-edit-description">Description / notes</Label>
                  <Textarea
                    id="expense-edit-description"
                    rows={3}
                    value={editing.description ?? ''}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
              </DialogFooter>
            </form>
          )}
          </DialogContent>
        </ShadcnDialog>
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ledgerExpenseIds.has(r.id) || feedPurchaseExpenseIds.has(r.id)}
                      title={feedPurchaseExpenseIds.has(r.id) ? 'Managed by Feed Purchases. Use the Feed Purchases module.' : ledgerExpenseIds.has(r.id) ? 'This expense has dated payments and is locked to preserve its ledger.' : undefined}
                      onClick={() => setEditing({ ...r })}
                    >
                      Edit
                    </Button>{' '}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ledgerExpenseIds.has(r.id) || feedPurchaseExpenseIds.has(r.id)}
                      title={feedPurchaseExpenseIds.has(r.id) ? 'Managed by Feed Purchases. Use the Feed Purchases module.' : ledgerExpenseIds.has(r.id) ? 'This expense has dated payments and cannot be deleted.' : undefined}
                      onClick={() => setPendingDelete(r)}
                    >
                      Delete
                    </Button>
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
        <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !deleteBusy) setPendingDelete(null); }}>
          <AlertDialogContent>
          {pendingDelete && (
            <>
              <AlertDialogHeader>
                <div>
                  <AlertDialogTitle id="delete-expense-title">
                    Delete expense?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This expense will be removed from active records and retained in audit history.
                  </AlertDialogDescription>
                </div>
              </AlertDialogHeader>
              <div className="delete-summary">
                <b>{pendingDelete.category_name_snapshot}</b>
                <span>{formatDate(pendingDelete.business_date)}</span>
                <span>
                  {pendingDelete.vendor_name_snapshot ?? 'No vendor'} ·{' '}
                  {money(Number(pendingDelete.total_amount))}
                </span>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteBusy} onClick={() => setPendingDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction asChild><Button type="button" variant="destructive" disabled={deleteBusy} onClick={(event) => { event.preventDefault(); void confirmDelete(); }}>{deleteBusy ? 'Deleting…' : 'Delete expense'}</Button></AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ExpenseShell>
  );
}
