'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/feed-types';
import { useFeedItemsPageQuery, useSaveFeedItemMutation, useToggleFeedItemMutation } from './queries';
import { FeedItemEditDialog } from './components/FeedItemEditDialog';
import { FeedItemForm, type FeedItemFormValues } from './components/FeedItemForm';
import { FeedItemTable } from './components/FeedItemTable';

export default function FeedItemsPage() {
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<FeedItem | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const saveMutation = useSaveFeedItemMutation();
  const toggleMutation = useToggleFeedItemMutation();

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const feedItemsQuery = useFeedItemsPageQuery(page, pageSize, debouncedSearch);
  const rows = feedItemsQuery.data?.rows ?? [];
  const totalRows = feedItemsQuery.data?.totalRows ?? 0;
  const activeCount = feedItemsQuery.data?.activeCount ?? 0;
  const loadError = feedItemsQuery.error?.message ?? '';
  const load = () => void feedItemsQuery.refetch();

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
      await saveMutation.mutateAsync({
        userId: userData.user.id,
        id,
        values: {
          name: cleanName,
          category: values.category,
          baseUnit: values.baseUnit,
          purchaseUnit: values.purchaseUnit,
          conversion: quantity,
          lowStockThreshold,
          notes: values.notes.trim() || null,
        },
      });
      setMessage(id ? 'Feed item updated.' : 'Feed item created.');
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not save feed item.';
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: FeedItem) {
    try {
      await toggleMutation.mutateAsync({ id: row.id, isActive: !row.is_active });
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update feed item status.');
    }
  }

  return (
    <AppShell title="Feed items" subtitle="Manage the farm's physical feed master">
      <div className="management-stack">
        <FeedItemForm onSave={save} busy={busy} message={message} />
        <FeedItemTable rows={rows} activeCount={activeCount} search={search} onSearchChange={setSearch} onEdit={setEditingItem} onToggle={toggle} loading={busy || feedItemsQuery.isPending} error={loadError} onRetry={load} page={page} pageSize={pageSize} totalRows={totalRows} onPageChange={setPage} />
        <FeedItemEditDialog item={editingItem} open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)} onSave={save} busy={busy} />
      </div>
    </AppShell>
  );
}
