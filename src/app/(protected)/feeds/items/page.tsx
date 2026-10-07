'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { AppShell } from '@/components/layout/AppShell';
import {
  FEED_CATEGORIES,
  FEED_UNITS,
  type FeedCategory,
  type FeedItem,
} from '@/lib/feed-types';

const label = (value: string) => value.replaceAll('_', ' ');

export default function FeedItemsPage() {
  const [rows, setRows] = useState<FeedItem[]>([]);
  const [search, setSearch] = useState('');
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FeedCategory>('CONCENTRATE');
  const [baseUnit, setBaseUnit] = useState('KG');
  const [purchaseUnit, setPurchaseUnit] = useState('KG');
  const [conversion, setConversion] = useState('1');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('feed_items')
      .select('*')
      .order('is_active', { ascending: false })
      .order('name');
    if (error) setMessage(error.message);
    setRows(data ?? []);
  }

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, []);

  const visible = useMemo(
    () =>
      rows.filter((row) =>
        (row.name + ' ' + row.category).toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [rows, search],
  );

  function clear() {
    setId('');
    setName('');
    setCategory('CONCENTRATE');
    setBaseUnit('KG');
    setPurchaseUnit('KG');
    setConversion('1');
    setNotes('');
  }

  function edit(row: FeedItem) {
    setId(row.id);
    setName(row.name);
    setCategory(row.category);
    setBaseUnit(row.base_unit);
    setPurchaseUnit(row.purchase_unit);
    setConversion(String(row.purchase_unit_quantity));
    setNotes(row.notes ?? '');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    const cleanName = name.trim();
    const quantity = Number(conversion);

    if (!cleanName) return setMessage('Feed name is required.');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return setMessage('Purchase unit quantity must be greater than zero.');
    }
    if (!baseUnit.trim() || !purchaseUnit.trim()) {
      return setMessage('Base unit and purchase unit are required.');
    }

    setBusy(true);
    setMessage('');

    const values = {
      name: cleanName,
      category,
      base_unit: baseUnit.trim().toUpperCase(),
      purchase_unit: purchaseUnit.trim().toUpperCase(),
      purchase_unit_quantity: quantity,
      notes: notes.trim() || null,
    };

    let result;
    if (id) {
      result = await supabase.from('feed_items').update(values).eq('id', id);
    } else {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setMessage(userError?.message ?? 'You must be signed in to create a feed item.');
        setBusy(false);
        return;
      }

      result = await supabase.from('feed_items').insert({
        ...values,
        user_id: userData.user.id,
      });
    }

    if (result.error) {
      setMessage(
        result.error.code === '23505'
          ? 'A feed item with this name already exists.'
          : result.error.message,
      );
    } else {
      setMessage(id ? 'Feed item updated.' : 'Feed item created.');
      clear();
      await load();
    }

    setBusy(false);
  }

  async function toggle(row: FeedItem) {
    if (!supabase) return;
    const { error } = await supabase
      .from('feed_items')
      .update({ is_active: !row.is_active })
      .eq('id', row.id);
    if (error) setMessage(error.message);
    else await load();
  }

  return (
    <AppShell title="Feed items" subtitle="Manage the farm's physical feed master">
      <div className="management-stack">
        <form className="card" onSubmit={save}>
          <div className="row">
            <h2 className="section-title">{id ? 'Edit feed item' : 'Add feed item'}</h2>
            {id && (
              <button type="button" className="date-chip" onClick={clear} disabled={busy}>
                Cancel
              </button>
            )}
          </div>

          <div className="expense-form-grid">
            <div className="field">
              <label>Name</label>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Poha Churi"
              />
            </div>

            <div className="field">
              <label>Category</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as FeedCategory)}
              >
                {FEED_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {label(item)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Base unit</label>
              <input
                list="feed-unit-list"
                value={baseUnit}
                onChange={(event) => setBaseUnit(event.target.value)}
                placeholder="KG"
              />
            </div>

            <div className="field">
              <label>Purchase unit</label>
              <input
                list="feed-unit-list"
                value={purchaseUnit}
                onChange={(event) => setPurchaseUnit(event.target.value)}
                placeholder="BAG"
              />
            </div>

            <div className="field">
              <label>Base quantity per purchase unit</label>
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                inputMode="decimal"
                value={conversion}
                onChange={(event) => setConversion(event.target.value)}
              />
              <span className="kpi-foot">
                Example: 1 BAG = 50 KG → enter 50.
              </span>
            </div>

            <div className="field wide-field">
              <label>Notes</label>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <datalist id="feed-unit-list">
            {FEED_UNITS.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>

          {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}

          <button className="btn" disabled={busy}>
            {busy ? 'Saving…' : id ? 'Save changes' : 'Add feed item'}
          </button>
        </form>

        <div className="card">
          <div className="row">
            <h2 className="section-title">Feed master</h2>
            <span className="tag">{rows.filter((row) => row.is_active).length} active</span>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>Search</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search feed item"
            />
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>CATEGORY</th>
                  <th>BASE UNIT</th>
                  <th>PURCHASE UNIT</th>
                  <th>CONVERSION</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td><b>{row.name}</b></td>
                    <td>{label(row.category)}</td>
                    <td>{row.base_unit}</td>
                    <td>{row.purchase_unit}</td>
                    <td>
                      1 {row.purchase_unit} = {row.purchase_unit_quantity} {row.base_unit}
                    </td>
                    <td>
                      <span className={'tag ' + (row.is_active ? '' : 'gold')}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="date-chip" onClick={() => edit(row)}>
                        Edit
                      </button>{' '}
                      <button type="button" className="date-chip" onClick={() => toggle(row)}>
                        {row.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!visible.length && <div className="empty">No feed items found.</div>}

          <p className="kpi-foot">
            Feed items are physical inventory masters. Expenses remain a separate accounting
            record.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
