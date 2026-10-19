'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { useDietPlanArchiveQuery } from '@/features/diet-plans/diet-plan.queries';

const DEFAULT_PAGE_SIZE = 20;

export default function DietPlansPage() {
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const archiveQuery = useDietPlanArchiveQuery({ page, pageSize, search: searchQuery, status });
  const rows = archiveQuery.data?.rows ?? [];
  const count = archiveQuery.data?.count ?? 0;
  const loading = archiveQuery.isPending;
  const loadError = archiveQuery.error?.message ?? '';
  const load = () => void archiveQuery.refetch();

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearchQuery(search.trim()); setPage(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const pages = Math.max(1, Math.ceil(count / pageSize));
  function resetFilters() {
    setSearch('');
    setSearchQuery('');
    setStatus('');
    setPage(0);
  }

  return (
    <AppShell title="Diet plans" subtitle="Manage recurring feed quantities for buffalo groups">
      <div className="management-stack">
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title mb-0">Diet plan archive</h2>
            <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href="/feeds/diet-plans/schedule">Feeding schedule</Link></Button><Button asChild><Link href="/feeds/diet-plans/new">New diet plan</Link></Button></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.45fr)_auto] sm:items-end">
            <div className="field min-w-0"><Label htmlFor="diet-plan-search">Search plan</Label><Input id="diet-plan-search" value={search} placeholder="Plan name" onChange={(event) => setSearch(event.target.value)} /></div>
            <div className="field min-w-0"><Label htmlFor="diet-plan-status">Status</Label><Select value={status || 'all'} onValueChange={(value) => { setStatus(value === 'all' ? '' : value); setPage(0); }}><SelectTrigger id="diet-plan-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="PAUSED">Paused</SelectItem><SelectItem value="STOPPED">Stopped</SelectItem></SelectContent></Select></div>
            <Button type="button" variant="ghost" onClick={resetFilters} disabled={!search && !status}>Reset filters</Button>
          </div>
        </div>
        <div className="card space-y-4">
          {loadError ? <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm"><p>{loadError}</p><Button className="mt-3" type="button" size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div> : <>
            <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]" aria-busy={loading}>
              <Table className="min-w-[700px] [&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
                <TableHeader><TableRow><TableHead>PLAN</TableHead><TableHead>PERIOD</TableHead><TableHead>BUFFALOES</TableHead><TableHead>FEEDS</TableHead><TableHead>STATUS</TableHead><TableHead>ACTION</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? Array.from({ length: 4 }, (_, i) => <TableRow key={i}>{Array.from({ length: 6 }, (_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : rows.map((row) => <TableRow key={row.id}>
                    <TableCell><b>{row.name}</b>{row.notes && <div className="text-xs text-muted-foreground">{row.notes}</div>}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(`${row.start_date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – {row.end_date ? new Date(`${row.end_date}T12:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No end date'}</TableCell>
                    <TableCell>{row.buffalo_count}</TableCell><TableCell>{row.feed_count}</TableCell>
                    <TableCell><Badge variant={row.status === 'ACTIVE' ? 'secondary' : 'outline'}>{row.status}</Badge></TableCell>
                    <TableCell><Button size="sm" variant="outline" asChild><Link href={`/feeds/diet-plans/edit/${row.id}`}>Edit</Link></Button></TableCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            </div>
            {!loading && !rows.length && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{search.trim() || status ? 'No diet plans match these filters.' : 'No diet plans found.'}</div>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
              <p className="text-sm text-muted-foreground">Showing {count ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, count)} of {count} plans</p>
              <div className="flex flex-wrap items-center gap-2"><label className="text-sm text-muted-foreground" htmlFor="diet-plan-page-size">Rows</label><Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(0); }}><SelectTrigger id="diet-plan-page-size" className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="20">20 per page</SelectItem><SelectItem value="50">50 per page</SelectItem><SelectItem value="100">100 per page</SelectItem></SelectContent><Button type="button" size="sm" variant="outline" disabled={loading || page <= 0} onClick={() => setPage(page - 1)}>Previous</Button><span className="min-w-24 text-center text-sm text-muted-foreground">Page {page + 1} of {pages}</span><Button type="button" size="sm" variant="outline" disabled={loading || page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button></div>
            </div>
          </>}
        </div>
      </div>
    </AppShell>
  );
}
