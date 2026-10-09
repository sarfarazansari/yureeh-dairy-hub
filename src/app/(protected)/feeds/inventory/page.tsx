'use client';

import { useCallback, useEffect, useState } from 'react';
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

const money = (value: number) =>
  `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadStock = useCallback(async () => {
    if (!supabase) {
      setLoadingStock(false);
      setToast({ message: 'Supabase is not configured.', type: 'error' });
      return;
    }
    setLoadingStock(true);
    try {
      setStock(await fetchFeedInventoryStock(supabase));
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not load inventory stock.', type: 'error' });
    } finally {
      setLoadingStock(false);
    }
  }, []);

  const loadMovements = useCallback(async () => {
    if (!supabase) {
      setLoadingMovements(false);
      return;
    }
    setLoadingMovements(true);
    try {
      const result = await fetchFeedInventoryMovements(supabase, page, PAGE_SIZE, {
        from, to, feedItemId, movementType,
      });
      setMovements(result.rows);
      setMovementCount(result.count);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not load inventory history.', type: 'error' });
    } finally {
      setLoadingMovements(false);
    }
  }, [page, from, to, feedItemId, movementType]);

  useEffect(() => { void loadStock(); }, [loadStock]);
  useEffect(() => { void loadMovements(); }, [loadMovements]);

  const totalValue = stock.reduce((sum, row) => sum + Number(row.stock_value), 0);
  const lowStockCount = stock.filter((row) =>
    row.is_active && Number(row.quantity_on_hand) > 0 &&
    Number(row.low_stock_threshold) > 0 &&
    Number(row.quantity_on_hand) <= Number(row.low_stock_threshold),
  ).length;
  const outOfStockCount = stock.filter((row) => row.is_active && Number(row.quantity_on_hand) <= 0).length;
  const pages = Math.max(1, Math.ceil(movementCount / PAGE_SIZE));

  function clearFilters() {
    setFrom('');
    setTo('');
    setFeedItemId('');
    setMovementType('');
    setPage(0);
  }

  return (
    <AppShell title="Feed inventory" subtitle="Current stock, stock value, low-stock alerts and the complete movement ledger">
      <div className="management-stack">
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />
        <div className="grid kpis">
          <div className="card"><div className="kpi-label">FEED ITEMS</div><div className="kpi-value">{loadingStock ? '…' : stock.length}</div><div className="kpi-foot">Includes items with no stock movements</div></div>
          <div className="card"><div className="kpi-label">CURRENT STOCK VALUE</div><div className="kpi-value">{loadingStock ? '…' : money(totalValue)}</div><div className="kpi-foot">Ledger-derived inventory value</div></div>
          <div className="card"><div className="kpi-label">LOW STOCK</div><div className="kpi-value">{loadingStock ? '…' : lowStockCount}</div><div className="kpi-foot">At or below configured threshold</div></div>
          <div className="card"><div className="kpi-label">OUT OF STOCK</div><div className="kpi-value">{loadingStock ? '…' : outOfStockCount}</div><div className="kpi-foot">Active items with zero available quantity</div></div>
        </div>

        {loadingStock && !stock.length ? <div className="card"><div className="empty">Loading current stock…</div></div> : <FeedInventoryStockTable rows={stock} />}

        <div className="card">
          <div className="row"><h2 className="section-title">Filter movement history</h2><button className="date-chip" type="button" onClick={clearFilters}>Clear filters</button></div>
          <div className="expense-form-grid">
            <div className="field"><label>From date</label><input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(0); }} /></div>
            <div className="field"><label>To date</label><input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(0); }} /></div>
            <div className="field"><label>Feed item</label><select value={feedItemId} onChange={(event) => { setFeedItemId(event.target.value); setPage(0); }}><option value="">All feed items</option>{stock.map((row) => <option key={row.feed_item_id} value={row.feed_item_id}>{row.feed_item_name}</option>)}</select></div>
            <div className="field"><label>Movement type</label><select value={movementType} onChange={(event) => { setMovementType(event.target.value as '' | FeedInventoryMovementType); setPage(0); }}><option value="">All movement types</option>{FEED_INVENTORY_MOVEMENT_TYPES.map((type) => <option key={type} value={type}>{movementLabel(type)}</option>)}</select></div>
          </div>
        </div>

        {loadingMovements && !movements.length ? <div className="card"><div className="empty">Loading movement history…</div></div> : <FeedInventoryMovementTable rows={movements} count={movementCount} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />}
        {loadingMovements && movements.length > 0 && <p className="kpi-foot">Updating movement history…</p>}
        {pages > 1 && <p className="kpi-foot">Showing page {page + 1} of {pages}. Movement history is paginated on the server.</p>}
      </div>
    </AppShell>
  );
}
