'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/feed-types';
import type { ExpenseVendor } from '@/lib/expense-types';
import type { FeedPurchaseListRow } from '@/lib/feed-purchase-types';
import { todayLocal } from '../../expenses/shared';
import { FeedPurchaseForm } from './components/FeedPurchaseForm';
import { FeedPurchaseTable } from './components/FeedPurchaseTable';
import { createFeedPurchase, fetchFeedPurchases } from './services';
import type { FeedPurchaseFormValues } from './schema';

const PAGE_SIZE = 20;

export default function FeedPurchasesPage() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [vendors, setVendors] = useState<Pick<ExpenseVendor, 'id' | 'name'>[]>([]);
  const [rows, setRows] = useState<FeedPurchaseListRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    try {
      const [feeds, vendorResult, purchases] = await Promise.all([
        supabase.from('feed_items').select('*').eq('is_active', true).order('name'),
        supabase.from('expense_vendors').select('id,name').eq('is_active', true).order('name'),
        fetchFeedPurchases(supabase, page, PAGE_SIZE),
      ]);
      if (feeds.error) throw feeds.error;
      if (vendorResult.error) throw vendorResult.error;
      setFeedItems(feeds.data ?? []);
      setVendors(vendorResult.data ?? []);
      setRows(purchases.rows);
      setCount(purchases.count);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load feed purchases.');
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  async function save(values: FeedPurchaseFormValues) {
    if (!supabase) return 'Supabase is not configured.';
    setBusy(true);
    setMessage('');
    try {
      await createFeedPurchase(supabase, values);
      await load();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not record feed purchase.';
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Feed purchases" subtitle="Record feed stock-in and supplier purchases">
      <div className="management-stack">
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <FeedPurchaseForm feedItems={feedItems} vendors={vendors} onSave={save} busy={busy} message="" />
        <FeedPurchaseTable rows={rows} count={count} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </AppShell>
  );
}