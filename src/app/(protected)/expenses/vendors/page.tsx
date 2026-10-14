'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
    [message, setMessage] = useState(''),
    [editingVendor, setEditingVendor] = useState<ExpenseVendor | null>(null),
    [statusTarget, setStatusTarget] = useState<ExpenseVendor | null>(null),
    [statusBusy, setStatusBusy] = useState(false),
    [editBusy, setEditBusy] = useState(false),
    [editName, setEditName] = useState(''),
    [editMobile, setEditMobile] = useState(''),
    [editCity, setEditCity] = useState(''),
    [editAddress, setEditAddress] = useState('');
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
  function beginEdit(v: ExpenseVendor) {
    setEditingVendor(v);
    setEditName(v.name);
    setEditMobile(v.mobile ?? '');
    setEditCity(v.city ?? '');
    setEditAddress(v.address ?? '');
  }
  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !editingVendor || editBusy) return;
    if (!editName.trim()) { setMessage('Vendor name is required.'); return; }
    setEditBusy(true);
    try {
      const { error } = await supabase.from('expense_vendors').update({
        name: editName.trim(), mobile: editMobile.trim() || null,
        city: editCity.trim() || null, address: editAddress.trim() || null,
      }).eq('id', editingVendor.id);
      if (error) throw error;
      setEditingVendor(null);
      setMessage('Vendor updated. Existing expense snapshots remain unchanged.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update vendor.');
    } finally { setEditBusy(false); }
  }
  async function toggle(v: ExpenseVendor) {
    if (!supabase || statusBusy) return;
    setStatusBusy(true);
    try {
      const { error } = await supabase.from('expense_vendors').update({ is_active: !v.is_active }).eq('id', v.id);
      if (error) throw error;
      setStatusTarget(null);
      setMessage(v.is_active ? 'Vendor deactivated.' : 'Vendor activated.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update vendor status.');
    } finally { setStatusBusy(false); }
  }
  return (
    <ExpenseShell title="Expense vendors" subtitle="Suppliers, transporters and service providers">
      <div className="management-stack">
        <form className="card" onSubmit={save}>
          <h2 className="section-title">Add vendor</h2>
          <div className="field">
            <Label htmlFor="vendor-name">Name</Label>
            <Input id="vendor-name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
          </div>
          <div className="field">
            <Label htmlFor="vendor-mobile">Mobile</Label>
            <Input id="vendor-mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={30} />
          </div>
          <div className="field">
            <Label htmlFor="vendor-city">City</Label>
            <Input id="vendor-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
          </div>
          <div className="field">
            <Label htmlFor="vendor-address">Address</Label>
            <Textarea id="vendor-address" maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} rows={3} maxLength={500} />
          </div>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Add vendor'}
          </Button>
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
                      <Button type="button" variant="outline" size="sm" onClick={() => v.is_active ? setStatusTarget(v) : void toggle(v)}>
                        {v.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
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
      <Dialog open={!!editingVendor} onOpenChange={(open) => { if (!open && !editBusy) setEditingVendor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit vendor</DialogTitle>
            <DialogDescription>Vendor master changes affect future selections only. Existing expense snapshots are preserved.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="grid gap-4">
            <div className="field"><Label htmlFor="edit-vendor-name">Name</Label><Input id="edit-vendor-name" required maxLength={160} value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="field"><Label htmlFor="edit-vendor-mobile">Mobile</Label><Input id="edit-vendor-mobile" inputMode="tel" maxLength={30} value={editMobile} onChange={(e) => setEditMobile(e.target.value)} /></div>
            <div className="field"><Label htmlFor="edit-vendor-city">City</Label><Input id="edit-vendor-city" maxLength={120} value={editCity} onChange={(e) => setEditCity(e.target.value)} /></div>
            <div className="field"><Label htmlFor="edit-vendor-address">Address</Label><Textarea id="edit-vendor-address" rows={3} maxLength={500} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} /></div>
            <DialogFooter><Button type="button" variant="secondary" disabled={editBusy} onClick={() => setEditingVendor(null)}>Cancel</Button><Button type="submit" disabled={editBusy || !editName.trim()}>{editBusy ? 'Saving…' : 'Save vendor'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!statusTarget} onOpenChange={(open) => { if (!open && !statusBusy) setStatusTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Deactivate vendor?</AlertDialogTitle><AlertDialogDescription>{statusTarget?.name} will be excluded from new expense and feed-purchase selections. Historical transactions and balances remain.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={statusBusy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={statusBusy} onClick={(event) => { event.preventDefault(); if (statusTarget) void toggle(statusTarget); }}>{statusBusy ? 'Updating…' : 'Deactivate vendor'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ExpenseShell>
  );
}
