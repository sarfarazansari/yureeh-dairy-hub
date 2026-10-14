'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { money, milkTxt } from '@/lib/farm-format';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { type PricingType } from '@/lib/analytics';
import { Dialog } from '@/app/dialog';
import { TimedNotice } from '@/components/ui/TimedNotice';
import {
  useCreateCustomerMutation,
  useCustomerDirectoryQuery,
  useUpdateCustomerMutation,
  useSetCustomerActiveMutation,
  useUpdateCustomerPricingMutation,
} from './customer.queries';
import type { CustomerSummary } from './services/customer.service';
export default function CustomersPage() {
  const [name, setName] = useState(''),
    [rate, setRate] = useState(''),
    [type, setType] = useState<PricingType>('FIXED_PER_LITRE'),
    [pricingCustomer, setPricingCustomer] = useState<CustomerSummary | null>(null),
    [pricingRate, setPricingRate] = useState(''),
    [pricingType, setPricingType] = useState<PricingType>('FIXED_PER_LITRE'),
    [editCustomer, setEditCustomer] = useState<CustomerSummary | null>(null),
    [editName, setEditName] = useState(''),
    [editPhone, setEditPhone] = useState(''),
    [editAddress, setEditAddress] = useState(''),
    [editNotes, setEditNotes] = useState(''),
    [message, setMessage] = useState('');
  const directoryQuery = useCustomerDirectoryQuery();
  const createMutation = useCreateCustomerMutation();
  const pricingMutation = useUpdateCustomerPricingMutation();
  const editMutation = useUpdateCustomerMutation();
  const statusMutation = useSetCustomerActiveMutation();
  const rows = directoryQuery.data?.customers ?? [];
  const entries = directoryQuery.data?.entries ?? [];
  const busy = createMutation.isPending;
  const pricingBusy = pricingMutation.isPending;
  const editBusy = editMutation.isPending;
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setMessage('');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in again to add a customer.');
      await createMutation.mutateAsync({
        userId: user.id,
        name: name.trim(),
        pricingType: type,
        defaultRate: Number(rate),
      });
      setName('');
      setRate('');
      setMessage('Customer added.');
    } catch (createError) {
      setMessage(createError instanceof Error ? createError.message : 'Could not add customer.');
    }
  }

  function openEdit(customer: CustomerSummary) {
    setEditCustomer(customer);
    setEditName(customer.name);
    setEditPhone(customer.phone ?? '');
    setEditAddress(customer.address ?? '');
    setEditNotes(customer.notes ?? '');
  }

  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editCustomer) return;
    if (!editName.trim()) {
      setMessage('Customer name is required.');
      return;
    }
    setMessage('');
    try {
      await editMutation.mutateAsync({
        customerId: editCustomer.id,
        name: editName,
        phone: editPhone,
        address: editAddress,
        notes: editNotes,
      });
      setEditCustomer(null);
      setMessage('Customer details updated.');
    } catch (updateError) {
      setMessage(updateError instanceof Error ? updateError.message : 'Could not update customer.');
    }
  }

  function openPricing(customer: CustomerSummary) {
    setPricingCustomer(customer);
    setPricingRate(String(customer.default_rate));
    setPricingType(customer.pricing_type);
  }
  async function savePricing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pricingCustomer) return;
    const defaultRate = Number(pricingRate);
    if (!Number.isFinite(defaultRate) || defaultRate <= 0) {
      setMessage('Rate must be greater than zero.');
      return;
    }
    setMessage('');
    try {
      await pricingMutation.mutateAsync({
        customerId: pricingCustomer.id,
        defaultRate,
        pricingType,
      });
      setPricingCustomer(null);
      setMessage('Pricing updated.');
    } catch (updateError) {
      setMessage(updateError instanceof Error ? updateError.message : 'Could not update pricing.');
    }
  }

  async function toggle(customer: CustomerSummary) {
    try {
      await statusMutation.mutateAsync({ customerId: customer.id, active: !customer.is_active });
      setMessage(customer.is_active ? 'Customer paused.' : 'Customer activated.');
    } catch (updateError) {
      setMessage(updateError instanceof Error ? updateError.message : 'Could not update customer status.');
    }
  }

  return (
    <AppShell title="Customers" subtitle="Manage customer pricing and sales history">
      <div className="management-stack">
        <form className="card customer-create-card" onSubmit={create}>
          <h2 className="section-title customer-create-heading">Add customer</h2>
          <div className="field">
            <Label>Name</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer or party name"
            />
          </div>
          <div className="field">
            <Label>Pricing model</Label>
            <Select value={type} onValueChange={(value) => setType(value as PricingType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="FIXED_PER_LITRE">Fixed per litre</SelectItem><SelectItem value="FAT_BASED">Fat based</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="field">
            <Label>Default rate · ₹</Label>
            <Input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <button className="btn customer-create-submit" disabled={busy}>
            {busy ? 'Saving…' : 'Add customer'}
          </button>
          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        </form>
        <div className="card">
          <div className="row">
            <h2 className="section-title">Customer directory</h2>
            <Badge variant="secondary">{rows.filter((c) => c.is_active).length} active</Badge>
          </div>
          {directoryQuery.isPending ? (
            <div className="space-y-3 py-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div>
          ) : directoryQuery.isError ? (
            <div className="empty">{directoryQuery.error.message}</div>
          ) : rows.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Pricing</TableHead><TableHead>Default rate</TableHead><TableHead>Total milk</TableHead><TableHead>Revenue</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((c) => {
                  const own = entries.filter((e) => e.customer_id === c.id);
                  return <TableRow key={c.id}>
                    <TableCell><Link href={`/customers/${c.id}`} className="font-semibold text-[var(--ink)]">{c.name}</Link><div className="kpi-foot">{c.phone || '—'}</div></TableCell>
                    <TableCell>{c.pricing_type === 'FIXED_PER_LITRE' ? 'Fixed / L' : 'Fat based'}</TableCell>
                    <TableCell>₹{c.default_rate}</TableCell>
                    <TableCell>{milkTxt(own.reduce((s, e) => s + Number(e.milk_quantity), 0))}</TableCell>
                    <TableCell>{money(own.reduce((s, e) => s + Number(e.calculated_amount), 0))}</TableCell>
                    <TableCell>
                      <Badge
                        variant={c.is_active ? 'secondary' : 'muted'}
                        className={c.is_active
                          ? 'rounded-full bg-[#edf5ef] px-3 py-1 text-[#246b4f]'
                          : 'rounded-full bg-[#f0f2f1] px-3 py-1 text-[#68756e]'}
                      >
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell><div className="flex justify-end gap-2"><button type="button" className="date-chip" onClick={() => openEdit(c)}>Edit</button><button type="button" className="date-chip" onClick={() => openPricing(c)}>Rate</button><button type="button" className="date-chip" onClick={() => void toggle(c)}>{c.is_active ? 'Pause' : 'Activate'}</button></div></TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="empty">
              No customers yet. Add the first customer to start recording sales.
            </div>
          )}
        </div>
      </div>
      <Dialog
        open={!!editCustomer}
        onOpenChange={(open) => {
          if (!open && !editBusy) setEditCustomer(null);
        }}
        labelledBy="customer-edit-title"
      >
        <form onSubmit={saveCustomer}>
          <div className="dialog-header">
            <div>
              <p className="eyebrow">CUSTOMER PROFILE</p>
              <h2 className="dialog-title" id="customer-edit-title">Edit customer</h2>
              <p className="dialog-description">{editCustomer?.name}</p>
            </div>
            <button
              className="dialog-close"
              type="button"
              aria-label="Close customer edit dialog"
              disabled={editBusy}
              onClick={() => setEditCustomer(null)}
            >
              ×
            </button>
          </div>
          <div className="field">
            <Label htmlFor="customer-edit-name">Name</Label>
            <Input id="customer-edit-name" required value={editName} onChange={(event) => setEditName(event.target.value)} />
          </div>
          <div className="field">
            <Label htmlFor="customer-edit-phone">Phone</Label>
            <Input id="customer-edit-phone" value={editPhone} onChange={(event) => setEditPhone(event.target.value)} />
          </div>
          <div className="field">
            <Label htmlFor="customer-edit-address">Address</Label>
            <Input id="customer-edit-address" value={editAddress} onChange={(event) => setEditAddress(event.target.value)} />
          </div>
          <div className="field">
            <Label htmlFor="customer-edit-notes">Notes</Label>
            <Textarea
              id="customer-edit-notes"
              value={editNotes}
              onChange={(event) => setEditNotes(event.target.value)}
              rows={3}
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, resize: 'vertical' }}
            />
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn secondary" disabled={editBusy} onClick={() => setEditCustomer(null)}>
              Cancel
            </button>
            <button className="btn" disabled={editBusy}>
              {editBusy ? 'Saving…' : 'Save customer'}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={!!pricingCustomer}
        onOpenChange={(open) => {
          if (!open && !pricingBusy) setPricingCustomer(null);
        }}
        labelledBy="customer-pricing-title"
      >
        <form onSubmit={savePricing}>
          <div className="dialog-header">
            <div>
              <p className="eyebrow">CUSTOMER PRICING</p>
              <h2 className="dialog-title" id="customer-pricing-title">
                Update rate
              </h2>
              <p className="dialog-description">{pricingCustomer?.name}</p>
            </div>
            <button
              className="dialog-close"
              type="button"
              aria-label="Close pricing dialog"
              disabled={pricingBusy}
              onClick={() => setPricingCustomer(null)}
            >
              ×
            </button>
          </div>
          <div className="field">
            <Label htmlFor="customer-pricing-rate">Default rate · ₹</Label>
            <Input
              id="customer-pricing-rate"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={pricingRate}
              onChange={(event) => setPricingRate(event.target.value)}
            />
          </div>
          <div className="field">
            <Label htmlFor="customer-pricing-type">Pricing model</Label>
            <Select value={pricingType} onValueChange={(value) => setPricingType(value as PricingType)}>
              <SelectTrigger id="customer-pricing-type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="FIXED_PER_LITRE">Fixed per litre</SelectItem><SelectItem value="FAT_BASED">Fat based</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="dialog-footer">
            <button
              type="button"
              className="btn secondary"
              disabled={pricingBusy}
              onClick={() => setPricingCustomer(null)}
            >
              Cancel
            </button>
            <button className="btn" disabled={pricingBusy}>
              {pricingBusy ? 'Saving…' : 'Save pricing'}
            </button>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
