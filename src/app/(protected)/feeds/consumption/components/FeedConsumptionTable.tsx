'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import type { FeedConsumptionListRow } from '@/lib/feed-consumption-types';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Props = {
  rows: FeedConsumptionListRow[];
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDelete: (id: string) => Promise<void>;
};

const money = (value: number | string | null) =>
  `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FeedConsumptionTable({ rows, count, page, pageSize, onPageChange, onDelete }: Props) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedConsumptionListRow | null>(null);

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
        <h2 className="section-title">Consumption history</h2>
        <Badge variant="secondary">{count} records</Badge>
      </div>

      <div className="table-wrap">
        <Table className="[&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
          <TableHeader>
            <TableRow>
              <TableHead>DATE</TableHead><TableHead>FEED</TableHead><TableHead>QUANTITY</TableHead><TableHead>COST / UNIT</TableHead><TableHead>TOTAL COST</TableHead><TableHead>ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <tr key={row.id}>
                <TableCell>{new Date(row.occurred_at).toLocaleDateString('en-IN')}</TableCell>
                <TableCell><b>{row.feed_item_name}</b></TableCell>
                <TableCell>{Number(row.quantity).toLocaleString('en-IN')} {row.base_unit}</TableCell>
                <TableCell>{money(row.unit_cost)} / {row.base_unit}</TableCell>
                <TableCell>{money(Number(row.quantity) * Number(row.unit_cost ?? 0))}</TableCell>
                <TableCell>
                  {row.can_edit_delete ? (
                    <Link className="date-chip" href={`/feeds/consumption/edit/${row.id}`}>Edit</Link>
                  ) : (
                    <Badge variant="muted">Locked</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!rows.length && <div className="empty">No feed consumption recorded yet.</div>}

      {pages > 1 && (
        <div className="row" style={{ marginTop: 16 }}>
          <button className="date-chip" disabled={!page} onClick={() => onPageChange(page - 1)}>Previous</button>
          <span className="sub">Page {page + 1} of {pages}</span>
          <button className="date-chip" disabled={page >= pages - 1} onClick={() => onPageChange(page + 1)}>Next</button>
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete feed consumption?</AlertDialogTitle>
            <AlertDialogDescription>This will reverse the consumption movement and restore the stock.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
            <div className="delete-summary">
              <span>Feed item</span>
              <b>{deleteTarget.feed_item_name}</b>
              <span>{Number(deleteTarget.quantity).toLocaleString('en-IN')} {deleteTarget.base_unit} · {money(Number(deleteTarget.quantity) * Number(deleteTarget.unit_cost ?? 0))}</span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)} onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <button type="button" className="btn destructive" onClick={() => void confirmDelete()} disabled={Boolean(deletingId)}>
              {deletingId ? 'Deleting…' : 'Delete feed consumption'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}