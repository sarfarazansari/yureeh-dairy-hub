'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCallback, useEffect, useState } from 'react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import type { FeedInventoryStock } from '@/lib/feed-inventory-types';
import type { FeedInventoryMovementType } from '@/lib/feed-inventory-types';
import { FEED_INVENTORY_MOVEMENT_TYPES } from '@/lib/feed-inventory-types';
import { FeedInventoryMovementTable } from './components/FeedInventoryMovementTable';
import { FeedInventoryStockTable } from './components/FeedInventoryStockTable';
import { fetchFeedInventoryMovements, fetchFeedInventoryStock } from './services';

const PAGE_SIZE = 20;
const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const movementLabel = (value: string) => value.replaceAll('_', ' ');

export default function FeedInventoryPage() {
  const [stock, setStock] = useState<FeedInventoryStock[]>([]);
  const [movements, setMovements] = useState<Awaited<ReturnType<typeof fetchFeedInventoryMovements>>['rows']>([]);
  const [movementCount, setMovementCount] = useState(0);
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [feedItemId, setFeedItemId] = useState('');
  const [movementType, setMovementType] = useState<'' | FeedInventoryMovementType>('');
  const [loadingStock, setLoadingStock] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [stockError, setStockError] = useState('');
  const [movementError, setMovementError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadStock = useCallback(async () => {
    if (!supabase) {
      setStockError('Supabase is not configured.');
      setLoadingStock(false);
      return;
    }
    setLoadingStock(true);
    setStockError('');
    try {
      setStock(await fetchFeedInventoryStock(supabase));
    } catch (error) {
      setStockError(error instanceof Error ? error.message : 'Could not load inventory stock.');
    } finally { setLoadingStock(false); }
  }, []);

  const loadMovements = useCallback(async () => {
    if (!supabase) {
      setMovementError('Supabase is not configured.');
      setLoadingMovements(false);
      return;
    }
    setLoadingMovements(true);
    setMovementError('');
    try {
      const result = await fetchFeedInventoryMovements(supabase, page, PAGE_SIZE, { from, to, feedItemId, movementType });
      setMovements(result.rows);
      setMovementCount(result.count);
    } catch (error) {
      setMovementError(error instanceof Error ? error.message : 'Could not load inventory history.');
    } finally { setLoadingMovements(false); }
  }, [page, from, to, feedItemId, movementType]);

  useEffect(() => { void loadStock(); }, [loadStock]);
  useEffect(() => { void loadMovements(); }, [loadMovements]);

  const totalValue = stock.reduce((sum, row) => sum + Number(row.stock_value), 0);
  const lowStockCount = stock.filter((row) => row.is_active && Number(row.quantity_on_hand) > 0 && Number(row.low_stock_threshold) > 0 && Number(row.quantity_on_hand) <= Number(row.low_stock_threshold)).length;
  const outOfStockCount = stock.filter((row) => row.is_active && Number(row.quantity_on_hand) <= 0).length;
  const pages = Math.max(1, Math.ceil(movementCount / PAGE_SIZE));

  function clearFilters() {
    setFrom(''); setTo(''); setFeedItemId(''); setMovementType(''); setPage(0);
  }

  return (
    <AppShell title="Feed inventory" subtitle="Current stock, stock value, low-stock alerts and the complete movement ledger">
      <div className="management-stack">
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card"><div className="kpi-label">FEED ITEMS</div><div className="kpi-value">{loadingStock ? '…' : stock.length}</div><div className="kpi-foot">Includes items with no stock movements</div></div>
          <div className="card"><div className="kpi-label">CURRENT STOCK VALUE</div><div className="kpi-value">{loadingStock ? '…' : money(totalValue)}</div><div className="kpi-foot">Ledger-derived inventory value</div></div>
          <div className="card"><div className="kpi-label">LOW STOCK</div><div className="kpi-value">{loadingStock ? '…' : lowStockCount}</div><div className="kpi-foot">At or below configured threshold</div></div>
          <div className="card"><div className="kpi-label">OUT OF STOCK</div><div className="kpi-value">{loadingStock ? '…' : outOfStockCount}</div><div className="kpi-foot">Active items with zero available quantity</div></div>
        </div>

        {stockError ? (
          <div role="alert" className="card space-y-3"><p>{stockError}</p><Button type="button" variant="outline" onClick={() => void loadStock()}>Retry stock</Button></div>
        ) : <FeedInventoryStockTable rows={stock} loading={loadingStock} error={stockError || undefined} onRetry={() => void loadStock()} />}

        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="section-title mb-0">Filter movement history</h2><Button type="button" variant="ghost" onClick={clearFilters} disabled={!from && !to && !feedItemId && !movementType}>Reset filters</Button></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="field min-w-0"><Label>Date range</Label><DateRangePicker from={from} to={to} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); setPage(0); }} /></div>
            <div className="field min-w-0"><Label htmlFor="inventory-feed-filter">Feed item</Label><Select value={feedItemId || 'all'} onValueChange={(value) => { setFeedItemId(value === 'all' ? '' : value); setPage(0); }}><SelectTrigger id="inventory-feed-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All feed items</SelectItem>{stock.map((row) => <SelectItem key={row.feed_item_id} value={row.feed_item_id}>{row.feed_item_name}</SelectItem>)}</SelectContent></Select></div>
            <div className="field min-w-0"><Label htmlFor="inventory-movement-filter">Movement type</Label><Select value={movementType || 'all'} onValueChange={(value) => { setMovementType(value === 'all' ? '' : value as FeedInventoryMovementType); setPage(0); }}><SelectTrigger id="inventory-movement-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All movement types</SelectItem>{FEED_INVENTORY_MOVEMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{movementLabel(type)}</SelectItem>)}</SelectContent></Select></div>
          </div>
        </div>
        <FeedInventoryMovementTable rows={movements} count={movementCount} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} loading={loadingMovements} error={movementError} onRetry={() => void loadMovements()} />
      </div>
    </AppShell>
  );
}
