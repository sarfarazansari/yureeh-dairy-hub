'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

import { useMemo, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';

import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-field';
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
  const submittingRef = useRef(false);
  const [customerId, setCustomerId] = useState(''),
    [date, setDate] = useState(() => localDateKey()),
    [shift, setShift] = useState<'MORNING' | 'EVENING'>('MORNING'),
    [quantity, setQuantity] = useState(''),
    [fat, setFat] = useState(''),
    [pricingTypeOverride, setPricingTypeOverride] = useState<PricingType | null>(null),
    [rateOverride, setRateOverride] = useState<string | null>(null),
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
  const pricingType = pricingTypeOverride ?? pricingQuery.data?.pricing_type ?? customer?.pricing_type ?? 'FIXED_PER_LITRE';
  const rate = rateOverride ?? (pricingQuery.data ? String(pricingQuery.data.rate) : customer ? String(customer.default_rate) : '');
  const ratePerLitre = pricingType === 'FAT_BASED'
    ? fat !== '' && Number.isFinite(Number(fat)) && rate !== ''
      ? (Number(rate) * Number(fat)).toFixed(2)
      : ''
    : rate;

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
    setPricingTypeOverride(null);
    setRateOverride(null);
    setErrors((current) => ({ ...current, customer_id: '' }));
    const selected = customers.find((item) => item.id === id);
    if (selected) setFat('');
  }

  function changePricingType(value: PricingType) {
    setPricingTypeOverride(value);
    setErrors((current) => ({ ...current, fat: '' }));
    if (value !== 'FAT_BASED') setFat('');
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || createMutation.isPending) return;
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
    submittingRef.current = true;
    try {
      await createMutation.mutateAsync(parsed.data);
      // Keep the selected business date and shift so consecutive deliveries
      // can be entered for the same milking session without reselecting them.
      setCustomerId('');
      setQuantity('');
      setFat('');
      setPricingTypeOverride(null);
      setRateOverride(null);
      setNotes('');
      setErrors({});
      setMessage('Entry saved successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save entry.');
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <AppShell title="New milk entry" subtitle="Quickly record a customer delivery">
      <form className="layout" onSubmit={save} noValidate>
        <div className="card">
          <h2 className="section-title">Entry details</h2>
          <div className="grid three">
            <FormField id="entry-date" label="Business date" error={errors.business_date}>
              {(controlProps) => (
                <DatePicker
                  {...controlProps}
                  value={date}
                  max={localDateKey()}
                  disabled={createMutation.isPending}
                  onChange={(value) => {
                    setDate(value);
                    setPricingTypeOverride(null);
                    setRateOverride(null);
                    setFat('');
                  }}
                  ariaLabel="Business date"
                />
              )}
            </FormField>
            <div className="field">
              <Label htmlFor="entry-shift">Shift</Label>
              <Select value={shift} onValueChange={(value) => setShift(value as 'MORNING' | 'EVENING')} disabled={createMutation.isPending}><SelectTrigger id="entry-shift">
                <SelectValue placeholder="Select shift" /></SelectTrigger>
                <SelectContent><SelectItem value="MORNING">Morning</SelectItem><SelectItem value="EVENING">Evening</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="field">
              <Label htmlFor="entry-customer">Customer</Label>
              <Select value={customerId || undefined} onValueChange={chooseCustomer} disabled={customersQuery.isPending || createMutation.isPending}>
                <SelectTrigger id="entry-customer" aria-invalid={!!errors.customer_id}><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
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
                  ⚠️ This delivery exceeds the available milk for the selected shift by {milkTxt(Number(quantity) - deliveryContextQuery.data.availablePoolLitres)}. The database will reject the save until the quantity is within the available balance.
                </p>
              )}
            </div>
          )}

          <div className="grid four">
            <div className="field">
              <Label htmlFor="entry-quantity">Milk quantity (L)</Label>
              <Input
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
                <Label htmlFor="entry-fat">Fat (%)</Label>
                <Input
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
              <Label htmlFor="entry-rate-per-litre">Rate / L</Label>
              <Input
                id="entry-rate-per-litre"
                type="number"
                value={ratePerLitre}
                readOnly
                aria-readonly="true"
                placeholder="—"
              />
            </div>
            <div className="field">
              <Label htmlFor="entry-rate">Applied rate</Label>
              <Input
                id="entry-rate"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={rate}
                disabled={createMutation.isPending}
                onChange={(event) => {
                  setRateOverride(event.target.value);
                  setErrors((current) => ({ ...current, applied_rate: '' }));
                }}
                aria-invalid={!!errors.applied_rate}
              />
              {errors.applied_rate && <small className="field-error">{errors.applied_rate}</small>}
            </div>
          </div>

          <div className="field">
            <Label htmlFor="entry-notes">Notes (optional)</Label>
            <Input
              id="entry-notes"
              value={notes}
              disabled={createMutation.isPending}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add a note for this entry"
            />
          </div>

          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
          <Button type="submit" disabled={createMutation.isPending || duplicateQuery.isPending || deliveryContextQuery.isPending || deliveryContextQuery.isError || !deliveryContextQuery.data?.herdEntryExists || !!duplicateQuery.data} aria-live="polite">
            {createMutation.isPending ? <><LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Saving…</> : 'Save entry'}
          </Button>
        </div>

        <div className="card">
          <div className="eyebrow">PRICE SNAPSHOT</div>
          <div className="field">
            <Label htmlFor="entry-pricing-type">Pricing type</Label>
            <Select value={pricingType} onValueChange={(value) => changePricingType(value as PricingType)} disabled={createMutation.isPending}>
              <SelectTrigger id="entry-pricing-type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="FIXED_PER_LITRE">Fixed per litre</SelectItem><SelectItem value="FAT_BASED">Fat based</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="field">
            <Label htmlFor="entry-rate-snapshot">
              Effective customer rate · {pricingQuery.data ? `₹${pricingQuery.data.rate}` : customer?.default_rate ? `₹${customer.default_rate}` : '—'}
            </Label>
            <Input
              id="entry-rate-snapshot"
              value={rate}
              onChange={(event) => {
                setRateOverride(event.target.value);
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
