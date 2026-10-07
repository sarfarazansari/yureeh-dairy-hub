'use client';

import { useEffect, useMemo, useState } from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { milkTxt } from '@/lib/farm-format';
import { calculateEntryAmount, type PricingType } from '@/lib/analytics';
import { localDateKey } from '@/lib/milk-entry-list';
import { milkEntrySchema } from '@/lib/milk-entry-validation';

import {
  useActiveMilkEntryCustomersQuery,
  useCreateMilkEntryMutation,
  useCustomerPricingQuery,
  useMilkDeliveryContextQuery,
  useMilkEntryDuplicateQuery,
} from './milk.queries';

export default function NewEntryForm() {
  const [customerId, setCustomerId] = useState(''),
    [date, setDate] = useState(() => localDateKey()),
    [shift, setShift] = useState<'MORNING' | 'EVENING'>('MORNING'),
    [quantity, setQuantity] = useState(''),
    [fat, setFat] = useState(''),
    [pricingType, setPricingType] = useState<PricingType>('FIXED_PER_LITRE'),
    [rate, setRate] = useState(''),
    [notes, setNotes] = useState(''),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState('');

  const customersQuery = useActiveMilkEntryCustomersQuery();
  const pricingQuery = useCustomerPricingQuery(customerId, date);
  const deliveryContextQuery = useMilkDeliveryContextQuery(date, shift);
  const duplicateQuery = useMilkEntryDuplicateQuery({ customerId, businessDate: date, shift });
  const createMutation = useCreateMilkEntryMutation();
  const customers = customersQuery.data ?? [];
  const customer = customers.find((item) => item.id === customerId);

  useEffect(() => {
    if (!customerId || pricingQuery.isPending || pricingQuery.isError) return;
    const pricing = pricingQuery.data;
    if (!pricing) return;
    setPricingType(pricing.pricing_type);
    setRate(String(pricing.rate));
    setFat('');
  }, [customerId, pricingQuery.data, pricingQuery.isError, pricingQuery.isPending]);

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

  function chooseCustomer(id: string) {
    setCustomerId(id);
    setErrors((current) => ({ ...current, customer_id: '' }));
    const selected = customers.find((item) => item.id === id);
    if (selected) {
      setPricingType(selected.pricing_type);
      setRate(String(selected.default_rate));
      setFat('');
    }
  }

  function changePricingType(value: PricingType) {
    setPricingType(value);
    setErrors((current) => ({ ...current, fat: '' }));
    if (value !== 'FAT_BASED') setFat('');
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
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

    if (deliveryContextQuery.isPending) {
      setMessage('Checking herd production and the milk pool for the selected date and shift…');
      return;
    }
    if (deliveryContextQuery.isError) {
      setMessage(deliveryContextQuery.error.message);
      return;
    }
    if (!deliveryContextQuery.data?.herdEntryExists) {
      setMessage('Record the herd entry for this date and shift before recording customer milk.');
      return;
    }

    setErrors({});
    try {
      await createMutation.mutateAsync(parsed.data);
      setMessage('Entry saved successfully.');
      setQuantity('');
      setFat('');
      setNotes('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save entry.');
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
                disabled={createMutation.isPending}
                onChange={(event) => setDate(event.target.value)}
                aria-invalid={!!errors.business_date}
              />
              {errors.business_date && <small className="field-error">{errors.business_date}</small>}
            </div>
            <div className="field">
              <label htmlFor="entry-shift">Shift</label>
              <select
                id="entry-shift"
                value={shift}
                disabled={createMutation.isPending}
                onChange={(event) => setShift(event.target.value as 'MORNING' | 'EVENING')}
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
                disabled={customersQuery.isPending || createMutation.isPending}
                onChange={(event) => chooseCustomer(event.target.value)}
                aria-invalid={!!errors.customer_id}
              >
                <option value="">Select customer</option>
                {customers.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              {errors.customer_id && <small className="field-error">{errors.customer_id}</small>}
    {customersQuery.isError && (
                <small className="field-error">{customersQuery.error.message}</small>
              )}
              {pricingQuery.isError && customerId && (
                <small className="field-error">{pricingQuery.error.message}</small>
              )}
            </div>
          </div>

          {duplicateQuery.data && (
            <p className="auth-message">
              An entry already exists for this customer, date and shift. Save is blocked by the
              database workflow to prevent duplicate deliveries.
            </p>
          )}

          {deliveryContextQuery.isError && (
            <p className="auth-message" role="alert">
              {deliveryContextQuery.error.message}
            </p>
          )}

          {!deliveryContextQuery.isError && !deliveryContextQuery.isPending && !deliveryContextQuery.data?.herdEntryExists && (
            <p className="auth-message" role="alert">
              Herd entry is required before customer delivery. No herd entry has been recorded for this date and shift.
            </p>
          )}

          {!deliveryContextQuery.isError && deliveryContextQuery.isPending && (
            <p className="kpi-foot">Checking herd entry and today&apos;s milk pool…</p>
          )}

          {!deliveryContextQuery.isError && !deliveryContextQuery.isPending && deliveryContextQuery.data?.herdEntryExists && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="eyebrow">MILK POOL FOR SELECTED DATE</div>
              <div className="row">
                <div>
                  <strong className="title">{milkTxt(deliveryContextQuery.data.availablePoolLitres)}</strong>
                  <p className={deliveryContextQuery.data.availablePoolLitres < 0 ? 'kpi-foot field-error' : 'kpi-foot'}>
                    Available after recorded production, deliveries and other milk movements.
                  </p>
                </div>
                <div className="kpi-foot">
                  Produced: <b>{milkTxt(deliveryContextQuery.data.productionLitres)}</b>
                  {' · '}
                  Delivered: <b>{milkTxt(deliveryContextQuery.data.customerDeliveryLitres)}</b>
                </div>
              </div>
              {quantity !== '' && Number.isFinite(Number(quantity)) && Number(quantity) > deliveryContextQuery.data.availablePoolLitres && (
                <p className="auth-message" role="status">
                  ⚠️ This delivery is {milkTxt(Number(quantity) - deliveryContextQuery.data.availablePoolLitres)} above the currently available pool. The delivery will still be recorded.
                </p>
              )}
            </div>
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
                disabled={createMutation.isPending}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setErrors((current) => ({ ...current, milk_quantity: '' }));
                }}
                aria-invalid={!!errors.milk_quantity}
              />
              {errors.milk_quantity && <small className="field-error">{errors.milk_quantity}</small>}
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
                  disabled={createMutation.isPending}
                  onChange={(event) => {
                    setFat(event.target.value);
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
                disabled={createMutation.isPending}
                onChange={(event) => {
                  setRate(event.target.value);
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
              disabled={createMutation.isPending}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add a note for this entry"
            />
          </div>

          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
          <button disabled={createMutation.isPending || duplicateQuery.isPending || deliveryContextQuery.isPending || deliveryContextQuery.isError || !deliveryContextQuery.data?.herdEntryExists || !!duplicateQuery.data} className="btn">
            {createMutation.isPending ? 'Saving…' : 'Save entry'}
          </button>
        </div>

        <div className="card">
          <div className="eyebrow">PRICE SNAPSHOT</div>
          <div className="field">
            <label htmlFor="entry-pricing-type">Pricing type</label>
            <select
              id="entry-pricing-type"
              value={pricingType}
              disabled={createMutation.isPending}
              onChange={(event) => changePricingType(event.target.value as PricingType)}
            >
              <option value="FIXED_PER_LITRE">Fixed per litre</option>
              <option value="FAT_BASED">Fat based</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="entry-rate-snapshot">
              Effective customer rate · {pricingQuery.data ? `₹${pricingQuery.data.rate}` : customer?.default_rate ? `₹${customer.default_rate}` : '—'}
            </label>
            <input
              id="entry-rate-snapshot"
              value={rate}
              onChange={(event) => {
                setRate(event.target.value);
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
            <strong>₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            <small>{pricingType === 'FAT_BASED' ? 'Quantity × fat × rate' : 'Quantity × rate'}</small>
          </div>
          <p className="kpi-foot" style={{ lineHeight: 1.7 }}>
            The applied rate is stored with each entry. Saving a customer delivery also records the
            matching milk-pool movement transactionally.
          </p>
        </div>
      </form>
    </AppShell>
  );
}
