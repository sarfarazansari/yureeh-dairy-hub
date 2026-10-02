'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EXPENSE_GROUPS, UNITS, type ExpenseGroup } from '@/lib/expenses';
import { ExpenseShell, ensureExpenseCategories } from '../shared';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { Dialog } from '@/app/dialog';
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
    [busy, setBusy] = useState(false);
  async function load() {
    if (!supabase) return;
    try {
      await ensureExpenseCategories(supabase);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not load default categories');
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('owner_id', user?.id)
      .order('category_group')
      .order('name');
    if (error) setMessage(error.message);
    setRows(data ?? []);
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
    const { error } = await supabase!
      .from('expense_categories')
      .update({ is_active: !c.is_active })
      .eq('id', c.id);
    if (error) setMessage(error.message);
    else await load();
  }
  const categoryForm = (
    <form className={id ? 'category-edit-form' : 'card'} onSubmit={save}>
      <h2 className="section-title" id={id ? 'edit-category-title' : undefined}>
        {id ? 'Edit category' : 'Add category'}
      </h2>
      <div className="field">
        <label htmlFor="expense-category-name">Name</label>
        <input
          id="expense-category-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mineral mixture"
        />
      </div>
      <div className="field">
        <label htmlFor="expense-category-group">Group</label>
        <select
          id="expense-category-group"
          value={group}
          onChange={(e) => setGroup(e.target.value as ExpenseGroup)}
        >
          {EXPENSE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="expense-category-unit">Default unit</label>
        <input
          id="expense-category-unit"
          list="category-unit-list"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="e.g. KG, BAG, scoop"
        />
        <datalist id="category-unit-list">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>
      <label className="field">
        <span>Quantity based</span>
        <input type="checkbox" checked={quantity} onChange={(e) => setQuantity(e.target.checked)} />
      </label>
      <div className="field">
        <label htmlFor="expense-category-description">Description</label>
        <input
          id="expense-category-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="dialog-footer">
        {id && (
          <button type="button" className="btn secondary" onClick={clear} disabled={busy}>
            Cancel
          </button>
        )}
        <button className="btn" disabled={busy}>
          {busy ? 'Saving…' : id ? 'Save category' : 'Add category'}
        </button>
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
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>GROUP</th>
                  <th>UNIT</th>
                  <th>MODE</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.name}</b>
                    </td>
                    <td>{c.category_group.replaceAll('_', ' ')}</td>
                    <td>{c.default_unit ?? '—'}</td>
                    <td>{c.is_quantity_based ? 'Quantity × rate' : 'Direct amount'}</td>
                    <td>
                      <span className={`tag ${c.is_active ? '' : 'gold'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="date-chip" onClick={() => edit(c)}>
                        Edit
                      </button>{' '}
                      <button type="button" className="date-chip" onClick={() => toggle(c)}>
                        {c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="kpi-foot">
            Categories used by expenses are deactivated instead of deleted; saved expenses keep
            their original category snapshot.
          </p>
        </div>
      </div>
      <Dialog
        open={!!id}
        onOpenChange={(open) => {
          if (!open && !busy) clear();
        }}
        labelledBy="edit-category-title"
      >
        {id && categoryForm}
      </Dialog>
    </ExpenseShell>
  );
}
