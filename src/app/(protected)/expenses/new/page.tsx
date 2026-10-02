'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  calculateExpenseTotal,
  calculatePending,
  expensePaymentStatus,
  UNITS,
} from '@/lib/expenses';
import { ExpenseShell, money, ensureExpenseCategories, todayLocal } from '../shared';
import { TimedNotice } from '@/components/ui/TimedNotice';
import type { ExpenseBuffaloOption, ExpenseCategory, ExpenseVendor } from '@/lib/expense-types';
export default function NewExpense() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]),
    [vendors, setVendors] = useState<Pick<ExpenseVendor, 'id' | 'name'>[]>([]),
    [buffaloes, setBuffaloes] = useState<ExpenseBuffaloOption[]>([]),
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
  useEffect(() => {
    async function load() {
      if (!supabase) return;
      try {
        await ensureExpenseCategories(supabase);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Could not prepare categories');
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const [c, v, b] = await Promise.all([
        supabase
          .from('expense_categories')
          .select('*')
          .eq('owner_id', user?.id)
          .eq('is_active', true)
          .order('name'),
        supabase.from('expense_vendors').select('id,name').eq('is_active', true).order('name'),
        supabase.from('buffaloes').select('id,buffalo_code,name').order('buffalo_code'),
      ]);
      setCategories(c.data ?? []);
      setVendors(v.data ?? []);
      setBuffaloes(b.data ?? []);
    }
    load();
  }, []);
  const category = categories.find((c) => c.id === categoryId);
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
    setMessage('');
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
      <form className="layout" onSubmit={save}>
        <div className="card">
          <h2 className="section-title">Expense details</h2>
          <div className="expense-form-grid">
            <div className="field">
              <label>Business date</label>
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Category</label>
              <select required value={categoryId} onChange={(e) => selectCategory(e.target.value)}>
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.category_group.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Vendor (optional)</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">No vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <Link href="/expenses/vendors" className="kpi-foot">
                Manage vendors →
              </Link>
            </div>
            <div className="field wide-field">
              <label>Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What was purchased or paid for?"
              />
            </div>
            <div className="field wide-field">
              <label>
                <input
                  type="checkbox"
                  checked={useQuantity}
                  onChange={(e) => setUseQuantity(e.target.checked)}
                />{' '}
                &nbsp;Calculate from quantity × rate
              </label>
            </div>
            {useQuantity ? (
              <>
                <div className="field">
                  <label>Quantity</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.001"
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Unit</label>
                  <input
                    list="expense-unit-list"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder={category?.default_unit || 'Choose or type a unit'}
                  />
                  <datalist id="expense-unit-list">
                    {UNITS.map((x) => (
                      <option key={x} value={x} />
                    ))}
                  </datalist>
                </div>
                <div className="field">
                  <label>Rate · ₹ per unit</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.0001"
                    inputMode="decimal"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="field">
                <label>Total amount · ₹</label>
                <input
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
              <label>Payment status</label>
              <select value={status} onChange={(e) => selectStatus(e.target.value)}>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>
            <div className="field">
              <label>Paid amount · ₹</label>
              <input
                type="number"
                min="0"
                max={amount}
                step="0.01"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Payment method</label>
              <select
                value={status === 'CREDIT' ? 'CREDIT' : method}
                disabled={status === 'CREDIT'}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>
            <div className="field">
              <label>Due date</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div className="field">
              <label>Buffalo (optional)</label>
              <select value={buffaloId} onChange={(e) => setBuffaloId(e.target.value)}>
                <option value="">Farm-wide expense</option>
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
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                placeholder="Invoice or transaction reference"
              />
            </div>
            <div className="field wide-field">
              <label>Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
          <button className="btn" disabled={busy || !categories.length}>
            {busy ? 'Saving…' : 'Save expense'}
          </button>
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
