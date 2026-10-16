'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useState } from 'react';
import { ExpenseShell, money } from '../shared';
import { useExpenseVendorDirectoryQuery, useSaveExpenseVendorMutation, useToggleExpenseVendorMutation } from '@/features/expenses/expense.queries';
import { TimedNotice } from '@/components/ui/TimedNotice';
import type { ExpenseVendor } from '@/lib/expense-types';
export default function ExpenseVendors() {
    [name, setName] = useState(''),
    [mobile, setMobile] = useState(''),
    [city, setCity] = useState(''),
    [address, setAddress] = useState(''),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(''),
    [message, setMessage] = useState(''),
    [editingVendor, setEditingVendor] = useState<ExpenseVendor | null>(null),
    [statusTarget, setStatusTarget] = useState<ExpenseVendor | null>(null),
    [statusBusy, setStatusBusy] = useState(false),
    [editBusy, setEditBusy] = useState(false),
    [editName, setEditName] = useState(''),
    [editMobile, setEditMobile] = useState(''),
    [editCity, setEditCity] = useState(''),
    [editAddress, setEditAddress] = useState('');
  const vendorQuery = useExpenseVendorDirectoryQuery();
  const saveVendorMutation = useSaveExpenseVendorMutation();
  const toggleVendorMutation = useToggleExpenseVendorMutation();
  const rows = vendorQuery.data ?? [];
  const loading = vendorQuery.isPending;
  const loadError = vendorQuery.error?.message ?? '';
  const load = async () => { await vendorQuery.refetch(); };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) { setMessage('Vendor name is required.'); return; }
    setBusy(true);
    try {
      await saveVendorMutation.mutateAsync({
        values: { name: name.trim(), mobile: mobile.trim() || null, city: city.trim() || null, address: address.trim() || null },
      });
      setName('');
      setMobile('');
      setCity('');
      setAddress('');
      setMessage('Vendor added.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not add vendor.');
    } finally {
      setBusy(false);
    }
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
    if (!editingVendor || editBusy) return;
    if (!editName.trim()) { setMessage('Vendor name is required.'); return; }
    setEditBusy(true);
    try {
      await saveVendorMutation.mutateAsync({
        id: editingVendor.id,
        values: { name: editName.trim(), mobile: editMobile.trim() || null, city: editCity.trim() || null, address: editAddress.trim() || null },
      });
      setEditingVendor(null);
      setMessage('Vendor updated. Existing expense snapshots remain unchanged.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update vendor.');
    } finally {
      setEditBusy(false);
    }
  }
  async function toggle(v: ExpenseVendor) {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      await toggleVendorMutation.mutateAsync({ id: v.id, isActive: !v.is_active });
      setStatusTarget(null);
      setMessage(v.is_active ? 'Vendor deactivated.' : 'Vendor activated.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update vendor status.');
    } finally {
      setStatusBusy(false);
    }
  }
  return (
    <ExpenseShell title="Expense vendors" subtitle="Suppliers, transporters and service providers">
      <div className="management-stack">
        <form className="card space-y-4" onSubmit={save}>
          <h2 className="section-title">Add vendor</h2>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
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
          <div className="field md:col-span-2 xl:col-span-3">
            <Label htmlFor="vendor-address">Address <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="vendor-address" maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Saving…' : 'Add vendor'}
            </Button>
          </div>
          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        </form>
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-title mb-0">Vendor directory</h2><Badge variant="secondary">{rows.filter((vendorRow) => vendorRow.is_active).length} active</Badge></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="field min-w-0"><Label htmlFor="vendor-directory-search">Search vendors</Label><Input id="vendor-directory-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, mobile or city" /></div>
            <Button type="button" variant="ghost" disabled={!search} onClick={() => setSearch('')}>Reset search</Button>
          </div>
          {loadError ? <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm"><p>{loadError}</p><Button className="mt-3" type="button" size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div> : <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]" aria-busy={loading}>
            <Table className="min-w-[800px] [&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
              <TableHeader><TableRow><TableHead>VENDOR</TableHead><TableHead>MOBILE</TableHead><TableHead>EXPENSES</TableHead><TableHead>TOTAL PURCHASED</TableHead><TableHead>OUTSTANDING</TableHead><TableHead>STATUS / ACTIONS</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 4 }, (_, index) => <TableRow key={index}>{Array.from({ length: 6 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : rows.filter((vendorRow) => `${vendorRow.name} ${vendorRow.mobile ?? ''} ${vendorRow.city ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell><Link href={`/expenses/vendors/${v.id}`} className="font-semibold text-[var(--ink)]">{v.name}</Link><div className="text-xs text-muted-foreground">{v.city ?? ''}</div></TableCell>
                    <TableCell>{v.mobile ?? '—'}</TableCell><TableCell>{v.count}</TableCell><TableCell>{money(v.total)}</TableCell><TableCell>{money(v.pending)}</TableCell>
                    <TableCell><div className="flex flex-wrap items-center gap-2"><Badge variant={v.is_active ? 'secondary' : 'muted'}>{v.is_active ? 'Active' : 'Inactive'}</Badge><Button type="button" variant="outline" size="sm" onClick={() => beginEdit(v)}>Edit</Button><Button type="button" variant="outline" size="sm" onClick={() => v.is_active ? setStatusTarget(v) : void toggle(v)}>{v.is_active ? 'Deactivate' : 'Activate'}</Button></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>}
          {!loading && !loadError && !rows.filter((vendorRow) => `${vendorRow.name} ${vendorRow.mobile ?? ''} ${vendorRow.city ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())).length && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{search.trim() ? 'No vendors match your search.' : 'No vendors yet. Vendor is optional when recording an expense.'}</div>}
        </div>
      </div>
      <Dialog open={!!editingVendor} onOpenChange={(open) => { if (!open && !editBusy) setEditingVendor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit vendor</DialogTitle>
            <DialogDescription>Vendor master changes affect future selections only. Existing expense snapshots are preserved.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="field"><Label htmlFor="edit-vendor-name">Name</Label><Input id="edit-vendor-name" required maxLength={160} value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="field"><Label htmlFor="edit-vendor-mobile">Mobile</Label><Input id="edit-vendor-mobile" inputMode="tel" maxLength={30} value={editMobile} onChange={(e) => setEditMobile(e.target.value)} /></div>
            <div className="field"><Label htmlFor="edit-vendor-city">City</Label><Input id="edit-vendor-city" maxLength={120} value={editCity} onChange={(e) => setEditCity(e.target.value)} /></div>
            <div className="field sm:col-span-2"><Label htmlFor="edit-vendor-address">Address</Label><Textarea id="edit-vendor-address" rows={2} maxLength={500} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} /></div>
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
