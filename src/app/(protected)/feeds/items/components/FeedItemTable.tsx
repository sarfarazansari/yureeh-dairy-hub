'use client';

import type { FeedItem } from '@/lib/feed-types';

type Props = {
  rows: FeedItem[];
  activeCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  onEdit: (row: FeedItem) => void;
  onToggle: (row: FeedItem) => Promise<void>;
};

const label = (value: string) => value.replaceAll('_', ' ');

export function FeedItemTable({ rows, activeCount, search, onSearchChange, onEdit, onToggle }: Props) {
  return (
    <div className="card">
      <div className="row"><h2 className="section-title">Feed master</h2><span className="tag">{activeCount} active</span></div>
      <div className="field" style={{ marginBottom: 16 }}><label>Search</label><input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search feed item" /></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>NAME</th><th>CATEGORY</th><th>BASE UNIT</th><th>PURCHASE UNIT</th><th>CONVERSION</th><th>STATUS</th><th></th></tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.id}>
              <td><b>{row.name}</b></td><td>{label(row.category)}</td><td>{row.base_unit}</td><td>{row.purchase_unit}</td>
              <td>1 {row.purchase_unit} = {row.purchase_unit_quantity} {row.base_unit}</td>
              <td><span className={'tag ' + (row.is_active ? '' : 'gold')}>{row.is_active ? 'Active' : 'Inactive'}</span></td>
              <td><button type="button" className="date-chip" onClick={() => onEdit(row)}>Edit</button>{' '}<button type="button" className="date-chip" onClick={() => void onToggle(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {!rows.length && <div className="empty">No feed items found.</div>}
      <p className="kpi-foot">Feed items are physical inventory masters. Expenses remain a separate accounting record.</p>
    </div>
  );
}
