'use client';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { calculateExpenseTotal, expensePaymentStatus } from '@/lib/expenses';
import { ExpenseShell, money, ensureExpenseCategories, todayLocal } from '../shared';
import type { ExpenseBuffaloOption, ExpenseCategory, ExpenseRow, ExpenseVendor } from '@/lib/expense-types';
import { TimedNotice } from '@/components/ui/TimedNotice';
export default function ExpenseHistory() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = Number(searchParams.get('page') ?? '1');
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const sizeParam = Number(searchParams.get('pageSize') ?? '20');
  const pageSize = [10, 20, 50, 100].includes(sizeParam) ? sizeParam : 20;
  const [rows, setRows] = useState<ExpenseRow[]>([]),
    [ledgerExpenseIds, setLedgerExpenseIds] = useState<Set<string>>(new Set()),
    [feedPurchaseExpenseIds, setFeedPurchaseExpenseIds] = useState<Set<string>>(new Set()),
    [categories, setCategories] = useState<Pick<ExpenseCategory, 'id' | 'name' | 'category_group'>[]>([]),
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
    [showMoreFilters, setShowMoreFilters] = useState(true),
    [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'),
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
    const nextRows = e.data ?? [];
    const expenseIds = nextRows.map((expense) => expense.id);
    if (expenseIds.length) {
      const [paymentResult, purchaseResult] = await Promise.all([
        supabase.from('expense_payments').select('expense_id').in('expense_id', expenseIds),
        supabase.from('feed_purchases').select('expense_id').eq('status', 'ACTIVE').in('expense_id', expenseIds),
      ]);
      if (paymentResult.error || purchaseResult.error) {
        setMessage((paymentResult.error ?? purchaseResult.error)!.message);
        setLoadError(true);
        setRows([]);
        setLedgerExpenseIds(new Set());
        setFeedPurchaseExpenseIds(new Set());
        return;
      }
      setLedgerExpenseIds(new Set((paymentResult.data ?? []).map((payment) => payment.expense_id)));
      setFeedPurchaseExpenseIds(new Set((purchaseResult.data ?? []).map((purchase) => purchase.expense_id).filter((id): id is string => Boolean(id))));
    } else {
      setLedgerExpenseIds(new Set());
      setFeedPurchaseExpenseIds(new Set());
    }
    setRows(nextRows);
    setCategories(c.data ?? []);
    setVendors(v.data ?? []);
    setBuffaloes(b.data ?? []);
  }
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [from, to, category, group, vendor, status, method, buffalo, outstandingOnly]);
  const visible = useMemo(() => rows.filter((r) => (`${r.category_name_snapshot} ${r.vendor_name_snapshot ?? ''} ${r.description ?? ''}`).toLowerCase().includes(search.toLowerCase().trim())).sort((left, right) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    if (sort === 'amount') return (Number(left.total_amount) - Number(right.total_amount)) * direction;
    if (sort === 'pending') return (Number(left.pending_amount) - Number(right.pending_amount)) * direction;
    if (sort === 'category') return left.category_name_snapshot.localeCompare(right.category_name_snapshot) * direction;
    return left.business_date.localeCompare(right.business_date) * direction;
  }), [rows, search, sort, sortDirection]);
  const totalAmount = visible.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const totalPaid = visible.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
  const totalOutstanding = visible.reduce((sum, row) => sum + Number(row.pending_amount || 0), 0);
  const categoryBreakdown = useMemo(() => {
    const grouped = new Map<string, { total: number; quantity: number; quantityRows: number; count: number; unit: string | null }>();
    visible.forEach((row) => {
      const name = row.category_name_snapshot || 'Uncategorized';
      const current = grouped.get(name) ?? { total: 0, quantity: 0, quantityRows: 0, count: 0, unit: row.unit ?? null };
      current.total += Number(row.total_amount || 0); current.count += 1;
      if (row.quantity != null && Number.isFinite(Number(row.quantity))) { current.quantity += Number(row.quantity); current.quantityRows += 1; }
      if (current.unit !== row.unit) current.unit = null;
      grouped.set(name, current);
    });
    return [...grouped.entries()].map(([name, value]) => ({ name, ...value })).sort((left, right) => right.total - left.total);
  }, [visible]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = visible.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstResult = visible.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(safePage * pageSize, visible.length);
  function setPagination(nextPage: number, nextSize = pageSize) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage)); params.set('pageSize', String(nextSize));
    router.replace(pathname + '?' + params.toString(), { scroll: false });
  }
  const filterSignature = [from, to, category, group, vendor, status, method, buffalo, outstandingOnly, search].join('|');
  const previousFilterSignature = useRef(filterSignature);
  useEffect(() => {
    if (previousFilterSignature.current !== filterSignature) {
      previousFilterSignature.current = filterSignature;
      if (page !== 1) setPagination(1);
    }
  }, [filterSignature, page]);
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
    if (loadError) {
      setMessage('Expense status could not be verified. Reload and try again.');
      return;
    }
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card"><p className="kpi-foot">Total expenses</p><p className="mt-1 text-2xl font-semibold">{money(totalAmount)}</p><p className="kpi-foot">Across {visible.length} matching records</p></div>
        <div className="card"><p className="kpi-foot">Paid</p><p className="mt-1 text-2xl font-semibold">{money(totalPaid)}</p><p className="kpi-foot">Recorded against these expenses</p></div>
        <div className="card"><p className="kpi-foot">Outstanding</p><p className="mt-1 text-2xl font-semibold">{money(totalOutstanding)}</p><p className="kpi-foot">Remaining to be paid</p></div>
        <div className="card"><p className="kpi-foot">Transactions</p><p className="mt-1 text-2xl font-semibold">{visible.length.toLocaleString('en-IN')}</p><p className="kpi-foot">Matching current filters</p></div>
      </div>
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Spending breakdown</h2><p className="kpi-foot">Category totals and recorded quantities for the same filtered results.</p></div><span className="text-sm text-muted-foreground">{categoryBreakdown.length} categories</span></div>
          {categoryBreakdown.length ? <div className="space-y-3">{categoryBreakdown.slice(0, 8).map((item) => <div key={item.name} className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><p className="font-medium">{item.name}</p><p className="kpi-foot">{item.quantityRows ? `${item.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })}${item.unit ? ` ${item.unit}` : ' units'} recorded · ${item.count} ${item.count === 1 ? 'transaction' : 'transactions'}` : `${item.count} ${item.count === 1 ? 'transaction' : 'transactions'} · quantity not recorded`}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${totalAmount > 0 ? Math.min(100, item.total / totalAmount * 100) : 0}%` }} /></div></div><p className="font-semibold tabular-nums">{money(item.total)} <span className="text-xs font-normal text-muted-foreground">{totalAmount ? `${(item.total / totalAmount * 100).toFixed(1)}%` : '0%'}</span></p></div>)}</div> : <p className="text-sm text-muted-foreground">No spending to summarize for the current filters.</p>}
        </div>
      <div className="card space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(220px,auto)_minmax(0,1fr)] md:items-end">
          <div className="field min-w-0">
            <Label className="mb-2 block">Date range</Label>
            <DateRangePicker from={from} to={to} max={todayLocal()} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); }} />
          </div>
          <div className="field min-w-0">
            <Label htmlFor="expense-history-search">Search expenses</Label>
            <Input id="expense-history-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search category, vendor or description…" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setShowMoreFilters((current) => !current)} aria-expanded={showMoreFilters}>
              {showMoreFilters ? 'Hide filters' : 'More filters'}
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{[category, group, vendor, status, method, buffalo].filter(Boolean).length + (outstandingOnly ? 1 : 0)}</span>
            </Button>
            {outstandingOnly && <span className="rounded-full border px-3 py-1 text-sm">Outstanding only</span>}
            {(from || to) && <span className="rounded-full border px-3 py-1 text-sm">Date range applied</span>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{visible.length} matching {visible.length === 1 ? 'expense' : 'expenses'}</span>
            <Button type="button" variant="ghost" onClick={() => { setFrom(''); setTo(''); setSearch(''); setCategory(''); setGroup(''); setVendor(''); setStatus(''); setMethod(''); setBuffalo(''); setOutstandingOnly(false); setSort('date'); }}>Reset filters</Button>
          </div>
        </div>
        {showMoreFilters && (
          <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2 xl:grid-cols-6">
            <div className="field min-w-0"><Label>Category</Label><Select value={category || 'all'} onValueChange={(value) => setCategory(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="field min-w-0"><Label>Category group</Label><Select value={group || 'all'} onValueChange={(value) => setGroup(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All groups</SelectItem>{['FEED','ANIMAL','FARM_OPERATIONS','TRANSPORT','UTILITIES','LABOUR','EQUIPMENT','ADMIN','OTHER'].map((g) => <SelectItem key={g} value={g}>{g.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
            <div className="field min-w-0"><Label>Vendor</Label><Select value={vendor || 'all'} onValueChange={(value) => setVendor(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All vendors</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="field min-w-0"><Label>Payment status</Label><Select value={status || 'all'} onValueChange={(value) => setStatus(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{['PAID','PARTIAL','CREDIT'].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            <div className="field min-w-0"><Label>Payment method</Label><Select value={method || 'all'} onValueChange={(value) => setMethod(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All methods</SelectItem>{['CASH','UPI','BANK_TRANSFER','CARD','OTHER','CREDIT'].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
            <div className="field min-w-0"><Label>Buffalo</Label><Select value={buffalo || 'all'} onValueChange={(value) => setBuffalo(value === 'all' ? '' : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All buffaloes</SelectItem>{buffaloes.map((b) => <SelectItem key={b.id} value={b.id}>{b.name || b.buffalo_code}</SelectItem>)}</SelectContent></Select></div>
            <div className="field min-w-0"><Label>Sort by</Label><Select value={sort} onValueChange={setSort}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date">Date</SelectItem><SelectItem value="amount">Amount</SelectItem><SelectItem value="category">Category</SelectItem><SelectItem value="pending">Pending amount</SelectItem></SelectContent></Select><Select value={sortDirection} onValueChange={(value) => setSortDirection(value as "asc" | "desc")}><SelectTrigger aria-label="Sort direction"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="desc">Descending</SelectItem><SelectItem value="asc">Ascending</SelectItem></SelectContent></Select></div>
            <label className="flex items-center gap-3 self-end rounded-md border p-3 text-sm"><Checkbox checked={outstandingOnly} onCheckedChange={(checked) => setOutstandingOnly(checked === true)} /><span>Outstanding only</span></label>
          </div>
        )}
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
        <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]">
          <Table className="min-w-[1200px] [&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
            <TableHeader><TableRow>
              <TableHead>DATE</TableHead><TableHead>CATEGORY / GROUP</TableHead><TableHead>VENDOR</TableHead><TableHead>DESCRIPTION</TableHead><TableHead>QUANTITY</TableHead><TableHead>TOTAL</TableHead><TableHead>PAID</TableHead><TableHead>PENDING</TableHead><TableHead>STATUS</TableHead><TableHead>METHOD</TableHead><TableHead>ACTIONS</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {pageRows.map((r) => <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{formatDate(r.business_date)}</TableCell>
                <TableCell>{r.category_name_snapshot}<div className="text-xs text-muted-foreground">{r.category_group_snapshot.replaceAll('_', ' ')}</div></TableCell>
                <TableCell>{r.vendor_name_snapshot ?? '—'}</TableCell><TableCell>{r.description ?? '—'}</TableCell><TableCell>{r.quantity == null ? '—' : `${r.quantity} ${r.unit ?? ''}`}</TableCell>
                <TableCell>{money(Number(r.total_amount))}</TableCell><TableCell>{money(Number(r.paid_amount))}</TableCell><TableCell>{money(Number(r.pending_amount))}</TableCell>
                <TableCell><Badge variant={r.payment_status === 'PAID' ? 'secondary' : 'outline'}>{r.payment_status}</Badge></TableCell><TableCell>{r.payment_method ?? '—'}</TableCell>
                <TableCell><div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild><Link href={`/expenses/history/${r.id}`}>View</Link></Button>
                  <Button type="button" variant="outline" size="sm" disabled={ledgerExpenseIds.has(r.id) || feedPurchaseExpenseIds.has(r.id)} title={feedPurchaseExpenseIds.has(r.id) ? 'Managed by Feed Purchases. Use the Feed Purchases module.' : ledgerExpenseIds.has(r.id) ? 'This expense has dated payments and is locked to preserve its ledger.' : undefined} onClick={() => setEditing({ ...r })}>Edit</Button>
                  <Button type="button" variant="outline" size="sm" disabled={ledgerExpenseIds.has(r.id) || feedPurchaseExpenseIds.has(r.id)} title={feedPurchaseExpenseIds.has(r.id) ? 'Managed by Feed Purchases. Use the Feed Purchases module.' : ledgerExpenseIds.has(r.id) ? 'This expense has dated payments and cannot be deleted.' : undefined} onClick={() => setPendingDelete(r)}>Delete</Button>
                </div></TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </div>
        {!visible.length && <div className="empty">No expenses match these filters.</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-muted-foreground">Showing {firstResult}–{lastResult} of {visible.length}</p><div className="flex flex-wrap items-center gap-2"><Label htmlFor="expense-page-size">Rows per page</Label><Select value={String(pageSize)} onValueChange={(value) => setPagination(1, Number(value))}><SelectTrigger id="expense-page-size" className="w-24"><SelectValue /></SelectTrigger><SelectContent>{[10, 20, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPagination(safePage - 1)}>Previous</Button><span className="px-2 text-sm">Page {safePage} of {pageCount}</span><Button type="button" variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPagination(safePage + 1)}>Next</Button></div></div>
        <p className="kpi-foot">Feed-purchase expenses are managed in Feed Purchases; expenses with dated payment-ledger entries are locked to preserve reconciliation. Linked purchase expenses are counted once.</p>
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
    </ExpenseShell>
  );
}
