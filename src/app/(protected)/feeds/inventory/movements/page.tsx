'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { AppShell } from '@/components/layout/AppShell';
import type { FeedInventoryMovementType } from '@/lib/feed-inventory-types';
import { FEED_INVENTORY_MOVEMENT_TYPES } from '@/lib/feed-inventory-types';
import { FeedInventoryMovementTable } from '@/features/feed-inventory/components/FeedInventoryMovementTable';
import { useFeedInventoryMovementsQuery, useFeedInventoryStockQuery } from '@/features/feed-inventory/feed-inventory.queries';

const DEFAULT_PAGE_SIZE = 20;
const movementLabel = (value: string) => value.replaceAll('_', ' ');

export default function FeedInventoryMovementsPage() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [feedItemId, setFeedItemId] = useState('');
  const [movementType, setMovementType] = useState<'' | FeedInventoryMovementType>('');
  const stockQuery = useFeedInventoryStockQuery();
  const movementQuery = useFeedInventoryMovementsQuery({ page, pageSize, from, to, feedItemId, movementType });
  const stock = stockQuery.data ?? [];
  const movements = movementQuery.data?.rows ?? [];
  const movementCount = movementQuery.data?.count ?? 0;
  const loadingMovements = movementQuery.isPending;
  const movementError = movementQuery.error?.message ?? '';

  function clearFilters() {
    setFrom('');
    setTo('');
    setFeedItemId('');
    setMovementType('');
    setPage(0);
  }

  return (
    <AppShell title="Feed movement history" subtitle="Audit feed stock entering, being consumed, and other inventory adjustments">
      <div className="management-stack">
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title mb-0">Filter movement history</h2>
            <Button type="button" variant="ghost" onClick={clearFilters} disabled={!from && !to && !feedItemId && !movementType}>Reset filters</Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="field min-w-0"><Label>Date range</Label><DateRangePicker from={from} to={to} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); setPage(0); }} /></div>
            <div className="field min-w-0"><Label htmlFor="inventory-feed-filter">Feed item</Label><Select value={feedItemId || 'all'} onValueChange={(value) => { setFeedItemId(value === 'all' ? '' : value); setPage(0); }}><SelectTrigger id="inventory-feed-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All feed items</SelectItem>{stock.map((row) => <SelectItem key={row.feed_item_id} value={row.feed_item_id}>{row.feed_item_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="field min-w-0"><Label htmlFor="inventory-movement-filter">Movement type</Label><Select value={movementType || 'all'} onValueChange={(value) => { setMovementType(value === 'all' ? '' : value as FeedInventoryMovementType); setPage(0); }}><SelectTrigger id="inventory-movement-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All movement types</SelectItem>{FEED_INVENTORY_MOVEMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{movementLabel(type)}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </div>
        <FeedInventoryMovementTable rows={movements} count={movementCount} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(0); }} loading={loadingMovements} error={movementError} onRetry={() => void movementQuery.refetch()} />
      </div>
    </AppShell>
  );
}
