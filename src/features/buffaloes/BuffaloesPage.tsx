'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { formatDate } from '@/lib/date-format';
import { money } from '@/lib/farm-format';
import { buffaloPaymentType, buffaloPurchaseSchema } from './validation';
import { useBuffaloDirectory, useCreateBuffaloPurchase } from './hooks/use-buffaloes';
import type { BuffaloListItem } from './types';

const INITIAL_FORM = {
  buffalo_code: '', buffalo_name: '', breed: 'Murrah', purchase_date: '',
  purchase_price: '', advance_paid: '0', payment_due_date: '', payment_terms: '',
  vendor_name: '', vendor_location: '',
};
function getToday() {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
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
    event.preventDefault(); setMessage(''); setErrors({});
    const parsed = buffaloPurchaseSchema.safeParse({ ...form, payment_type: paymentType });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) { const key = String(issue.path[0] ?? 'form'); if (!nextErrors[key]) nextErrors[key] = issue.message; }
      setErrors(nextErrors); setMessage('Please correct the highlighted fields.'); return;
    }
    try {
      await createMutation.mutateAsync({ purchase: parsed.data, balanceDue: hasBalance });
      setForm({ ...INITIAL_FORM, purchase_date: getToday() }); setErrors({}); setMessage('Buffalo added.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save buffalo purchase.'); }
  }

  return (
    <AppShell title="Buffaloes" subtitle="Individual animal records and purchase details">
      <div className="management-stack">
        <form className="card space-y-4" onSubmit={handleSubmit} noValidate>
          <h2 className="section-title">Add buffalo</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Buffalo code" error={errors.buffalo_code}><Input value={form.buffalo_code} onChange={(event) => updateField('buffalo_code', event.target.value)} onBlur={() => updateField('buffalo_code', form.buffalo_code.trim().toUpperCase())} placeholder="BUFF-001" aria-invalid={Boolean(errors.buffalo_code)} /></Field>
            <Field label="Breed" error={errors.breed}><Input value={form.breed} onChange={(event) => updateField('breed', event.target.value)} placeholder="Murrah" aria-invalid={Boolean(errors.breed)} /></Field>
            <Field label="Purchase date" error={errors.purchase_date}><DatePicker value={form.purchase_date} max={getToday()} onChange={(value) => updateField('purchase_date', value)} ariaLabel="Purchase date" aria-invalid={Boolean(errors.purchase_date)} /></Field>
            <Field label="Purchase price · ₹" error={errors.purchase_price}><Input type="number" min="0.01" step="0.01" inputMode="decimal" value={form.purchase_price} onChange={(event) => updateField('purchase_price', event.target.value)} aria-invalid={Boolean(errors.purchase_price)} /></Field>
            <Field label="Advance paid · ₹" error={errors.advance_paid}><Input type="number" min="0" step="0.01" inputMode="decimal" value={form.advance_paid} onChange={(event) => updateField('advance_paid', event.target.value)} aria-invalid={Boolean(errors.advance_paid)} /></Field>
            <Field label="Buffalo name (optional)"><Input value={form.buffalo_name} onChange={(event) => updateField('buffalo_name', event.target.value)} placeholder="Ganga" /></Field>
            <Field label="Vendor name (optional)"><Input value={form.vendor_name} onChange={(event) => updateField('vendor_name', event.target.value)} placeholder="Seller name" /></Field>
            <Field label="Vendor / purchase location (optional)"><Input value={form.vendor_location} onChange={(event) => updateField('vendor_location', event.target.value)} placeholder="Village or city" /></Field>
            <Field label="Payment type"><Select value={paymentType} disabled><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PAID_IN_FULL">Paid in full</SelectItem><SelectItem value="PARTIAL_CREDIT">Partial credit</SelectItem><SelectItem value="FULL_CREDIT">Full credit</SelectItem></SelectContent></Select><p className="field-hint">Calculated from purchase price and advance</p></Field>
            <Field label="Balance due"><div className="calculated-balance">{money(balance)}</div><p className="field-hint">Calculated automatically</p></Field>
            <Field label={`Udhaar due date${hasBalance ? '' : ' (not applicable)'}`} error={errors.payment_due_date}><DatePicker value={form.payment_due_date} min={form.purchase_date} disabled={!hasBalance} clearable onChange={(value) => updateField('payment_due_date', value)} ariaLabel="Udhaar due date" aria-invalid={Boolean(errors.payment_due_date)} /></Field>
            <Field label="Udhaar terms" error={errors.payment_terms}><Input value={form.payment_terms} disabled={!hasBalance} onChange={(event) => updateField('payment_terms', event.target.value)} placeholder="Agreed settlement terms" aria-invalid={Boolean(errors.payment_terms)} /></Field>
          </div>
          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
          <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving…' : 'Save buffalo'}</Button>
        </form>
        <HerdOverview rows={directoryQuery.data ?? []} isLoading={directoryQuery.isPending} error={directoryQuery.error?.message} />
      </div>
    </AppShell>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="field"><Label>{label}</Label>{children}{error && <p role="alert" className="field-error">{error}</p>}</div>;
}

function HerdOverview({ rows, isLoading, error }: { rows: BuffaloListItem[]; isLoading: boolean; error?: string }) {
  return (
    <div className="card">
      <div className="row"><h2 className="section-title">Herd overview</h2><span className="tag">{rows.length} total</span></div>
      {error && <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm"><p>{error}</p></div>}
      {isLoading && <div className="space-y-3 py-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div>}
      {!isLoading && !error && rows.length > 0 && <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]"><Table className="min-w-[1000px] [&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
        <TableHeader><TableRow><TableHead>BUFFALO</TableHead><TableHead>BREED</TableHead><TableHead>PURCHASE</TableHead><TableHead>VENDOR</TableHead><TableHead>PRICE</TableHead><TableHead>BALANCE DUE</TableHead><TableHead>PAYMENT</TableHead><TableHead>STATUS</TableHead><TableHead>ACTION</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((buffalo) => <HerdRow key={buffalo.id} buffalo={buffalo} />)}</TableBody>
      </Table></div>}
      {!isLoading && !error && rows.length === 0 && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No buffaloes yet. Add your first animal.</div>}
    </div>
  );
}
function HerdRow({ buffalo }: { buffalo: BuffaloListItem }) {
  const purchase = buffalo.buffalo_purchases?.[0];
  return <TableRow>
    <TableCell><Link href={`/buffaloes/${buffalo.id}`} className="font-semibold text-[var(--ink)]">{buffalo.name || buffalo.buffalo_code}</Link><div className="text-xs text-muted-foreground">{buffalo.buffalo_code}</div></TableCell>
    <TableCell>{buffalo.breed || '—'}</TableCell><TableCell className="whitespace-nowrap">{formatDate(purchase?.purchase_date || buffalo.purchase_date)}</TableCell><TableCell>{purchase?.vendors?.name || '—'}</TableCell>
    <TableCell>{purchase ? money(Number(purchase.purchase_price)) : '—'}</TableCell><TableCell>{purchase ? money(Number(purchase.amount_pending)) : '—'}</TableCell>
    <TableCell><Badge variant={purchase?.payment_status === 'PAID' ? 'secondary' : 'outline'}>{paymentLabel(purchase?.payment_status)}</Badge></TableCell>
    <TableCell><Badge variant="muted">{buffalo.current_status}</Badge></TableCell>
    <TableCell><Button variant="outline" size="sm" asChild><Link href={`/buffaloes/${buffalo.id}`}>Edit</Link></Button></TableCell>
  </TableRow>;
}
