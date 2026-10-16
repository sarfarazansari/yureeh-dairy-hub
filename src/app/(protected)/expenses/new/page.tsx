'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { DatePicker } from '@/components/ui/date-picker';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateExpenseTotal, calculatePending, expensePaymentStatus, UNITS } from '@/lib/expenses';
import { ExpenseShell, money, ensureExpenseCategories, todayLocal } from '../shared';
import { TimedNotice } from '@/components/ui/TimedNotice';
import type { ExpenseCategory } from '@/lib/expense-types';
import { useNewExpenseOptionsQuery } from '@/features/expenses/expense.queries';
export default function NewExpense() {
  const [ownerId, setOwnerId] = useState(''),
    [optionsReady, setOptionsReady] = useState(false),
    [date, setDate] = useState(todayLocal()),
    [categoryId, setCategoryId] = useState(''),
    [vendorId, setVendorId] = useState(''),
    [buffaloId, setBuffaloId] = useState(''),
    [description, setDescription] = useState(''),
    [quantity, setQuantity] = useState(''),
    [unit, setUnit] = useState(''),
    [rate, setRate] = useState(''),
    [manual, setManual] = useState(''),
    [useQuantity, setUseQuantity] = useState(false),
    [paid, setPaid] = useState('0'),
    [method, setMethod] = useState('CASH'),
    [due, setDue] = useState(''),
    [notes, setNotes] = useState(''),
    [receipt, setReceipt] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const optionsQuery = useNewExpenseOptionsQuery(ownerId, optionsReady);
  const categories = (optionsQuery.data?.categories ?? []) as ExpenseCategory[];
  const vendors = optionsQuery.data?.vendors ?? [];
  const buffaloes = optionsQuery.data?.buffaloes ?? [];

  useEffect(() => {
    let alive = true;
    async function initialize() {
      if (!supabase) {
        setMessage('Supabase is not configured.');
        return;
      }
      try {
        await ensureExpenseCategories(supabase);
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) throw error ?? new Error('Session expired. Sign in again.');
        if (alive) {
          setOwnerId(user.id);
          setOptionsReady(true);
        }
      } catch (error) {
        if (alive) setMessage(error instanceof Error ? error.message : 'Could not load expense form options.');
      }
    }
    void initialize();
    return () => { alive = false; };
  }, []);
  const category = categories.find((c) => c.id === categoryId);
  useEffect(() => {
    if (optionsQuery.error) setMessage(optionsQuery.error.message);
  }, [optionsQuery.error]);
  const amount = useMemo(() => {
    if (useQuantity) {
      if (!quantity || !rate) return 0;
      try {
        return calculateExpenseTotal(quantity, rate);
      } catch {
        return 0;
      }
    }
    return Number(manual) || 0;
  }, [useQuantity, quantity, rate, manual]);
  const paidNumber = Number(paid) || 0;
  const pending = useMemo(() => {
    try {
      return calculatePending(amount, paidNumber);
    } catch {
      return amount;
    }
  }, [amount, paidNumber]);
  const status =
    amount && paidNumber <= amount ? expensePaymentStatus(amount, paidNumber) : 'CREDIT';
  function selectCategory(id: string) {
    setCategoryId(id);
    const c = categories.find((x) => x.id === id);
    if (c) {
      setUseQuantity(Boolean(c.is_quantity_based));
      setUnit(c.default_unit ?? '');
    }
  }
  function selectStatus(s: string) {
    if (s === 'PAID') setPaid(String(amount));
    else if (s === 'CREDIT') setPaid('0');
    else if (Number(paid) <= 0 || Number(paid) >= amount) setPaid(String(Math.max(0, amount / 2)));
    if (s === 'CREDIT') setMethod('CREDIT');
    else if (method === 'CREDIT') setMethod('CASH');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMessage('');
    if (!date || date > todayLocal()) {
      setMessage('Business date must be today or an earlier date.');
      return;
    }
    if (due && due < date) {
      setMessage('Due date cannot be earlier than the business date.');
      return;
    }
    if (!supabase || !category) {
      setMessage('Choose an active expense category.');
      return;
    }
    if (!amount || amount <= 0) {
      setMessage('Enter an expense amount greater than zero.');
      return;
    }
    try {
      if (paidNumber > amount) throw new Error('Paid amount cannot exceed total.');
      if (useQuantity && (!quantity || !rate))
        throw new Error('Enter both quantity and rate, or switch to direct total entry.');
      setBusy(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Session expired. Sign in again.');
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        business_date: date,
        category_id: category.id,
        vendor_id: vendorId || null,
        buffalo_id: buffaloId || null,
        description: description || null,
        quantity: useQuantity ? Number(quantity) : null,
        unit: useQuantity ? unit || category.default_unit || null : null,
        rate: useQuantity ? Number(rate) : null,
        total_amount: amount,
        payment_status: status,
        paid_amount: paidNumber,
        payment_method: status === 'CREDIT' ? 'CREDIT' : method,
        due_date: due || null,
        notes: notes || null,
        receipt_reference: receipt || null,
      });
      if (error) throw error;
      setMessage('Expense saved.');
      setDescription('');
      setQuantity('');
      setRate('');
      setManual('');
      setPaid('0');
      setNotes('');
      setReceipt('');
      setVendorId('');
      setBuffaloId('');
      setDue('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save expense.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ExpenseShell title="New expense" subtitle="Record a purchase, payment or farm cost">
      <div className="row" style={{ marginBottom: 14 }}>
        <Button variant="outline" size="sm" asChild><Link href="/expenses">← Back to expenses</Link></Button>
      </div>
      <form className="layout" onSubmit={save} aria-busy={busy}>
        <div className="card">
          <h2 className="section-title">Expense details</h2>
          <div className="expense-form-grid">
            <div className="field">
              <Label htmlFor="expense-business-date">Business date</Label>
              <DatePicker id="expense-business-date" value={date} max={todayLocal()} onChange={setDate} ariaLabel="Business date" />
              <p className="kpi-foot">Today or an earlier date.</p>
            </div>
            <div className="field">
              <Label htmlFor="expense-category">Category</Label>
              <Select value={categoryId || undefined} onValueChange={selectCategory} required><SelectTrigger id="expense-category"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {c.category_group.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="field">
              <Label htmlFor="expense-vendor">Vendor (optional)</Label>
              <Select value={vendorId || 'none'} onValueChange={(value) => setVendorId(value === 'none' ? '' : value)}><SelectTrigger id="expense-vendor"><SelectValue placeholder="No vendor" /></SelectTrigger><SelectContent><SelectItem value="none">No vendor</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
              <Link href="/expenses/vendors" className="kpi-foot">
                Manage vendors →
              </Link>
            </div>
            <div className="field wide-field">
              <Label htmlFor="expense-description">Description</Label>
              <Input
                id="expense-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was purchased or paid for?"
              />
            </div>
            <div className="field wide-field">
              <Label>
                <Checkbox checked={useQuantity} onCheckedChange={(checked) => setUseQuantity(checked === true)} />{' '}
                &nbsp;Calculate from quantity × rate
              </Label>
            </div>
            {useQuantity ? (
              <>
                <div className="field">
                  <Label htmlFor="expense-quantity">Quantity</Label>
                  <Input
                    id="expense-quantity"
                    required
                    type="number"
                    min="0.001"
                    step="0.001"
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="field">
                  <Label htmlFor="expense-unit">Unit</Label>
                  <Select value={unit || 'none'} onValueChange={(value) => setUnit(value === 'none' ? '' : value)}>
                    <SelectTrigger id="expense-unit"><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No unit</SelectItem>
                      {UNITS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p id="expense-unit-help" className="kpi-foot">Choose from the supported units. Edit the category to change its default.</p>
                </div>
                <div className="field">
                  <Label htmlFor="expense-rate">Rate · ₹ per unit</Label>
                  <Input
                    id="expense-rate"
                    required
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    inputMode="decimal"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="field">
                <Label htmlFor="expense-total">Total amount · ₹</Label>
                <Input
                  id="expense-total"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <Label htmlFor="expense-payment-status">Payment status</Label>
              <Select value={status} onValueChange={selectStatus}><SelectTrigger id="expense-payment-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PAID">Paid</SelectItem><SelectItem value="PARTIAL">Partial</SelectItem><SelectItem value="CREDIT">Credit</SelectItem></SelectContent></Select>
            </div>
            <div className="field">
              <Label htmlFor="expense-paid">Paid amount · ₹</Label>
              <Input
                id="expense-paid"
                type="number"
                min="0"
                max={amount}
                step="0.01"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
            </div>
            <div className="field">
              <Label htmlFor="expense-payment-method">Payment method</Label>
              <Select value={status === 'CREDIT' ? 'CREDIT' : method} disabled={status === 'CREDIT'} onValueChange={setMethod}><SelectTrigger id="expense-payment-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem><SelectItem value="CARD">Card</SelectItem><SelectItem value="OTHER">Other</SelectItem><SelectItem value="CREDIT">Credit</SelectItem></SelectContent></Select>
            </div>
            <div className="field">
              <Label htmlFor="expense-due-date">Due date</Label>
              <DatePicker id="expense-due-date" value={due} min={date} onChange={setDue} clearable ariaLabel="Due date" aria-invalid={!!due && due < date} />
              <p className="kpi-foot">Optional; cannot be earlier than the business date.</p>
            </div>
            <div className="field">
              <Label htmlFor="expense-buffalo">Buffalo (optional)</Label>
              <Select value={buffaloId || 'none'} onValueChange={(value) => setBuffaloId(value === 'none' ? '' : value)}><SelectTrigger id="expense-buffalo"><SelectValue placeholder="Farm-wide expense" /></SelectTrigger><SelectContent><SelectItem value="none">Farm-wide expense</SelectItem>{buffaloes.map((b) => <SelectItem key={b.id} value={b.id}>{b.name || b.buffalo_code}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="field">
              <Label htmlFor="expense-receipt">Receipt / reference</Label>
              <Input
                id="expense-receipt"
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                placeholder="Invoice or transaction reference"
              />
            </div>
            <div className="field wide-field">
              <Label htmlFor="expense-notes">Notes</Label>
              <Textarea id="expense-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" rows={3} />
            </div>
          </div>
          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
          <Button type="submit" disabled={busy || !categories.length} aria-live="polite">
            {busy ? <><LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Saving…</> : 'Save expense'}
          </Button>
        </div>
        <aside className="card">
          <div className="eyebrow">PAYMENT SUMMARY</div>
          <div className="amount">
            <span>TOTAL EXPENSE</span>
            <strong>{money(amount)}</strong>
            <small>
              {useQuantity && quantity && rate
                ? `${quantity} ${unit || category?.default_unit || 'units'} × ${money(Number(rate))}`
                : 'Direct total amount'}
            </small>
          </div>
          <div className="row" style={{ padding: '14px 0' }}>
            <span className="sub">Paid</span>
            <b>{money(paidNumber)}</b>
          </div>
          <div className="row" style={{ padding: '14px 0', borderTop: '1px solid var(--line)' }}>
            <span className="sub">Pending</span>
            <b>{money(pending)}</b>
          </div>
          <span className={`tag ${status === 'PAID' ? '' : 'gold'}`}>{status}</span>
          <p className="kpi-foot" style={{ lineHeight: 1.7, marginTop: 15 }}>
            Expense category and vendor names are stored as snapshots so later edits won’t rewrite
            this record’s history.
          </p>
        </aside>
      </form>
    </ExpenseShell>
  );
}
