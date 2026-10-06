'use client';

import Link from 'next/link';
import { useState } from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { formatDate } from '@/lib/date-format';
import { buffaloPaymentType, buffaloPurchaseSchema } from '@/lib/buffalo-validation';
import { money } from '@/lib/farm-format';

import {
  useBuffaloDirectory,
  useCreateBuffaloPurchase,
} from './hooks/use-buffaloes';
import type { BuffaloListItem } from './services/buffalo.service';

const INITIAL_FORM = {
  buffalo_code: '',
  buffalo_name: '',
  breed: 'Murrah',
  purchase_date: '',
  purchase_price: '',
  advance_paid: '0',
  payment_due_date: '',
  payment_terms: '',
  vendor_name: '',
  vendor_location: '',
};

function getToday() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}

function paymentLabel(status?: string) {
  if (status === 'PAID') return 'PAID';
  if (status === 'PARTIAL') return 'PARTIAL';
  if (status === 'CREDIT') return 'CREDIT';
  return '—';
}

export default function BuffaloesPage() {
  const [form, setForm] = useState({ ...INITIAL_FORM, purchase_date: getToday() });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const directoryQuery = useBuffaloDirectory();
  const createMutation = useCreateBuffaloPurchase();

  const price = Number(form.purchase_price) || 0;
  const advance = Number(form.advance_paid) || 0;
  const balance = Math.max(0, price - advance);
  const paymentType = buffaloPaymentType(price, advance);
  const hasBalance = paymentType !== 'PAID_IN_FULL';

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrors({});

    const parsed = buffaloPurchaseSchema.safeParse({
      ...form,
      payment_type: paymentType,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};

      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }

      setErrors(nextErrors);
      setMessage('Please correct the highlighted fields.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        purchase: parsed.data,
        balanceDue: hasBalance,
      });

      setForm({ ...INITIAL_FORM, purchase_date: getToday() });
      setMessage('Buffalo added.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save buffalo purchase.');
    }
  }

  return (
    <AppShell title="Buffaloes" subtitle="Individual animal records and purchase details">
      <div className="management-stack">
        <BuffaloPurchaseForm
          form={form}
          errors={errors}
          balance={balance}
          paymentType={paymentType}
          hasBalance={hasBalance}
          busy={createMutation.isPending}
          message={message}
          onChange={updateField}
          onSubmit={handleSubmit}
          onDismiss={() => setMessage('')}
        />

        <HerdOverview
          rows={directoryQuery.data ?? []}
          isLoading={directoryQuery.isPending}
          error={directoryQuery.error?.message}
        />
      </div>
    </AppShell>
  );
}

