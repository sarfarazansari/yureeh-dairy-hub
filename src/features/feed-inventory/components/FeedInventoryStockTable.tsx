'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { FeedInventoryStock } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Props = { rows: FeedInventoryStock[]; loading?: boolean; error?: string; onRetry?: () => void };

const money = (value: number | string | null) =>
  `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const label = (value: string) => value.replaceAll('_', ' ');

export function FeedInventoryStockTable({ rows, loading = false, error, onRetry }: Props) {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'INACTIVE'>('ALL');
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !term || `${row.feed_item_name} ${row.category} ${row.base_unit}`.toLowerCase().includes(term);
      const quantity = Number(row.quantity_on_hand);
      const matchesStock = stockFilter === 'ALL'
        || (stockFilter === 'LOW' && row.is_active && quantity > 0 && Number(row.low_stock_threshold) > 0 && quantity <= Number(row.low_stock_threshold))
        || (stockFilter === 'OUT' && row.is_active && quantity <= 0)
        || (stockFilter === 'INACTIVE' && !row.is_active);
      return matchesSearch && matchesStock;
    });
  }, [rows, search, stockFilter]);
  function status(row: FeedInventoryStock) {
    const quantity = Number(row.quantity_on_hand);
    if (!row.is_active) return { label: 'Inactive', variant: 'muted' as const };
    if (quantity <= 0) return { label: 'Out of stock', variant: 'destructive' as const };
    if (Number(row.low_stock_threshold) > 0 && quantity <= Number(row.low_stock_threshold)) return { label: 'Low stock', variant: 'outline' as const };
    return { label: 'In stock', variant: 'secondary' as const };
  }
  function resetFilters() { setSearch(''); setStockFilter('ALL'); }
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="section-title mb-0">Current stock</h2><Badge variant="secondary">{rows.length} feed items</Badge></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.6fr)_auto] sm:items-end">
        <div className="field min-w-0"><Label htmlFor="feed-stock-search">Search feed</Label><Input id="feed-stock-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, category or unit" /></div>
        <div className="field min-w-0"><Label htmlFor="feed-stock-filter">Stock status</Label><Select value={stockFilter} onValueChange={(value) => setStockFilter(value as typeof stockFilter)}><SelectTrigger id="feed-stock-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All items</SelectItem><SelectItem value="LOW">Low stock</SelectItem><SelectItem value="OUT">Out of stock</SelectItem><SelectItem value="INACTIVE">Inactive items</SelectItem></SelectContent></Select></div>
        <div className="flex gap-2"><Button type="button" variant="ghost" onClick={resetFilters} disabled={!search && stockFilter === 'ALL'}>Reset</Button><Button variant="outline" asChild><Link href="/feeds/items">Manage thresholds</Link></Button></div>
      </div>
      {error ? <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm"><p>{error}</p>{onRetry && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>Retry</Button>}</div> : <>
      <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]" aria-busy={loading}>
        <Table className="min-w-[850px] [&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
          <TableHeader><TableRow><TableHead>FEED ITEM</TableHead><TableHead>CATEGORY</TableHead><TableHead>ON HAND</TableHead><TableHead>LOW-STOCK AT</TableHead><TableHead>AVG. COST / UNIT</TableHead><TableHead>STOCK VALUE</TableHead><TableHead>STATUS</TableHead><TableHead>ACTION</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 4 }, (_, i) => <TableRow key={i}>{Array.from({ length: 8 }, (_, j) => <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>)}</TableRow>) : visible.map((row) => {
              const itemStatus = status(row);
              return <TableRow key={row.feed_item_id}>
                <TableCell><b>{row.feed_item_name}</b><div className="text-xs text-muted-foreground">{row.base_unit}</div></TableCell>
                <TableCell>{label(row.category)}</TableCell>
                <TableCell className="whitespace-nowrap"><b>{Number(row.quantity_on_hand).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {row.base_unit}</b></TableCell>
                <TableCell>{Number(row.low_stock_threshold).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {row.base_unit}</TableCell>
                <TableCell>{row.weighted_average_cost === null ? '—' : money(row.weighted_average_cost)}</TableCell>
                <TableCell>{money(row.stock_value)}</TableCell>
                <TableCell><Badge variant={itemStatus.variant}>{itemStatus.label}</Badge></TableCell>
                <TableCell><div className="flex gap-2"><Button variant="outline" size="sm" asChild><Link href="/feeds/purchases/new">Purchase</Link></Button><Button variant="outline" size="sm" asChild><Link href="/feeds/consumption/new">Consume</Link></Button></div></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </div>
      {!loading && !visible.length && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{search.trim() || stockFilter !== 'ALL' ? 'No feed items match these filters.' : 'No feed inventory items found.'}</div>}
      </>}
      <p className="text-xs text-muted-foreground">Stock quantities and values are calculated from the movement ledger. A threshold of 0 disables low-stock alerts; zero stock is always flagged.</p>
    </div>
  );
}
