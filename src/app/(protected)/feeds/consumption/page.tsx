'use client';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import Link from 'next/link';
import { useState } from 'react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { useDeleteFeedConsumptionMutation, useFeedConsumptionArchiveQuery } from '@/features/feed-consumption/feed-consumption.queries';
import { FeedConsumptionTable } from '@/features/feed-consumption/components/FeedConsumptionTable';


const PAGE_SIZE = 20;

export default function FeedConsumptionPage() {
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [feedFilter, setFeedFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const deleteMutation = useDeleteFeedConsumptionMutation();
  const archiveQuery = useFeedConsumptionArchiveQuery({ page, from, to, feedFilter });
  const feedItems = archiveQuery.data?.feedItems ?? [];
  const rows = archiveQuery.data?.rows ?? [];
  const count = archiveQuery.data?.count ?? 0;
  const loading = archiveQuery.isPending;
  const loadError = archiveQuery.error?.message ?? '';
  const load = () => void archiveQuery.refetch();

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      setToast({ message: 'Feed consumption deleted successfully.', type: 'success' });

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
            <Button asChild><Link href="/feeds/consumption/new">New consumption</Link></Button>
          </div>
          <div className="expense-form-grid">
            <div className="field max-w-md"><Label className="mb-2 block">Date range</Label><DateRangePicker from={from} to={to} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); setPage(0); }} /></div>
            <div className="field"><Label>Feed</Label><Select value={feedFilter || 'all'} onValueChange={(value) => { setFeedFilter(value === 'all' ? '' : value); setPage(0); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All feeds</SelectItem>{feedItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="field" style={{ alignSelf: 'end' }}><Button type="button" variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button></div>
          </div>
        </div>

        <FeedConsumptionTable rows={rows} count={count} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} onDelete={handleDelete} loading={loading} error={loadError} onRetry={() => void load()} />
      </div>
    </AppShell>
  );
}