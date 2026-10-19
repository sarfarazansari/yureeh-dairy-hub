'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AppShell } from '@/components/layout/AppShell';
import { FeedInventoryStockTable } from '@/features/feed-inventory/components/FeedInventoryStockTable';
import { useFeedInventoryStockQuery } from '@/features/feed-inventory/feed-inventory.queries';

const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FeedInventoryPage() {
  const stockQuery = useFeedInventoryStockQuery();
  const stock = stockQuery.data ?? [];
  const loadingStock = stockQuery.isPending;
  const stockError = stockQuery.error?.message ?? '';
  const loadStock = () => void stockQuery.refetch();

  const totalValue = stock.reduce((sum, row) => sum + Number(row.stock_value), 0);
  const lowStockCount = stock.filter((row) => row.is_active && Number(row.quantity_on_hand) > 0 && Number(row.low_stock_threshold) > 0 && Number(row.quantity_on_hand) <= Number(row.low_stock_threshold)).length;
  const outOfStockCount = stock.filter((row) => row.is_active && Number(row.quantity_on_hand) <= 0).length;

  return (
    <AppShell title="Feed inventory" subtitle="Current stock levels, inventory value and low-stock alerts">
      <div className="management-stack">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="card"><div className="kpi-label">FEED ITEMS</div><div className="kpi-value">{loadingStock ? '…' : stock.length}</div><div className="kpi-foot">Includes items with no stock movements</div></div>
          <div className="card"><div className="kpi-label">CURRENT STOCK VALUE</div><div className="kpi-value">{loadingStock ? '…' : money(totalValue)}</div><div className="kpi-foot">Ledger-derived inventory value</div></div>
          <div className="card"><div className="kpi-label">LOW STOCK</div><div className="kpi-value">{loadingStock ? '…' : lowStockCount}</div><div className="kpi-foot">At or below configured threshold</div></div>
          <div className="card"><div className="kpi-label">OUT OF STOCK</div><div className="kpi-value">{loadingStock ? '…' : outOfStockCount}</div><div className="kpi-foot">Active items with zero available quantity</div></div>
        </div>

        {stockError ? (
          <div role="alert" className="card space-y-3"><p>{stockError}</p><Button type="button" variant="outline" onClick={() => void loadStock()}>Retry stock</Button></div>
        ) : <FeedInventoryStockTable rows={stock} loading={loadingStock} error={stockError || undefined} onRetry={() => void loadStock()} />}

      </div>
    </AppShell>
  );
}
