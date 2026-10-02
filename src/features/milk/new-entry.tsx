'use client';

import { AppShell } from '@/components/layout/AppShell';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateEntryAmount, type PricingType } from '@/lib/analytics';
import { milkEntrySchema } from '@/lib/milk-entry-validation';
import { createMilkEntry, hasDuplicateMilkEntry } from './services/milk-entry.service';
import {
  getActiveCustomersForMilkEntry,
  type CustomerOption,
} from '@/features/customers/services/customer.service';
export default function NewEntryForm() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]),
    [customerId, setCustomerId] = useState(''),
    [date, setDate] = useState(() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    }),
    [shift, setShift] = useState<'MORNING' | 'EVENING'>('MORNING'),
    [quantity, setQuantity] = useState(''),
    [fat, setFat] = useState(''),
    [pricingType, setPricingType] = useState<PricingType>('FIXED_PER_LITRE'),
    [rate, setRate] = useState(''),
    [notes, setNotes] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [duplicate, setDuplicate] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({});
  const submitting = useRef(false);
  useEffect(() => {
    let active = true;
    async function loadCustomers() {
      if (!supabase) return;
      try {
        const activeCustomers = await getActiveCustomersForMilkEntry(supabase);
        if (active) setCustomers(activeCustomers);
      } catch (loadError) {
        if (active)
          setMessage(loadError instanceof Error ? loadError.message : 'Could not load customers.');
      }
    }
    void loadCustomers();
    return () => {
      active = false;
    };
  }, []);
  const customer = customers.find((c) => c.id === customerId);
  const amount = useMemo(() => {
    if (!quantity || !rate) return 0;
    try {
      return calculateEntryAmount(
        Number(quantity),
        pricingType,
        Number(rate),
        pricingType === 'FAT_BASED' ? (fat === '' ? null : Number(fat)) : null,
      );
    } catch {
      return 0;
    }
  }, [quantity, rate, pricingType, fat]);
  useEffect(() => {
    let active = true;
    async function checkDuplicate() {
      if (!supabase || !customerId || !date) {
        setDuplicate(false);
        return;
      }
      try {
        const duplicateEntry = await hasDuplicateMilkEntry(supabase, {
          customerId,
          businessDate: date,
          shift,
        });
        if (active) setDuplicate(duplicateEntry);
      } catch (duplicateError) {
        if (active)
          setMessage(
            duplicateError instanceof Error
              ? duplicateError.message
              : 'Could not check for duplicates.',
          );
      }
    }
    void checkDuplicate();
    return () => {
      active = false;
    };
  }, [customerId, date, shift]);
  function chooseCustomer(id: string) {
    setCustomerId(id);
    setErrors((current) => ({ ...current, customer_id: '' }));
    const c = customers.find((x) => x.id === id);
    if (c) {
      setPricingType(c.pricing_type);
      setRate(String(c.default_rate));
      setFat('');
    }
  }
  function changePricingType(value: PricingType) {
    setPricingType(value);
    setErrors((current) => ({ ...current, fat: '' }));
    if (value !== 'FAT_BASED') setFat('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    const parsed = milkEntrySchema.safeParse({
      business_date: date,
      shift,
      customer_id: customerId,
      milk_quantity: quantity,
      fat,
      pricing_type: pricingType,
      applied_rate: rate,
      notes,
    });
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
    setErrors({});
    if (submitting.current) return;
    if (!supabase) {
      setMessage('Supabase is not configured.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Your session expired. Sign in again.');
      await createMilkEntry(supabase, user.id, parsed.data);
      setMessage('Entry saved successfully.');
      setQuantity('');
      setFat('');
      setNotes('');
    } catch (err) {
      const raw =
        err && typeof err === 'object' && 'message' in err
          ? String(
              (
                err as {
                  message: unknown;
                }
              ).message,
            )
          : 'Could not save entry.';
      setMessage(raw);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  return (
    <AppShell title="New milk entry" subtitle="Quickly record a customer delivery">
      <form className="layout" onSubmit={save} noValidate>
        <div className="card">
          <h2 className="section-title">Entry details</h2>
          <div className="grid three">
            <div className="field">
              <label htmlFor="entry-date">Business date</label>
              <input
                id="entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={!!errors.business_date}
              />
              {errors.business_date && (
                <small className="field-error">{errors.business_date}</small>
              )}
            </div>
            <div className="field">
              <label htmlFor="entry-shift">Shift</label>
              <select
                id="entry-shift"
                value={shift}
                onChange={(e) => setShift(e.target.value as 'MORNING' | 'EVENING')}
              >
                <option value="MORNING">Morning</option>
                <option value="EVENING">Evening</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="entry-customer">Customer</label>
              <select
                id="entry-customer"
                value={customerId}
                onChange={(e) => chooseCustomer(e.target.value)}
                aria-invalid={!!errors.customer_id}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.customer_id && <small className="field-error">{errors.customer_id}</small>}
            </div>
          </div>
          {duplicate && (
            <p className="auth-message">
              An entry already exists for this customer, date and shift. Save another batch if this
              is intentional.
            </p>
          )}
          <div className={`grid ${pricingType === 'FAT_BASED' ? 'three' : 'two'}`}>
            <div className="field">
              <label htmlFor="entry-quantity">Milk quantity (L)</label>
              <input
                id="entry-quantity"
                type="number"
                min="0.001"
                step="0.001"
                inputMode="decimal"
                placeholder="e.g. 20.0"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setErrors((current) => ({ ...current, milk_quantity: '' }));
                }}
                aria-invalid={!!errors.milk_quantity}
              />
              {errors.milk_quantity && (
                <small className="field-error">{errors.milk_quantity}</small>
              )}
            </div>
            {pricingType === 'FAT_BASED' && (
              <div className="field">
                <label htmlFor="entry-fat">Fat (%)</label>
                <input
                  id="entry-fat"
                  type="number"
                  min="0"
                  max="20"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 7.1"
                  value={fat}
                  onChange={(e) => {
                    setFat(e.target.value);
                    setErrors((current) => ({ ...current, fat: '' }));
                  }}
                  aria-invalid={!!errors.fat}
                />
                {errors.fat && <small className="field-error">{errors.fat}</small>}
              </div>
            )}
            <div className="field">
              <label htmlFor="entry-rate">Applied rate</label>
              <input
                id="entry-rate"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={rate}
                onChange={(e) => {
                  setRate(e.target.value);
                  setErrors((current) => ({ ...current, applied_rate: '' }));
                }}
                aria-invalid={!!errors.applied_rate}
              />
              {errors.applied_rate && <small className="field-error">{errors.applied_rate}</small>}
            </div>
          </div>
          <div className="field">
            <label htmlFor="entry-notes">Notes (optional)</label>
            <input
              id="entry-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note for this entry"
            />
          </div>
          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
          <button disabled={busy} className="btn">
            {busy ? 'Saving…' : 'Save entry'}
          </button>
        </div>
        <div className="card">
          <div className="eyebrow">PRICE SNAPSHOT</div>
          <div className="field">
            <label htmlFor="entry-pricing-type">Pricing type</label>
            <select
              id="entry-pricing-type"
              value={pricingType}
              onChange={(e) => changePricingType(e.target.value as PricingType)}
            >
              <option value="FIXED_PER_LITRE">Fixed per litre</option>
              <option value="FAT_BASED">Fat based</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="entry-rate-snapshot">
              Customer default rate · {customer?.default_rate ? `₹${customer.default_rate}` : '—'}
            </label>
            <input
              id="entry-rate-snapshot"
              value={rate}
              onChange={(e) => {
                setRate(e.target.value);
                setErrors((current) => ({ ...current, applied_rate: '' }));
              }}
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="Choose a customer"
              aria-invalid={!!errors.applied_rate}
            />
          </div>
          <div className="amount">
            <span>CALCULATED TOTAL</span>
            <strong>
              ₹
              {amount.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>
            <small>
              {pricingType === 'FAT_BASED' ? 'Quantity × fat × rate' : 'Quantity × rate'}
            </small>
          </div>
          <p className="kpi-foot" style={{ lineHeight: 1.7 }}>
            The pricing model and applied rate are stored with each entry, preserving historical
            calculations when customer defaults change.
          </p>
        </div>
      </form>
    </AppShell>
  );
}
