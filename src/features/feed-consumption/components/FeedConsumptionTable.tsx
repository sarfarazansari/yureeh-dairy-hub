'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { FeedConsumptionListRow } from '@/lib/feed-consumption-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Props = {
  rows: FeedConsumptionListRow[];
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};
const money = (value: number | string | null) => `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FeedConsumptionTable({ rows, count, page, pageSize, onPageChange, onDelete, loading = false, error, onRetry }: Props) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedConsumptionListRow | null>(null);
  useEffect(() => { if (page >= pages) onPageChange(Math.max(0, pages - 1)); }, [page, pages, onPageChange]);
  async function confirmDelete() {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id);
    try { await onDelete(deleteTarget.id); setDeleteTarget(null); }
    finally { setDeletingId(null); }
  }
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="section-title mb-0">Consumption history</h2><Badge variant="secondary">{count} records</Badge></div>
      {error ? <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm"><p>{error}</p>{onRetry && <Button className="mt-3" type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>}</div> : <>
        <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]" aria-busy={loading}>
          <Table className="min-w-[700px] [&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
            <TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>FEED</TableHead><TableHead>QUANTITY</TableHead><TableHead>COST / UNIT</TableHead><TableHead>TOTAL COST</TableHead><TableHead>ACTION</TableHead></TableRow></TableHeader>
            <TableBody>{loading ? Array.from({ length: 5 }, (_, i) => <TableRow key={i}>{Array.from({ length: 6 }, (_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : rows.map((row) => <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap">{new Date(row.occurred_at).toLocaleDateString('en-IN')}</TableCell><TableCell><b>{row.feed_item_name}</b></TableCell><TableCell>{Number(row.quantity).toLocaleString('en-IN')} {row.base_unit}</TableCell><TableCell>{money(row.unit_cost)} / {row.base_unit}</TableCell><TableCell>{money(Number(row.quantity) * Number(row.unit_cost ?? 0))}</TableCell>
              <TableCell>{row.can_edit_delete ? <Link className="inline-flex rounded-md border px-3 py-1.5 text-sm" href={`/feeds/consumption/edit/${row.id}`}>Edit</Link> : <Badge variant="muted">Locked</Badge>}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
        {!loading && !rows.length && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{count ? 'No consumption records on this page.' : 'No feed consumption matches these filters.'}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"><p className="text-sm text-muted-foreground">Showing {count ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, count)} of {count}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={loading || page <= 0} onClick={() => onPageChange(page - 1)}>Previous</Button><span className="min-w-24 text-center text-sm text-muted-foreground">Page {page + 1} of {pages}</span><Button variant="outline" size="sm" disabled={loading || page >= pages - 1} onClick={() => onPageChange(page + 1)}>Next</Button></div></div>
      </>}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete feed consumption?</AlertDialogTitle><AlertDialogDescription>This will reverse the consumption movement and restore the stock.</AlertDialogDescription></AlertDialogHeader>
          {deleteTarget && <div className="delete-summary"><span>Feed item</span><b>{deleteTarget.feed_item_name}</b><span>{Number(deleteTarget.quantity).toLocaleString('en-IN')} {deleteTarget.base_unit} · {money(Number(deleteTarget.quantity) * Number(deleteTarget.unit_cost ?? 0))}</span></div>}
          <AlertDialogFooter><AlertDialogCancel disabled={Boolean(deletingId)} onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel><Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={Boolean(deletingId)}>{deletingId ? 'Deleting…' : 'Delete feed consumption'}</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
