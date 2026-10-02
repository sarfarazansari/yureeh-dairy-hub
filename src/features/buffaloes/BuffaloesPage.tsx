'use client';

import { money } from '@/lib/farm-format';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { buffaloPaymentType, buffaloPurchaseSchema } from '@/lib/buffalo-validation';
import { formatDate } from '@/lib/date-format';
import {
  createBuffaloPurchase,
  getBuffaloDirectory,
  type BuffaloListItem,
} from './services/buffalo.service';
export default function BuffaloesPage() {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [rows, setRows] = useState<BuffaloListItem[]>([]);
  const [form, setForm] = useState({
    buffalo_code: '',
    buffalo_name: '',
    breed: 'Murrah',
    purchase_date: localDate,
    purchase_price: '',
    advance_paid: '0',
    payment_due_date: '',
    payment_terms: '',
    vendor_name: '',
    vendor_location: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const submitting = useRef(false);
  const price = Number(form.purchase_price) || 0,
    advance = Number(form.advance_paid) || 0,
    balance = Math.max(0, price - advance);
  const paymentType = buffaloPaymentType(price, advance),
    hasBalance = paymentType !== 'PAID_IN_FULL';
  function change(key: keyof typeof form, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'purchase_price' || key === 'advance_paid') {
        const nextPrice = Number(next.purchase_price) || 0;
        const nextAdvance = Number(next.advance_paid) || 0;
        if (buffaloPaymentType(nextPrice, nextAdvance) === 'PAID_IN_FULL') {
          next.payment_due_date = '';
          next.payment_terms = '';
        }
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: '' }));
  }
  async function load() {
    if (!supabase) return;
    try {
      setRows(await getBuffaloDirectory(supabase));
    } catch (loadError) {
      setMessage(
        loadError instanceof Error ? loadError.message : 'Could not load buffalo records.',
      );
    }
  }
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, []);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !supabase) return;
    setMessage('');
    setErrors({});
    const parsed = buffaloPurchaseSchema.safeParse({ ...form, payment_type: paymentType });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setMessage('Please correct the highlighted fields.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await createBuffaloPurchase(supabase, parsed.data, hasBalance);
      setMessage('Buffalo added.');
      setForm((current) => ({
        ...current,
        buffalo_code: '',
        buffalo_name: '',
        purchase_price: '',
        advance_paid: '0',
        payment_due_date: '',
        payment_terms: '',
        vendor_name: '',
        vendor_location: '',
      }));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save buffalo purchase.');
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  const paymentLabel = (status: string | undefined) =>
    status === 'PAID'
      ? 'PAID'
      : status === 'PARTIAL'
        ? 'PARTIAL'
        : status === 'CREDIT'
          ? 'CREDIT'
          : '—';
  return (
    <AppShell title="Buffaloes" subtitle="Individual animal records and purchase details">
      <div className="management-stack">
        <form className="card buffalo-form" onSubmit={create} noValidate>
          <h2 className="section-title">Add buffalo</h2>
          <div className="buffalo-primary-fields">
            <div className="field">
              <label htmlFor="buffalo-code">Buffalo Code</label>
              <input
                id="buffalo-code"
                value={form.buffalo_code}
                onChange={(e) => change('buffalo_code', e.target.value)}
                onBlur={() => change('buffalo_code', form.buffalo_code.trim().toUpperCase())}
                placeholder="BUFF-001"
                aria-invalid={!!errors.buffalo_code}
              />
              {errors.buffalo_code && <small className="field-error">{errors.buffalo_code}</small>}
            </div>
            <div className="field">
              <label htmlFor="buffalo-breed">Breed</label>
              <input
                id="buffalo-breed"
                value={form.breed}
                onChange={(e) => change('breed', e.target.value)}
                placeholder="Murrah"
                aria-invalid={!!errors.breed}
              />
              {errors.breed && <small className="field-error">{errors.breed}</small>}
            </div>
            <div className="field">
              <label htmlFor="buffalo-purchase-date">Purchase Date</label>
              <input
                id="buffalo-purchase-date"
                type="date"
                value={form.purchase_date}
                onChange={(e) => change('purchase_date', e.target.value)}
                aria-invalid={!!errors.purchase_date}
              />
              {errors.purchase_date && (
                <small className="field-error">{errors.purchase_date}</small>
              )}
            </div>
            <div className="field">
              <label htmlFor="buffalo-purchase-price">Purchase Price · ₹</label>
              <input
                id="buffalo-purchase-price"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={form.purchase_price}
                onChange={(e) => change('purchase_price', e.target.value)}
                placeholder="e.g. 113500"
                aria-invalid={!!errors.purchase_price}
              />
              {errors.purchase_price && (
                <small className="field-error">{errors.purchase_price}</small>
              )}
            </div>
            <div className="field">
              <label htmlFor="buffalo-advance">Advance Paid · ₹</label>
              <input
                id="buffalo-advance"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.advance_paid}
                onChange={(e) => change('advance_paid', e.target.value)}
                aria-invalid={!!errors.advance_paid}
              />
              {errors.advance_paid && <small className="field-error">{errors.advance_paid}</small>}
            </div>
          </div>
          <div className="buffalo-secondary-fields">
            <div className="field">
              <label htmlFor="buffalo-name">Buffalo Name (optional)</label>
              <input
                id="buffalo-name"
                value={form.buffalo_name}
                onChange={(e) => change('buffalo_name', e.target.value)}
                placeholder="Ganga"
              />
            </div>
            <div className="field">
              <label htmlFor="buffalo-vendor">Vendor Name (optional)</label>
              <input
                id="buffalo-vendor"
                value={form.vendor_name}
                onChange={(e) => change('vendor_name', e.target.value)}
                placeholder="Seller name"
              />
            </div>
            <div className="field">
              <label htmlFor="buffalo-location">Vendor / Purchase Location (optional)</label>
              <input
                id="buffalo-location"
                value={form.vendor_location}
                onChange={(e) => change('vendor_location', e.target.value)}
                placeholder="Village or city"
              />
            </div>
          </div>
          <div className="buffalo-payment-fields">
            <div className="field">
              <label htmlFor="buffalo-payment-type">Payment Type</label>
              <select id="buffalo-payment-type" value={paymentType} disabled>
                <option value="PAID_IN_FULL">Paid in Full</option>
                <option value="PARTIAL_CREDIT">Partial Credit</option>
                <option value="FULL_CREDIT">Full Credit</option>
              </select>
              <small className="field-hint">Based on purchase price and advance</small>
            </div>
            <div className="field">
              <label>Balance Due</label>
              <div className="calculated-balance" aria-live="polite">
                {money(balance)}
              </div>
              <small className="field-hint">Calculated automatically</small>
            </div>
            <div className="field">
              <label htmlFor="buffalo-due-date">
                Udhaar Due Date{hasBalance ? '' : ' (not applicable)'}
              </label>
              <input
                id="buffalo-due-date"
                type="date"
                value={form.payment_due_date}
                disabled={!hasBalance}
                onChange={(e) => change('payment_due_date', e.target.value)}
                aria-invalid={!!errors.payment_due_date}
              />
              {errors.payment_due_date && (
                <small className="field-error">{errors.payment_due_date}</small>
              )}
            </div>
            <div className="field">
              <label htmlFor="buffalo-terms">Udhaar Terms</label>
              <input
                id="buffalo-terms"
                value={form.payment_terms}
                disabled={!hasBalance}
                onChange={(e) => change('payment_terms', e.target.value)}
                placeholder="Agreed settlement terms"
              />
              {errors.payment_terms && (
                <small className="field-error">{errors.payment_terms}</small>
              )}
            </div>
          </div>
          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
          <button className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Save buffalo'}
          </button>
        </form>
        <div className="card">
          <div className="row">
            <h2 className="section-title">Herd overview</h2>
            <span className="tag">{rows.length} total</span>
          </div>
          {rows.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>BUFFALO</th>
                    <th>BREED</th>
                    <th>PURCHASE</th>
                    <th>VENDOR</th>
                    <th>PRICE</th>
                    <th>BALANCE DUE</th>
                    <th>PAYMENT</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => {
                    const p = b.buffalo_purchases?.[0];
                    return (
                      <tr key={b.id}>
                        <td>
                          <Link href={`/buffaloes/${encodeURIComponent(b.buffalo_code)}`}>
                            <b>{b.name || b.buffalo_code}</b>
                          </Link>
                          <div className="kpi-foot">{b.buffalo_code}</div>
                        </td>
                        <td>{b.breed || '—'}</td>
                        <td>{formatDate(p?.purchase_date || b.purchase_date)}</td>
                        <td>{p?.vendors?.name || '—'}</td>
                        <td>{p ? money(Number(p.purchase_price)) : '—'}</td>
                        <td>{p ? money(Number(p.amount_pending)) : '—'}</td>
                        <td>
                          <span className={`tag ${p?.payment_status === 'PAID' ? '' : 'gold'}`}>
                            {paymentLabel(p?.payment_status)}
                          </span>
                        </td>
                        <td>
                          <span className="tag">{b.current_status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">No buffaloes yet. Add your first animal.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
