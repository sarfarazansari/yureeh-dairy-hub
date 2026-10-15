'use client';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) { setLoadError('Supabase is not configured.'); setLoading(false); return; }
    setLoading(true); setLoadError('');
    try {
      const [feeds, consumption] = await Promise.all([
        fetchFeedItems(supabase, false),
        fetchFeedConsumption(supabase, page, PAGE_SIZE, { from, to, feedItemId: feedFilter }),
      ]);
      setFeedItems(feeds);
      setRows(consumption.rows);
      setCount(consumption.count);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load feed consumption.');
    } finally { setLoading(false); }
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
        {loadError && <div role="alert" className="rounded-md border border-destructive/30 p-3 text-sm">{loadError}<Button className="ml-3" type="button" size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div>}

        <div className="card">
          <div className="row">
            <h2 className="section-title">Consumption archive</h2>
            <Link className="btn" href="/feeds/consumption/new">New consumption</Link>
          </div>
          <div className="expense-form-grid">
            <div className="field max-w-md"><Label className="mb-2 block">Date range</Label><DateRangePicker from={from} to={to} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); setPage(0); }} /></div>
            <div className="field"><Label>Feed</Label><Select value={feedFilter || 'all'} onValueChange={(value) => { setFeedFilter(value === 'all' ? '' : value); setPage(0); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All feeds</SelectItem>{feedItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="field" style={{ alignSelf: 'end' }}><button type="button" className="date-chip" onClick={clearFilters}>Clear filters</button></div>
          </div>
        </div>

        <FeedConsumptionTable rows={rows} count={count} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} onDelete={handleDelete} loading={loading} error={loadError} onRetry={() => void load()} />
      </div>
    </AppShell>
  );
}