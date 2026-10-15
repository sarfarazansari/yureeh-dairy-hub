'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EXPENSE_GROUPS, UNITS, type ExpenseGroup } from '@/lib/expenses';
import { ExpenseShell, ensureExpenseCategories } from '../shared';
import { TimedNotice } from '@/components/ui/TimedNotice';
import type { ExpenseCategory } from '@/lib/expense-types';
export default function ExpenseCategories() {
  const [rows, setRows] = useState<ExpenseCategory[]>([]),
    [id, setId] = useState(''),
    [name, setName] = useState(''),
    [group, setGroup] = useState<ExpenseGroup>('FEED'),
    [unit, setUnit] = useState(''),
    [quantity, setQuantity] = useState(true),
    [description, setDescription] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [statusTarget, setStatusTarget] = useState<ExpenseCategory | null>(null),
    [statusBusy, setStatusBusy] = useState(false);
  async function load() {
    if (!supabase) {
      setLoadError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      await ensureExpenseCategories(supabase);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error('Sign in again to load expense categories.');
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('owner_id', user.id)
        .order('category_group')
        .order('name');
      if (error) throw error;
      setRows(data ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load expense categories.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, []);
  function edit(c: ExpenseCategory) {
    setId(c.id);
    setName(c.name);
    setGroup(c.category_group);
    setUnit(c.default_unit ?? '');
    setQuantity(c.is_quantity_based);
    setDescription(c.description ?? '');
  }
  function clear() {
    setId('');
    setName('');
    setGroup('FEED');
    setUnit('');
    setQuantity(true);
    setDescription('');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const values = {
      name: name.trim(),
      category_group: group,
      default_unit: unit || null,
      is_quantity_based: quantity,
      description: description || null,
    };
    const result = id
      ? await supabase.from('expense_categories').update(values).eq('id', id)
      : await supabase.from('expense_categories').insert({ ...values, owner_id: user?.id });
    if (result.error) setMessage(result.error.message);
    else {
      setMessage(id ? 'Category updated.' : 'Category created.');
      clear();
      await load();
    }
    setBusy(false);
  }
  async function toggle(c: ExpenseCategory) {
    if (!supabase || statusBusy) return;
    setStatusBusy(true);
    try {
      const { error } = await supabase
        .from('expense_categories')
        .update({ is_active: !c.is_active })
        .eq('id', c.id);
      if (error) throw error;
      setStatusTarget(null);
      setMessage(c.is_active ? 'Category deactivated.' : 'Category activated.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update category status.');
    } finally {
      setStatusBusy(false);
    }
  }
  const categoryForm = (
    <form className={id ? 'category-edit-form grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3' : 'card space-y-4'} onSubmit={save}>
      <h2 className="section-title" id={id ? 'edit-category-title' : undefined}>
        {id ? 'Edit category' : 'Add category'}
      </h2>
      <div className="field">
        <Label htmlFor="expense-category-name">Name</Label>
        <Input
          id="expense-category-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mineral mixture"
        />
      </div>
      <div className="field">
        <Label htmlFor="expense-category-group">Group</Label>
        <Select value={group} onValueChange={(value) => setGroup(value as ExpenseGroup)}><SelectTrigger id="expense-category-group"><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_GROUPS.map((g) => <SelectItem key={g} value={g}>{g.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="field">
        <Label htmlFor="expense-category-unit">Default unit</Label>
        <Select value={unit || "none"} onValueChange={(value) => setUnit(value === "none" ? "" : value)}><SelectTrigger id="expense-category-unit"><SelectValue placeholder="No default unit" /></SelectTrigger><SelectContent><SelectItem value="none">No default unit</SelectItem>{UNITS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="field flex min-h-10 items-center gap-3 rounded-md border p-3">
        <Checkbox id="expense-category-quantity" checked={quantity} onCheckedChange={(checked) => setQuantity(checked === true)} />
        <Label htmlFor="expense-category-quantity">Quantity based</Label>
      </div>
      <div className="field sm:col-span-2 xl:col-span-3">
        <Label htmlFor="expense-category-description">Description <span className="text-muted-foreground">(optional)</span></Label>
        <Input
          id="expense-category-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="dialog-footer sm:col-span-2 xl:col-span-3">
        {id && (
          <Button type="button" variant="secondary" onClick={clear} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={busy || !name.trim()}>
          {busy ? 'Saving…' : id ? 'Save category' : 'Add category'}
        </Button>
      </div>
    </form>
  );
  return (
    <ExpenseShell
      title="Expense categories"
      subtitle="Edit your farm’s expense categories and defaults"
    >
      <div className="management-stack">
        {!id && categoryForm}
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <div className="card">
          <div className="row">
            <h2 className="section-title">Categories</h2>
            <span className="tag">{rows.filter((c) => c.is_active).length} active</span>
          </div>
          {loadError ? (
            <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm">
              <p>{loadError}</p>
              <Button className="mt-3" type="button" size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
            </div>
          ) : (
            <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]" aria-busy={loading}>
              <Table className="min-w-[700px] [&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
                <TableHeader><TableRow><TableHead>NAME</TableHead><TableHead>GROUP</TableHead><TableHead>UNIT</TableHead><TableHead>MODE</TableHead><TableHead>STATUS</TableHead><TableHead>ACTIONS</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? Array.from({ length: 4 }, (_, i) => <TableRow key={i}>{Array.from({ length: 6 }, (_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><b>{c.name}</b></TableCell>
                      <TableCell>{c.category_group.replaceAll('_', ' ')}</TableCell>
                      <TableCell>{c.default_unit ?? '—'}</TableCell>
                      <TableCell>{c.is_quantity_based ? 'Quantity × rate' : 'Direct amount'}</TableCell>
                      <TableCell><Badge variant={c.is_active ? 'secondary' : 'muted'}>{c.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => edit(c)}>Edit</Button><Button type="button" variant="outline" size="sm" onClick={() => c.is_active ? setStatusTarget(c) : void toggle(c)}>{c.is_active ? 'Deactivate' : 'Activate'}</Button></div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && !loadError && !rows.length && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No expense categories found.</div>}
          <p className="kpi-foot">
            Categories used by expenses are deactivated instead of deleted; saved expenses keep
            their original category snapshot.
          </p>
        </div>
      </div>
      <Dialog open={!!id} onOpenChange={(open) => { if (!open && !busy) clear(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle id="edit-category-title">Edit expense category</DialogTitle><DialogDescription>Changes to category defaults affect future expense entries. Existing expense snapshots remain intact.</DialogDescription></DialogHeader>
          {id && categoryForm}
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!statusTarget} onOpenChange={(open) => { if (!open && !statusBusy) setStatusTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate expense category?</AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.name} will no longer be available for new expenses. Existing expense snapshots and history will remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); if (statusTarget) void toggle(statusTarget); }} disabled={statusBusy}>
              {statusBusy ? 'Updating…' : 'Deactivate category'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ExpenseShell>
  );
}
