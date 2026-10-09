'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { money } from '@/lib/farm-format';
import { useBuffaloSalesArchive } from '@/features/buffaloes/hooks/use-buffaloes';

const PAGE_SIZE = 20;

export default function BuffaloSalesPage() {
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(search.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useBuffaloSalesArchive(page, PAGE_SIZE, { from, to, search: searchQuery });
  const rows = query.data?.rows ?? [];
  const count = query.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <AppShell title="Buffalo sales" subtitle="Sale transactions, buyer details and outstanding proceeds">
      <div className="management-stack">
        <div className="card">
          <div className="row">
            <h2 className="section-title">Sale archive</h2>
            <Link className="date-chip" href="/buffaloes">Open herd overview</Link>
          </div>
          <div className="expense-form-grid">
            <div className="field"><label>Search buyer</label><input value={search} placeholder="Buyer name or mobile" onChange={(e) => setSearch(e.target.value)} /></div>
            <div className="field"><label>From date</label><input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(0); }} /></div>
            <div className="field"><label>To date</label><input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(0); }} /></div>
          </div>
        </div>
        <div className="card">
          {query.isPending ? <div className="empty">Loading sales…</div> : query.isError ? <div className="empty">{query.error.message}</div> : rows.length ? (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>SALE DATE</th><th>BUFFALO</th><th>BUYER</th><th>SALE PRICE</th><th>RECEIVED</th><th>OUTSTANDING</th><th>STATUS</th><th>ACTION</th></tr></thead>
              <tbody>{rows.map((row) => {
                const buffalo = row.buffaloes as { buffalo_code: string; name: string | null } | null;
                return <tr key={row.id}>
                  <td>{row.sale_date}</td>
                  <td><b>{buffalo?.name || buffalo?.buffalo_code || 'Buffalo'}</b><div className="sub">{buffalo?.buffalo_code}</div></td>
                  <td>{row.buyer_name}</td>
                  <td>{money(Number(row.sale_price))}</td>
                  <td>{money(Number(row.amount_received))}</td>
                  <td>{money(Number(row.amount_pending))}</td>
                  <td><span className={`tag ${row.payment_status === 'PAID' ? '' : 'gold'}`}>{row.payment_status}</span></td>
                  <td><Link className="date-chip" href={`/buffaloes/${row.buffalo_id}`}>Details</Link></td>
                </tr>;
              })}</tbody>
            </table></div>
          ) : <div className="empty">No buffalo sales found for these filters.</div>}
          <div className="row" style={{ marginTop: 16 }}>
            <button className="date-chip" disabled={page === 0 || query.isPending} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span className="sub">Page {page + 1} of {pages} · {count} sales</span>
            <button className="date-chip" disabled={page >= pages - 1 || query.isPending} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