type PurchaseFormProps = {
  form: typeof INITIAL_FORM;
  errors: Record<string, string>;
  balance: number;
  paymentType: string;
  hasBalance: boolean;
  busy: boolean;
  message: string;
  onChange: (key: keyof typeof INITIAL_FORM, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDismiss: () => void;
};

function BuffaloPurchaseForm({
  form,
  errors,
  balance,
  paymentType,
  hasBalance,
  busy,
  message,
  onChange,
  onSubmit,
  onDismiss,
}: PurchaseFormProps) {
  return (
    <form className="card buffalo-form" onSubmit={onSubmit} noValidate>
      <h2 className="section-title">Add buffalo</h2>

      <div className="buffalo-primary-fields">
        <Field label="Buffalo Code" error={errors.buffalo_code}>
          <input
            value={form.buffalo_code}
            onChange={(event) => onChange('buffalo_code', event.target.value)}
            onBlur={() => onChange('buffalo_code', form.buffalo_code.trim().toUpperCase())}
            placeholder="BUFF-001"
          />
        </Field>

        <Field label="Breed" error={errors.breed}>
          <input
            value={form.breed}
            onChange={(event) => onChange('breed', event.target.value)}
            placeholder="Murrah"
          />
        </Field>

        <Field label="Purchase Date" error={errors.purchase_date}>
          <input
            type="date"
            value={form.purchase_date}
            onChange={(event) => onChange('purchase_date', event.target.value)}
          />
        </Field>

        <Field label="Purchase Price · ₹" error={errors.purchase_price}>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={form.purchase_price}
            onChange={(event) => onChange('purchase_price', event.target.value)}
          />
        </Field>

        <Field label="Advance Paid · ₹" error={errors.advance_paid}>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.advance_paid}
            onChange={(event) => onChange('advance_paid', event.target.value)}
          />
        </Field>
      </div>

      <div className="buffalo-secondary-fields">
        <Field label="Buffalo Name (optional)">
          <input
            value={form.buffalo_name}
            onChange={(event) => onChange('buffalo_name', event.target.value)}
            placeholder="Ganga"
          />
        </Field>

        <Field label="Vendor Name (optional)">
          <input
            value={form.vendor_name}
            onChange={(event) => onChange('vendor_name', event.target.value)}
            placeholder="Seller name"
          />
        </Field>

        <Field label="Vendor / Purchase Location (optional)">
          <input
            value={form.vendor_location}
            onChange={(event) => onChange('vendor_location', event.target.value)}
            placeholder="Village or city"
          />
        </Field>
      </div>

      <div className="buffalo-payment-fields">
        <Field label="Payment Type">
          <select value={paymentType} disabled>
            <option value="PAID_IN_FULL">Paid in Full</option>
            <option value="PARTIAL_CREDIT">Partial Credit</option>
            <option value="FULL_CREDIT">Full Credit</option>
          </select>
          <small className="field-hint">Based on purchase price and advance</small>
        </Field>

        <Field label="Balance Due">
          <div className="calculated-balance">{money(balance)}</div>
          <small className="field-hint">Calculated automatically</small>
        </Field>

        <Field label={`Udhaar Due Date${hasBalance ? '' : ' (not applicable)'}`} error={errors.payment_due_date}>
          <input
            type="date"
            value={form.payment_due_date}
            disabled={!hasBalance}
            onChange={(event) => onChange('payment_due_date', event.target.value)}
          />
        </Field>

        <Field label="Udhaar Terms" error={errors.payment_terms}>
          <input
            value={form.payment_terms}
            disabled={!hasBalance}
            onChange={(event) => onChange('payment_terms', event.target.value)}
            placeholder="Agreed settlement terms"
          />
        </Field>
      </div>

      {message && <TimedNotice message={message} onDismiss={onDismiss} />}

      <button className="btn" disabled={busy}>
        {busy ? 'Saving…' : 'Save buffalo'}
      </button>
    </form>
  );
}

type FieldProps = {
  label: string;
  error?: string;
  children: React.ReactNode;
};

function Field({ label, error, children }: FieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

function HerdOverview({
  rows,
  isLoading,
  error,
}: {
  rows: BuffaloListItem[];
  isLoading: boolean;
  error?: string;
}) {
  return (
    <div className="card">
      <div className="row">
        <h2 className="section-title">Herd overview</h2>
        <span className="tag">{rows.length} total</span>
      </div>

      {error && <div className="empty">{error}</div>}
      {isLoading && <div className="empty">Loading buffaloes…</div>}

      {!isLoading && !error && rows.length > 0 && (
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
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((buffalo) => (
                <HerdRow key={buffalo.id} buffalo={buffalo} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <div className="empty">No buffaloes yet. Add your first animal.</div>
      )}
    </div>
  );
}

function HerdRow({ buffalo }: { buffalo: BuffaloListItem }) {
  const purchase = buffalo.buffalo_purchases?.[0];

  return (
    <tr>
      <td>
        <Link href={`/buffaloes/${buffalo.id}`}>
          <b>{buffalo.name || buffalo.buffalo_code}</b>
        </Link>
        <div className="kpi-foot">{buffalo.buffalo_code}</div>
      </td>
      <td>{buffalo.breed || '—'}</td>
      <td>{formatDate(purchase?.purchase_date || buffalo.purchase_date)}</td>
      <td>{purchase?.vendors?.name || '—'}</td>
      <td>{purchase ? money(Number(purchase.purchase_price)) : '—'}</td>
      <td>{purchase ? money(Number(purchase.amount_pending)) : '—'}</td>
      <td>
        <span className={`tag ${purchase?.payment_status === 'PAID' ? '' : 'gold'}`}>
          {paymentLabel(purchase?.payment_status)}
        </span>
      </td>
      <td>
        <span className="tag">{buffalo.current_status}</span>
      </td>
      <td>
        <Link
          className="date-chip"
          href={`/buffaloes/${buffalo.id}`}
        >
          Edit
        </Link>
      </td>
    </tr>
  );
}
