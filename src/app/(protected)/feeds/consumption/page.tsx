'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/feed-types';
import type { FeedConsumptionListRow } from '@/lib/feed-consumption-types';
import { FeedConsumptionTable } from './components/FeedConsumptionTable';
import { deleteFeedConsumption, fetchFeedConsumption, fetchFeedItems } from './services';

const PAGE_SIZE = 20;

export default function FeedConsumptionPage() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [rows, setRows] = useState<FeedConsumptionListRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [feedFilter, setFeedFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    try {
      const [feeds, consumption] = await Promise.all([
        fetchFeedItems(supabase, false),
        fetchFeedConsumption(supabase, page, PAGE_SIZE, { from, to, feedItemId: feedFilter }),
      ]);
      setFeedItems(feeds);
      setRows(consumption.rows);
      setCount(consumption.count);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not load feed consumption.', type: 'error' });
    }
  }, [page, from, to, feedFilter]);

  useEffect(() => { void load(); }, [load]);

  async function handleDelete(id: string) {
    if (!supabase) return;
    try {
      await deleteFeedConsumption(supabase, id);
      setToast({ message: 'Feed consumption deleted successfully.', type: 'success' });
      await load();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not delete feed consumption.', type: 'error' });
    }
  }

  function clearFilters() {
    setFrom(''); setTo(''); setFeedFilter(''); setPage(0);
  }

  return (
    <AppShell title="Feed consumption" subtitle="Track feed usage and inventory cost">
      <div className="management-stack">
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />

        <div className="card">
          <div className="row">
            <h2 className="section-title">Consumption archive</h2>
            <Link className="btn" href="/feeds/consumption/new">New consumption</Link>
          </div>
          <div className="expense-form-grid">
            <div className="field"><label>From</label><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} /></div>
            <div className="field"><label>To</label><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} /></div>
            <div className="field"><label>Feed</label><select value={feedFilter} onChange={(e) => { setFeedFilter(e.target.value); setPage(0); }}><option value="">All feeds</option>{feedItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="field" style={{ alignSelf: 'end' }}><button type="button" className="date-chip" onClick={clearFilters}>Clear filters</button></div>
          </div>
        </div>

        <FeedConsumptionTable rows={rows} count={count} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} onDelete={handleDelete} />
      </div>
    </AppShell>
  );
}