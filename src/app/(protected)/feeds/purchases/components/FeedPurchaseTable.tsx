'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { FeedPurchaseListRow } from '@/lib/feed-purchase-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Props = {
  rows: FeedPurchaseListRow[];
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDelete: (purchaseId: string) => Promise<void>;
};

const money = (value: number | string) =>
  `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function FeedPurchaseTable({ rows, count, page, pageSize, onPageChange, onDelete }: Props) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedPurchaseListRow | null>(null);

  useEffect(() => {
    if (page >= pages) onPageChange(Math.max(0, pages - 1));
  }, [page, pages, onPageChange]);

  async function confirmDelete() {
    if (!deleteTarget || deletingId) return;

    setDeletingId(deleteTarget.id);
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="card">
      <div className="row">
        <h2 className="section-title">Purchase history</h2>
        <Badge variant="secondary">{count} records</Badge>
      </div>

      <div className="table-wrap">
        <Table className="[&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
          <TableHeader>
            <TableRow>
              <TableHead>DATE</TableHead>
              <TableHead>FEED</TableHead>
              <TableHead>VENDOR</TableHead>
              <TableHead>PURCHASE</TableHead>
              <TableHead>INVENTORY</TableHead>
              <TableHead>RATE</TableHead>
              <TableHead>TOTAL</TableHead>
              <TableHead>PAYMENT</TableHead>
              <TableHead>ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.business_date}</TableCell>
                <TableCell><b>{row.feed_item_name}</b></TableCell>
                <TableCell>{row.vendor_name ?? '—'}</TableCell>
                <TableCell>{Number(row.purchase_quantity).toLocaleString('en-IN')} {row.purchase_unit}</TableCell>
                <TableCell>{Number(row.base_quantity).toLocaleString('en-IN')} {row.base_unit}</TableCell>
                <TableCell>{money(row.rate_per_purchase_unit)} / {row.purchase_unit}</TableCell>
                <TableCell>{money(row.total_amount)}</TableCell>
                <TableCell>
                  <Badge variant={row.payment_status === 'PAID' ? 'secondary' : 'outline'}>
                    {row.payment_status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {row.can_edit_delete ? (
                    <div className="row" style={{ gap: 8 }}>
                      <Button asChild variant="outline" size="sm"><Link href={`/feeds/purchases/edit/${row.id}`}>Edit</Link></Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletingId === row.id}
                        onClick={() => setDeleteTarget(row)}
                      >
                        {deletingId === row.id ? 'Deleting…' : 'Delete'}
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="muted">Locked</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!rows.length && <div className="empty">No feed purchases recorded yet.</div>}

      {pages > 1 && (
        <div className="row" style={{ marginTop: 16 }}>
          <Button variant="outline" disabled={!page} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <span className="sub">Page {page + 1} of {pages}</span>
          <Button variant="outline" disabled={page >= pages - 1} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete feed purchase?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the purchase from the active archive and reverse its stock-in movement.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
            <div className="delete-summary">
              <span>Feed item</span>
              <b>{deleteTarget.feed_item_name}</b>
              <span>{Number(deleteTarget.purchase_quantity).toLocaleString('en-IN')} {deleteTarget.purchase_unit} · {money(deleteTarget.total_amount)}</span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)} onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild><Button type="button" variant="destructive" onClick={(event) => { event.preventDefault(); void confirmDelete(); }} disabled={Boolean(deletingId)}>
              {deletingId ? 'Deleting…' : 'Delete feed purchase'}
            </Button></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
