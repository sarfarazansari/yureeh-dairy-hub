'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { FeedInventoryStock } from '@/lib/feed-inventory-types';

type Props = { rows: FeedInventoryStock[] };

const money = (value: number | string | null) =>
  `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const label = (value: string) => value.replaceAll('_', ' ');

export function FeedInventoryStockTable({ rows }: Props) {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'INACTIVE'>('ALL');

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !term || `${row.feed_item_name} ${row.category} ${row.base_unit}`.toLowerCase().includes(term);
      const quantity = Number(row.quantity_on_hand);
      const matchesStock = stockFilter === 'ALL'
        || (stockFilter === 'LOW' && quantity > 0 && Number(row.low_stock_threshold) > 0 && quantity <= Number(row.low_stock_threshold))
        || (stockFilter === 'OUT' && quantity <= 0)
        || (stockFilter === 'INACTIVE' && !row.is_active);
      return matchesSearch && matchesStock;
    });
  }, [rows, search, stockFilter]);

  function status(row: FeedInventoryStock) {
    const quantity = Number(row.quantity_on_hand);
    if (!row.is_active) return { label: 'Inactive', className: 'tag gold' };
    if (quantity <= 0) return { label: 'Out of stock', className: 'tag status-overdue' };
    if (Number(row.low_stock_threshold) > 0 && quantity <= Number(row.low_stock_threshold)) return { label: 'Low stock', className: 'tag gold' };
    return { label: 'In stock', className: 'tag' };
  }

  return (
    <div className="card">
      <div className="row">
        <h2 className="section-title">Current stock</h2>
        <span className="tag">{rows.length} feed items</span>
      </div>
      <div className="expense-form-grid">
        <div className="field"><label>Search feed</label><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, category or unit" /></div>
        <div className="field"><label>Stock status</label><select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as typeof stockFilter)}><option value="ALL">All items</option><option value="LOW">Low stock</option><option value="OUT">Out of stock</option><option value="INACTIVE">Inactive items</option></select></div>
        <div className="field" style={{ alignSelf: 'end' }}><Link className="date-chip" href="/feeds/items">Manage feed thresholds</Link></div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>FEED ITEM</th><th>CATEGORY</th><th>ON HAND</th><th>LOW-STOCK AT</th><th>AVG. COST / UNIT</th><th>STOCK VALUE</th><th>STATUS</th><th>ACTION</th></tr></thead>
          <tbody>{visible.map((row) => {
            const itemStatus = status(row);
            return <tr key={row.feed_item_id}>
              <td><b>{row.feed_item_name}</b><div className="sub">{row.base_unit}</div></td>
              <td>{label(row.category)}</td>
              <td><b>{Number(row.quantity_on_hand).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {row.base_unit}</b></td>
              <td>{Number(row.low_stock_threshold).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {row.base_unit}</td>
              <td>{row.weighted_average_cost === null ? '—' : money(row.weighted_average_cost)}</td>
              <td>{money(row.stock_value)}</td>
              <td><span className={itemStatus.className}>{itemStatus.label}</span></td>
              <td><div className="row" style={{ justifyContent: 'flex-start', gap: 6 }}><Link className="date-chip" href="/feeds/purchases/new">Purchase</Link><Link className="date-chip" href="/feeds/consumption/new">Consume</Link></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {!visible.length && <div className="empty">No feed items match these filters.</div>}
      <p className="kpi-foot">Stock quantities and values are calculated from the movement ledger. A threshold of 0 disables low-stock alerts; zero stock is always flagged.</p>
    </div>
  );
}
