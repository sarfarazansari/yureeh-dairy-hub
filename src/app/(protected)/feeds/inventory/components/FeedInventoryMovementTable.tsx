'use client';

import type { FeedInventoryMovementRow } from '../services';

type Props = {
  rows: FeedInventoryMovementRow[];
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

const money = (value: number | string | null) =>
  `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const movementLabel = (value: string) => value.replaceAll('_', ' ');

function movementSign(type: string) {
  return ['PURCHASE', 'ADJUSTMENT_IN'].includes(type) ? '+' : '−';
}

function sourceLabel(value: string | null) {
  if (!value) return 'Manual / unspecified';
  return value.replaceAll('_', ' ');
}

export function FeedInventoryMovementTable({ rows, count, page, pageSize, onPageChange }: Props) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  return (
    <div className="card">
      <div className="row">
        <h2 className="section-title">Movement history</h2>
        <span className="tag">{count} movements</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>DATE</th><th>FEED ITEM</th><th>MOVEMENT</th><th>QUANTITY</th><th>UNIT COST</th><th>VALUE</th><th>SOURCE</th><th>NOTES</th></tr></thead>
          <tbody>{rows.map((row) => {
            const incoming = movementSign(row.movement_type) === '+';
            return <tr key={row.id}>
              <td>{new Date(row.occurred_at).toLocaleDateString('en-IN')}</td>
              <td><b>{row.feed_item_name}</b><div className="sub">{row.base_unit}</div></td>
              <td><span className={`tag ${incoming ? '' : 'gold'}`}>{movementLabel(row.movement_type)}</span></td>
              <td><b>{movementSign(row.movement_type)}{Number(row.quantity).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {row.base_unit}</b></td>
              <td>{row.unit_cost === null ? '—' : money(row.unit_cost)}</td>
              <td>{money(Number(row.quantity) * Number(row.unit_cost ?? 0))}</td>
              <td><span>{sourceLabel(row.source_type)}</span>{row.source_id && <div className="sub">{row.source_id.slice(0, 8)}</div>}</td>
              <td>{row.notes || '—'}{row.reversal_of_movement_id && <div className="sub">Reversal of {row.reversal_of_movement_id.slice(0, 8)}</div>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {!rows.length && <div className="empty">No inventory movements match these filters.</div>}
      {pages > 1 && <div className="row" style={{ marginTop: 16 }}>
        <button className="date-chip" disabled={!page} onClick={() => onPageChange(page - 1)}>Previous</button>
        <span className="sub">Page {page + 1} of {pages}</span>
        <button className="date-chip" disabled={page >= pages - 1} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>}
    </div>
  );
}
