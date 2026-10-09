'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Dialog } from '@/app/dialog';
import type { FeedConsumptionListRow } from '@/lib/feed-consumption-types';

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
        <span className="tag">{count} records</span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>DATE</th><th>FEED</th><th>QUANTITY</th><th>COST / UNIT</th><th>TOTAL COST</th><th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.occurred_at).toLocaleDateString('en-IN')}</td>
                <td><b>{row.feed_item_name}</b></td>
                <td>{Number(row.quantity).toLocaleString('en-IN')} {row.base_unit}</td>
                <td>{money(row.unit_cost)} / {row.base_unit}</td>
                <td>{money(Number(row.quantity) * Number(row.unit_cost ?? 0))}</td>
                <td>
                  {row.can_edit_delete ? (
                    <Link className="date-chip" href={`/feeds/consumption/edit/${row.id}`}>Edit</Link>
                  ) : (
                    <span className="tag">🔒 Locked</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!rows.length && <div className="empty">No feed consumption recorded yet.</div>}

      {pages > 1 && (
        <div className="row" style={{ marginTop: 16 }}>
          <button className="date-chip" disabled={!page} onClick={() => onPageChange(page - 1)}>Previous</button>
          <span className="sub">Page {page + 1} of {pages}</span>
          <button className="date-chip" disabled={page >= pages - 1} onClick={() => onPageChange(page + 1)}>Next</button>
        </div>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null); }}
        labelledBy="feed-consumption-delete-title"
        className="delete-dialog"
      >
        <div className="dialog-header">
          <div>
            <p className="eyebrow">FEED CONSUMPTION</p>
            <h2 id="feed-consumption-delete-title" className="dialog-title">Delete consumption?</h2>
            <p className="dialog-description">This will reverse the consumption movement and restore the stock.</p>
          </div>
          <button type="button" className="dialog-close" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingId)} aria-label="Close delete dialog">×</button>
        </div>
        {deleteTarget && (
          <div className="delete-summary">
            <span>Feed item</span><b>{deleteTarget.feed_item_name}</b>
            <span>{Number(deleteTarget.quantity).toLocaleString('en-IN')} {deleteTarget.base_unit} · {money(Number(deleteTarget.quantity) * Number(deleteTarget.unit_cost ?? 0))}</span>
          </div>
        )}
        <div className="dialog-footer">
          <button type="button" className="btn secondary" onClick={() => setDeleteTarget(null)} disabled={Boolean(deletingId)}>Cancel</button>
          <button type="button" className="btn destructive" onClick={() => void confirmDelete()} disabled={Boolean(deletingId)}>
            {deletingId ? 'Deleting…' : 'Delete consumption'}
          </button>
        </div>
      </Dialog>
    </div>
  );
}