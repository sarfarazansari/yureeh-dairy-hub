'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExpenseShell, money } from '../shared';
import { TimedNotice } from '@/components/ui/TimedNotice';
import type { ExpenseVendor } from '@/lib/expense-types';
type VendorSummary = ExpenseVendor & { count: number; total: number; pending: number };
export default function ExpenseVendors() {
  const [rows, setRows] = useState<VendorSummary[]>([]),
    [name, setName] = useState(''),
    [mobile, setMobile] = useState(''),
    [city, setCity] = useState(''),
    [address, setAddress] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function load() {
    if (!supabase) return;
    const [v, e] = await Promise.all([
      supabase.from('expense_vendors').select('*').order('name'),
      supabase
        .from('expenses')
        .select('vendor_id,total_amount,paid_amount,pending_amount')
        .is('deleted_at', null),
    ]);
    if (v.error || e.error) setMessage((v.error ?? e.error)!.message);
    setRows(
      (v.data ?? []).map((x) => {
        const own = (e.data ?? []).filter((y) => y.vendor_id === x.id);
        return {
          ...x,
          count: own.length,
          total: own.reduce((s, y) => s + Number(y.total_amount), 0),
          paid: own.reduce((s, y) => s + Number(y.paid_amount), 0),
          pending: own.reduce((s, y) => s + Number(y.pending_amount), 0),
        };
      }),
    );
  }
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from('expense_vendors').insert({
      user_id: user?.id,
      name: name.trim(),
      mobile: mobile || null,
      city: city || null,
      address: address || null,
    });
    if (error) setMessage(error.message);
    else {
      setName('');
      setMobile('');
      setCity('');
      setAddress('');
      setMessage('Vendor added.');
      await load();
    }
    setBusy(false);
  }
  async function toggle(v: ExpenseVendor) {
    const { error } = await supabase!
      .from('expense_vendors')
      .update({ is_active: !v.is_active })
      .eq('id', v.id);
    if (error) setMessage(error.message);
    else await load();
  }
  return (
    <ExpenseShell title="Expense vendors" subtitle="Suppliers, transporters and service providers">
      <div className="management-stack">
        <form className="card" onSubmit={save}>
          <h2 className="section-title">Add vendor</h2>
          <div className="field">
            <label>Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Mobile</label>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>
          <div className="field">
            <label>City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label>Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <button className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Add vendor'}
          </button>
          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        </form>
        <div className="card">
          <h2 className="section-title">Vendor directory</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>VENDOR</th>
                  <th>MOBILE</th>
                  <th>EXPENSES</th>
                  <th>TOTAL PURCHASED</th>
                  <th>OUTSTANDING</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/expenses/vendors/${v.id}`}>
                        <b>{v.name}</b>
                      </Link>
                      <div className="kpi-foot">{v.city ?? ''}</div>
                    </td>
                    <td>{v.mobile ?? '—'}</td>
                    <td>{v.count}</td>
                    <td>{money(v.total)}</td>
                    <td>{money(v.pending)}</td>
                    <td>
                      <button className="date-chip" onClick={() => toggle(v)}>
                        {v.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <div className="empty">
              No vendors yet. Vendor is optional when recording an expense.
            </div>
          )}
        </div>
      </div>
    </ExpenseShell>
  );
}
