'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import type { DietPlanListRow } from '@/lib/diet-plan-types';
import { fetchDietPlans } from './services';

const PAGE_SIZE = 20;

export default function DietPlansPage() {
  const [rows, setRows] = useState<DietPlanListRow[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    try { setRows(await fetchDietPlans(supabase)); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : 'Could not load diet plans.', type: 'error' }); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = rows.filter((row) =>
    (!status || row.status === status) &&
    (!search.trim() || row.name.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <AppShell title="Diet plans" subtitle="Manage recurring feed quantities for buffalo groups">
      <div className="management-stack">
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />
        <div className="card">
          <div className="row">
            <h2 className="section-title">Diet plan archive</h2>
            <Link className="btn" href="/feeds/diet-plans/new">New diet plan</Link>
          </div>
          <div className="expense-form-grid">
            <div className="field"><label>Search plan</label><input value={search} placeholder="Plan name" onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></div>
            <div className="field"><label>Status</label><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="STOPPED">Stopped</option></select></div>
          </div>
        </div>
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>PLAN</th><th>PERIOD</th><th>BUFFALOES</th><th>FEEDS</th><th>STATUS</th><th>ACTION</th></tr></thead>
              <tbody>
                {visible.map((row) => <tr key={row.id}>
                  <td><b>{row.name}</b>{row.notes && <div className="sub">{row.notes}</div>}</td>
                  <td>{row.start_date} – {row.end_date ?? 'No end date'}</td>
                  <td>{row.buffalo_count}</td><td>{row.feed_count}</td>
                  <td><span className="tag">{row.status}</span></td>
                  <td><Link className="date-chip" href={`/feeds/diet-plans/edit/${row.id}`}>Edit</Link></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {!visible.length && <div className="empty">No diet plans found.</div>}
          {pages > 1 && <div className="row" style={{ marginTop: 16 }}><button className="date-chip" disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span className="sub">Page {page + 1} of {pages}</span><button className="date-chip" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button></div>}
        </div>
      </div>
    </AppShell>
  );
}
