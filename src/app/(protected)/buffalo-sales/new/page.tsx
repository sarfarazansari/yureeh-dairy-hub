'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { BuffaloDispositionPanel } from '@/features/buffaloes/components/BuffaloDispositionPanel';
import { useBuffaloDetail, useBuffaloDirectory } from '@/features/buffaloes/hooks/use-buffaloes';

export default function NewBuffaloSalePage() {
  const [buffaloId, setBuffaloId] = useState('');
  const directory = useBuffaloDirectory();
  const detail = useBuffaloDetail(buffaloId);
  const eligibleBuffaloes = (directory.data ?? []).filter((buffalo) =>
    ['ACTIVE', 'DRY'].includes(buffalo.current_status),
  );

  return (
    <AppShell title="New buffalo sale" subtitle="Record a sale and track the buyer's outstanding balance">
      <div className="management-stack">
        <Link className="date-chip" href="/buffalo-sales">← Back to buffalo sales</Link>
        <div className="card">
          <div className="field">
            <label>Buffalo</label>
            <select value={buffaloId} onChange={(event) => setBuffaloId(event.target.value)}>
              <option value="">Select an active or dry buffalo</option>
              {eligibleBuffaloes.map((buffalo) => (
                <option key={buffalo.id} value={buffalo.id}>
                  {buffalo.buffalo_code}{buffalo.name ? ` — ${buffalo.name}` : ''} · {buffalo.current_status}
                </option>
              ))}
            </select>
          </div>
          {directory.isPending && <div className="empty">Loading eligible buffaloes…</div>}
          {directory.isError && <p className="auth-message">{directory.error.message}</p>}
          {!directory.isPending && !directory.isError && eligibleBuffaloes.length === 0 && (
            <div className="empty">No active or dry buffaloes are available to sell.</div>
          )}
        </div>
        {buffaloId && (
          detail.isPending ? <div className="empty">Loading buffalo details…</div> :
          detail.isError ? <div className="empty">{detail.error.message}</div> :
          detail.data ? <BuffaloDispositionPanel buffalo={detail.data} mode="sale" /> :
          <div className="empty">Buffalo not found.</div>
        )}
      </div>
    </AppShell>
  );
}
