'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { supabase } from '@/lib/supabase';
import type { FeedCategory, FeedItem } from '@/lib/feed-types';
import { FeedItemEditDialog } from './components/FeedItemEditDialog';
import { FeedItemForm, type FeedItemFormValues } from './components/FeedItemForm';
import { FeedItemTable } from './components/FeedItemTable';

export default function FeedItemsPage() {
  const [rows, setRows] = useState<FeedItem[]>([]);
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<FeedItem | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase.from('feed_items').select('*').order('is_active', { ascending: false }).order('name');
    if (error) setMessage(error.message);
    setRows(data ?? []);
  }

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? rows.filter((row) => (row.name + ' ' + row.category).toLowerCase().includes(query)) : rows;
  }, [rows, search]);

  async function save(values: FeedItemFormValues, id?: string) {
    if (!supabase) return 'Supabase is not configured.';
    const cleanName = values.name.trim();
    const quantity = Number(values.conversion);
    const lowStockThreshold = Number(values.lowStockThreshold);
    if (!cleanName) return 'Feed name is required.';
    if (!Number.isFinite(quantity) || quantity <= 0) return 'Purchase unit quantity must be greater than zero.';
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0 || !/^\d+(\.\d{1,3})?$/.test(values.lowStockThreshold.trim())) return 'Low-stock threshold must be zero or greater with at most three decimal places.';
    if (!values.baseUnit.trim() || !values.purchaseUnit.trim()) return 'Base unit and purchase unit are required.';

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return userError?.message ?? 'You must be signed in to save a feed item.';

    setBusy(true);
    setMessage('');
    try {
      const payload = {
        name: cleanName,
        category: values.category,
        base_unit: values.baseUnit.trim().toUpperCase(),
        purchase_unit: values.purchaseUnit.trim().toUpperCase(),
        purchase_unit_quantity: quantity,
        low_stock_threshold: lowStockThreshold,
        notes: values.notes.trim() || null,
        user_id: userData.user.id,
      };
      const result = id
        ? await supabase.from('feed_items').update(payload).eq('id', id).eq('user_id', userData.user.id).select().single()
        : await supabase.from('feed_items').insert(payload).select().single();

      if (result.error) return result.error.code === '23505' ? 'A feed item with this name already exists.' : result.error.message;
      setMessage(id ? 'Feed item updated.' : 'Feed item created.');
      await load();
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: FeedItem) {
    if (!supabase) return;
    const { error } = await supabase.from('feed_items').update({ is_active: !row.is_active }).eq('id', row.id);
    if (error) setMessage(error.message);
    else await load();
  }

  return (
    <AppShell title="Feed items" subtitle="Manage the farm's physical feed master">
      <div className="management-stack">
        <FeedItemForm onSave={save} busy={busy} message={message} />
        <FeedItemTable rows={visible} activeCount={rows.filter((row) => row.is_active).length} search={search} onSearchChange={setSearch} onEdit={setEditingItem} onToggle={toggle} />
        <FeedItemEditDialog item={editingItem} open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)} onSave={save} busy={busy} />
      </div>
    </AppShell>
  );
}
