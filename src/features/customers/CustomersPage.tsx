'use client';

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
        <form className="card" onSubmit={create}>
          <h2 className="section-title">Add customer</h2>
          <div className="field">
            <label>Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer or party name"
            />
          </div>
          <div className="field">
            <label>Pricing model</label>
            <select value={type} onChange={(e) => setType(e.target.value as PricingType)}>
              <option value="FIXED_PER_LITRE">Fixed per litre</option>
              <option value="FAT_BASED">Fat based</option>
            </select>
          </div>
          <div className="field">
            <label>Default rate · ₹</label>
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <button className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Add customer'}
          </button>
          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        </form>
        <div className="card">
          <div className="row">
            <h2 className="section-title">Customer directory</h2>
            <span className="tag">{rows.filter((c) => c.is_active).length} active</span>
          </div>
          {directoryQuery.isPending ? (
            <div className="empty">Loading customers…</div>
          ) : directoryQuery.isError ? (
            <div className="empty">{directoryQuery.error.message}</div>
          ) : rows.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>CUSTOMER</th>
                    <th>PRICING</th>
                    <th>DEFAULT RATE</th>
                    <th>TOTAL MILK</th>
                    <th>REVENUE</th>
                    <th>STATUS</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const own = entries.filter((e) => e.customer_id === c.id);
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/customers/${c.id}`}>
                            <b>{c.name}</b>
                          </Link>
                          <div className="kpi-foot">{c.phone || '—'}</div>
                        </td>
                        <td>{c.pricing_type === 'FIXED_PER_LITRE' ? 'Fixed / L' : 'Fat based'}</td>
                        <td>₹{c.default_rate}</td>
                        <td>{milkTxt(own.reduce((s, e) => s + Number(e.milk_quantity), 0))}</td>
                        <td>{money(own.reduce((s, e) => s + Number(e.calculated_amount), 0))}</td>
                        <td>
                          <span className={`tag ${c.is_active ? '' : 'gold'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="date-chip"
                            onClick={() => openEdit(c)}
                          >
                            Edit
                          </button>{' '}
                          <button
                            type="button"
                            className="date-chip"
                            onClick={() => openPricing(c)}
                          >
                            Rate
                          </button>{' '}
                          <button className="date-chip" onClick={() => toggle(c)}>
                            {c.is_active ? 'Pause' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
            <label htmlFor="customer-edit-name">Name</label>
            <input id="customer-edit-name" required value={editName} onChange={(event) => setEditName(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="customer-edit-phone">Phone</label>
            <input id="customer-edit-phone" value={editPhone} onChange={(event) => setEditPhone(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="customer-edit-address">Address</label>
            <input id="customer-edit-address" value={editAddress} onChange={(event) => setEditAddress(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="customer-edit-notes">Notes</label>
            <textarea
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
            <label htmlFor="customer-pricing-rate">Default rate · ₹</label>
            <input
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
            <label htmlFor="customer-pricing-type">Pricing model</label>
            <select
              id="customer-pricing-type"
              value={pricingType}
              onChange={(event) => setPricingType(event.target.value as PricingType)}
            >
              <option value="FIXED_PER_LITRE">Fixed per litre</option>
              <option value="FAT_BASED">Fat based</option>
            </select>
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
