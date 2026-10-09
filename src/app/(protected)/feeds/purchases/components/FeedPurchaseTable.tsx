'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Dialog } from '@/app/dialog';
import type { FeedPurchaseListRow } from '@/lib/feed-purchase-types';

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
        <span className="tag">{count} records</span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>DATE</th>
              <th>FEED</th>
              <th>VENDOR</th>
              <th>PURCHASE</th>
              <th>INVENTORY</th>
              <th>RATE</th>
              <th>TOTAL</th>
              <th>PAYMENT</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.business_date}</td>
                <td><b>{row.feed_item_name}</b></td>
                <td>{row.vendor_name ?? '—'}</td>
                <td>{Number(row.purchase_quantity).toLocaleString('en-IN')} {row.purchase_unit}</td>
                <td>{Number(row.base_quantity).toLocaleString('en-IN')} {row.base_unit}</td>
                <td>{money(row.rate_per_purchase_unit)} / {row.purchase_unit}</td>
                <td>{money(row.total_amount)}</td>
                <td>
                  <span className={'tag ' + (row.payment_status === 'PAID' ? '' : 'gold')}>
                    {row.payment_status}
                  </span>
                </td>
                <td>
                  {row.can_edit_delete ? (
                    <div className="row" style={{ gap: 8 }}>
                      <Link className="date-chip" href={`/feeds/purchases/edit/${row.id}`}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="date-chip"
                        disabled={deletingId === row.id}
                        onClick={() => setDeleteTarget(row)}
                      >
                        {deletingId === row.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <span className="tag">🔒 Locked</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!rows.length && <div className="empty">No feed purchases recorded yet.</div>}

      {pages > 1 && (
        <div className="row" style={{ marginTop: 16 }}>
          <button className="date-chip" disabled={!page} onClick={() => onPageChange(page - 1)}>
            Previous
          </button>
          <span className="sub">Page {page + 1} of {pages}</span>
          <button className="date-chip" disabled={page >= pages - 1} onClick={() => onPageChange(page + 1)}>
            Next
          </button>
        </div>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteTarget(null);
        }}
        labelledBy="feed-purchase-delete-title"
        className="delete-dialog"
      >
        <div className="dialog-header">
          <div>
            <p className="eyebrow">FEED PURCHASE</p>
            <h2 id="feed-purchase-delete-title" className="dialog-title">Delete purchase?</h2>
            <p className="dialog-description">
              This will remove the purchase from the active archive and reverse its stock-in movement.
            </p>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={() => setDeleteTarget(null)}
            disabled={Boolean(deletingId)}
            aria-label="Close delete dialog"
          >
            ×
          </button>
        </div>

        {deleteTarget && (
          <div className="delete-summary">
            <span>Feed item</span>
            <b>{deleteTarget.feed_item_name}</b>
            <span>
              {Number(deleteTarget.purchase_quantity).toLocaleString('en-IN')} {deleteTarget.purchase_unit}
              {' · '}
              {money(deleteTarget.total_amount)}
            </span>
          </div>
        )}

        <div className="dialog-footer">
          <button
            type="button"
            className="btn secondary"
            onClick={() => setDeleteTarget(null)}
            disabled={Boolean(deletingId)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn destructive"
            onClick={() => void confirmDelete()}
            disabled={Boolean(deletingId)}
          >
            {deletingId ? 'Deleting…' : 'Delete purchase'}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
