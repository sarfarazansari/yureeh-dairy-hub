'use client';
import { formatDate } from '@/lib/date-format';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBuffaloSalesArchive } from '@/features/buffaloes/hooks/use-buffaloes';
import { money } from '@/lib/farm-format';
import { useIsViewer } from '@/lib/farm-access';

const PAGE_SIZE = 20;
function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export default function BuffaloSalesPage() {
  const isViewer = useIsViewer();
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
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="section-title">Sale archive</h2><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href="/buffaloes">Open herd overview</Link></Button>{!isViewer && <Button asChild><Link href="/buffalo-sales/new">New sale</Link></Button>}</div></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field"><Label htmlFor="buffalo-sales-search">Search buyer</Label><Input id="buffalo-sales-search" value={search} placeholder="Buyer name or mobile" onChange={(event) => setSearch(event.target.value)} /></div>
            <div className="field"><Label>Date range</Label><DateRangePicker from={from} to={to} max={todayKey()} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); setPage(0); }} /></div>
          </div>
        </div>
        <div className="card space-y-4">
          {query.isError ? <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm"><p>{query.error.message}</p><Button className="mt-3" type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>Retry</Button></div> : <>
            <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]" aria-busy={query.isFetching}>
              <Table className="min-w-[850px] [&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
                <TableHeader><TableRow><TableHead>SALE DATE</TableHead><TableHead>BUFFALO</TableHead><TableHead>BUYER</TableHead><TableHead>SALE PRICE</TableHead><TableHead>RECEIVED</TableHead><TableHead>OUTSTANDING</TableHead><TableHead>STATUS</TableHead><TableHead>ACTION</TableHead></TableRow></TableHeader>
                <TableBody>
                  {query.isPending ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>{Array.from({ length: 8 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : rows.map((row) => {
                    const buffalo = row.buffaloes as { buffalo_code: string; name: string | null } | null;
                    return <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(row.sale_date)}</TableCell>
                      <TableCell><b>{buffalo?.name || buffalo?.buffalo_code || 'Buffalo'}</b><div className="text-xs text-muted-foreground">{buffalo?.buffalo_code}</div></TableCell>
                      <TableCell>{row.buyer_name}</TableCell><TableCell>{money(Number(row.sale_price))}</TableCell><TableCell>{money(Number(row.amount_received))}</TableCell><TableCell>{money(Number(row.amount_pending))}</TableCell>
                      <TableCell><Badge variant={row.payment_status === 'PAID' ? 'secondary' : 'outline'}>{row.payment_status}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="outline" asChild><Link href={`/buffaloes/${row.buffalo_id}`}>Details</Link></Button></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </div>
            {!query.isPending && !rows.length && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No buffalo sales found for these filters.</div>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
              <p className="text-sm text-muted-foreground">Showing {count ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, count)} of {count} sales</p>
              <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 0 || query.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</Button><span className="min-w-24 text-center text-sm text-muted-foreground">Page {page + 1} of {pages}</span><Button variant="outline" size="sm" disabled={page >= pages - 1 || query.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
            </div>
          </>}
        </div>
      </div>
    </AppShell>
  );
}
