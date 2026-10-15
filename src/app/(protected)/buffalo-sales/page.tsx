'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { useBuffaloSalesArchive } from '@/features/buffaloes/hooks/use-buffaloes';
import { money } from '@/lib/farm-format';

const PAGE_SIZE = 20;
function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export default function BuffaloSalesPage() {
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearchQuery(search.trim()); setPage(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const query = useBuffaloSalesArchive(page, PAGE_SIZE, { from, to, search: searchQuery });
  const rows = query.data?.rows ?? [];
  const count = query.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <AppShell title="Buffalo sales" subtitle="Sale transactions, buyer details and outstanding proceeds">
      <div className="management-stack">
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-title">Sale archive</h2><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href="/buffaloes">Open herd overview</Link></Button><Button asChild><Link href="/buffalo-sales/new">New sale</Link></Button></div></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field"><Label>Search buyer</Label><Input value={search} placeholder="Buyer name or mobile" onChange={(event) => setSearch(event.target.value)} /></div>
            <div className="field"><Label>Date range</Label><DateRangePicker from={from} to={to} max={todayKey()} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); setPage(0); }} /></div>
          </div>
        </div>
        <div className="card">
          {query.isPending ? <div className="empty">Loading sales…</div> : query.isError ? <div role="alert" className="empty">{query.error.message}</div> : rows.length ? (
            <div className="table-wrap"><table className="table"><thead><tr><th>SALE DATE</th><th>BUFFALO</th><th>BUYER</th><th>SALE PRICE</th><th>RECEIVED</th><th>OUTSTANDING</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
              {rows.map((row) => { const buffalo = row.buffaloes as { buffalo_code: string; name: string | null } | null; return <tr key={row.id}>
                <td>{row.sale_date}</td><td><b>{buffalo?.name || buffalo?.buffalo_code || 'Buffalo'}</b><div className="sub">{buffalo?.buffalo_code}</div></td><td>{row.buyer_name}</td><td>{money(Number(row.sale_price))}</td><td>{money(Number(row.amount_received))}</td><td>{money(Number(row.amount_pending))}</td><td><span className={`tag ${row.payment_status === 'PAID' ? '' : 'gold'}`}>{row.payment_status}</span></td><td><Button size="sm" variant="outline" asChild><Link href={`/buffaloes/${row.buffalo_id}`}>Details</Link></Button></td>
              </tr>; })}
            </tbody></table></div>
          ) : <div className="empty">No buffalo sales found for these filters.</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <Button variant="outline" disabled={page === 0 || query.isPending} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <span className="sub">Page {page + 1} of {pages} · {count} sales</span>
            <Button variant="outline" disabled={page >= pages - 1 || query.isPending} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
