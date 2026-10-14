'use client';

import type { FeedItem } from '@/lib/feed-types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Props = {
  rows: FeedItem[];
  activeCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  onEdit: (row: FeedItem) => void;
  onToggle: (row: FeedItem) => Promise<void>;
  loading: boolean;
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
};

const label = (value: string) => value.replaceAll('_', ' ');

export function FeedItemTable({ rows, activeCount, search, onSearchChange, onEdit, onToggle, loading, page, pageSize, totalRows, onPageChange }: Props) {
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const start = totalRows ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, totalRows);

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title mb-0">Feed master</h2>
        <Badge variant="secondary">{activeCount} active</Badge>
      </div>
      <div className="max-w-sm space-y-1.5">
        <label htmlFor="feed-item-search" className="text-sm font-medium text-[var(--muted)]">Search feed items</label>
        <Input id="feed-item-search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search by name or category" />
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Base unit</TableHead><TableHead>Purchase unit</TableHead><TableHead>Conversion</TableHead><TableHead>Low stock at</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
        <TableBody>
          {loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>{Array.from({ length: 8 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-4 w-full max-w-28" /></TableCell>)}</TableRow>) : rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell><span className="font-semibold text-[var(--ink)]">{row.name}</span></TableCell>
              <TableCell>{label(row.category)}</TableCell><TableCell>{row.base_unit}</TableCell><TableCell>{row.purchase_unit}</TableCell>
              <TableCell>1 {row.purchase_unit} = {row.purchase_unit_quantity} {row.base_unit}</TableCell><TableCell>{Number(row.low_stock_threshold).toLocaleString('en-IN')} {row.base_unit}</TableCell>
              <TableCell><Badge variant={row.is_active ? 'secondary' : 'muted'}>{row.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
              <TableCell><div className="flex justify-end gap-2"><button type="button" className="date-chip" onClick={() => onEdit(row)}>Edit</button><button type="button" className="date-chip" onClick={() => void onToggle(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</button></div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!loading && !rows.length && <div className="empty">{search.trim() ? 'No feed items match your search.' : 'No feed items found.'}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
        <p className="text-sm text-[var(--muted)]">Showing {start}–{end} of {totalRows} feed items</p>
        <div className="flex items-center gap-2">
          <button type="button" className="date-chip disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
          <span className="min-w-20 text-center text-sm text-[var(--muted)]">Page {page} of {pageCount}</span>
          <button type="button" className="date-chip disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || page >= pageCount} onClick={() => onPageChange(page + 1)}>Next</button>
        </div>
      </div>
      <p className="kpi-foot">Feed items are physical inventory masters. Expenses remain a separate accounting record.</p>
    </section>
  );
}
