'use client';
import { formatDate } from '@/lib/date-format';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { FeedPurchaseListRow } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Props = {
  rows: FeedPurchaseListRow[];
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onDelete: (purchaseId: string) => Promise<void>;
  readOnly?: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

const money = (value: number | string) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function FeedPurchaseTable({ rows, count, page, pageSize, onPageChange, onPageSizeChange, onDelete, readOnly = false, loading = false, error, onRetry }: Props) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedPurchaseListRow | null>(null);
  useEffect(() => { if (page >= pages) onPageChange(Math.max(0, pages - 1)); }, [page, pages, onPageChange]);
  async function confirmDelete() {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id);
    try { await onDelete(deleteTarget.id); setDeleteTarget(null); }
    finally { setDeletingId(null); }
  }
  const start = count ? page * pageSize + 1 : 0;
  const end = Math.min((page + 1) * pageSize, count);
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="section-title mb-0">Purchase history</h2><Badge variant="secondary">{count} records</Badge></div>
      {error ? <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm"><p>{error}</p>{onRetry && <Button className="mt-3" type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>}</div> : <>
        <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]" aria-busy={loading}>
          <Table className="feed-purchase-history-table min-w-[950px]">
            <TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>FEED</TableHead><TableHead>VENDOR</TableHead><TableHead>PURCHASE</TableHead><TableHead>INVENTORY</TableHead><TableHead>RATE</TableHead><TableHead>TOTAL</TableHead><TableHead>PAYMENT</TableHead>{!readOnly && <TableHead>ACTION</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 5 }, (_, i) => <TableRow key={i}>{Array.from({ length: 9 }, (_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : rows.map((row) => <TableRow key={row.id} className={!row.can_edit_delete ? "feed-purchase-row-locked" : undefined}>
                <TableCell className="whitespace-nowrap">{formatDate(row.business_date)}</TableCell><TableCell><b>{row.feed_item_name}</b></TableCell><TableCell>{row.vendor_name ?? '—'}</TableCell>
                <TableCell>{Number(row.purchase_quantity).toLocaleString('en-IN')} {row.purchase_unit}</TableCell><TableCell>{Number(row.base_quantity).toLocaleString('en-IN')} {row.base_unit}</TableCell><TableCell>{money(row.rate_per_purchase_unit)} / {row.purchase_unit}</TableCell><TableCell>{money(row.total_amount)}</TableCell>
                <TableCell><Badge variant={row.payment_status === 'PAID' ? 'secondary' : 'outline'}>{row.payment_status}</Badge></TableCell>
                {!readOnly && <TableCell>{row.can_edit_delete ? <div className="flex gap-2"><Button className="!text-[var(--ink)]" asChild variant="outline" size="sm"><Link href={`/feeds/purchases/edit/${row.id}`}>Edit</Link></Button><Button className="!text-[var(--ink)]" type="button" variant="outline" size="sm" disabled={deletingId === row.id} onClick={() => setDeleteTarget(row)}>{deletingId === row.id ? 'Deleting…' : 'Delete'}</Button></div> : <Badge variant="outline" className="feed-purchase-locked-badge" title="Later stock-out movements exist for this feed item, so editing or deleting this purchase is disabled.">Stock used · locked</Badge>}</TableCell>}
              </TableRow>)}
            </TableBody>
          </Table>
        </div>
        {!loading && !rows.length && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{count ? 'No purchases on this page.' : 'No feed purchases match these filters.'}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3"><p className="text-sm text-muted-foreground">Showing {start}–{end} of {count}</p><div className="flex flex-wrap items-center gap-2"><label className="text-sm text-muted-foreground" htmlFor="feed-purchase-page-size">Rows</label><Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}><SelectTrigger id="feed-purchase-page-size" className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="20">20 per page</SelectItem><SelectItem value="50">50 per page</SelectItem><SelectItem value="100">100 per page</SelectItem></SelectContent></Select><Button className="!text-[var(--ink)]" variant="outline" size="sm" disabled={loading || page <= 0} onClick={() => onPageChange(page - 1)}>Previous</Button><span className="min-w-24 text-center text-sm text-muted-foreground">Page {page + 1} of {pages}</span><Button className="!text-[var(--ink)]" variant="outline" size="sm" disabled={loading || page >= pages - 1} onClick={() => onPageChange(page + 1)}>Next</Button></div></div>
      </>}
      {!readOnly && <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete feed purchase?</AlertDialogTitle><AlertDialogDescription>This will remove the purchase from the active archive and reverse its stock-in movement.</AlertDialogDescription></AlertDialogHeader>
          {deleteTarget && <div className="delete-summary"><span>Feed item</span><b>{deleteTarget.feed_item_name}</b><span>{Number(deleteTarget.purchase_quantity).toLocaleString('en-IN')} {deleteTarget.purchase_unit} · {money(deleteTarget.total_amount)}</span></div>}
          <AlertDialogFooter><AlertDialogCancel disabled={Boolean(deletingId)} onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel><AlertDialogAction asChild><Button type="button" variant="destructive" onClick={(event) => { event.preventDefault(); void confirmDelete(); }} disabled={Boolean(deletingId)}>{deletingId ? 'Deleting…' : 'Delete feed purchase'}</Button></AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
