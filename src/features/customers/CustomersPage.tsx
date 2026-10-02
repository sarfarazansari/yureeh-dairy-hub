'use client';

import { money, milkTxt } from '@/lib/farm-format';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { type PricingType } from '@/lib/analytics';
import { Dialog } from '@/app/dialog';
import { TimedNotice } from '@/components/ui/TimedNotice';
import {
  createCustomer,
  getCustomerDirectory,
  setCustomerActive,
  updateCustomerPricing,
  type CustomerMilkSummary,
  type CustomerSummary,
} from './services/customer.service';
export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerSummary[]>([]),
    [entries, setEntries] = useState<CustomerMilkSummary[]>([]),
    [name, setName] = useState(''),
    [rate, setRate] = useState(''),
    [type, setType] = useState<PricingType>('FIXED_PER_LITRE'),
    [pricingCustomer, setPricingCustomer] = useState<CustomerSummary | null>(null),
    [pricingRate, setPricingRate] = useState(''),
    [pricingType, setPricingType] = useState<PricingType>('FIXED_PER_LITRE'),
    [pricingBusy, setPricingBusy] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function load() {
    if (!supabase) return;
    try {
      const directory = await getCustomerDirectory(supabase);
      setRows(directory.customers);
      setEntries(directory.entries);
    } catch (loadError) {
      setMessage(loadError instanceof Error ? loadError.message : 'Could not load customers.');
    }
  }
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, []);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in again to add a customer.');
      await createCustomer(supabase, {
        userId: user.id,
        name: name.trim(),
        pricingType: type,
        defaultRate: Number(rate),
      });
      setName('');
      setRate('');
      setMessage('Customer added.');
      await load();
    } catch (createError) {
      setMessage(createError instanceof Error ? createError.message : 'Could not add customer.');
    } finally {
      setBusy(false);
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
    setPricingBusy(true);
    try {
      if (!supabase) return;
      await updateCustomerPricing(supabase, pricingCustomer.id, defaultRate, pricingType);
      setPricingCustomer(null);
      await load();
    } catch (updateError) {
      setMessage(updateError instanceof Error ? updateError.message : 'Could not update pricing.');
    } finally {
      setPricingBusy(false);
    }
  }
  async function toggle(customer: CustomerSummary) {
    try {
      if (!supabase) return;
      await setCustomerActive(supabase, customer.id, !customer.is_active);
      await load();
    } catch (updateError) {
      setMessage(
        updateError instanceof Error ? updateError.message : 'Could not update customer status.',
      );
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
          {rows.length ? (
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
