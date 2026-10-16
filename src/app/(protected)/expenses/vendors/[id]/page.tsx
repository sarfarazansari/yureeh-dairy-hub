'use client';
import { formatDate } from '@/lib/date-format';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExpenseShell } from '@/features/expenses/components/ExpenseNavigationShell';
import { money } from '@/features/expenses/utils/expense-format';
import { KPI } from '@/components/ui/KPI';
import type { ExpenseRow, ExpenseVendor } from '@/lib/expense-types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function ExpenseVendorDetail({ params }: { params: Promise<{ id: string }> }) {
  const [vendor, setVendor] = useState<ExpenseVendor | null>(null),
    [rows, setRows] = useState<ExpenseRow[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    Promise.resolve(params).then(async ({ id }) => {
      if (!supabase) return;
      const [v, e] = await Promise.all([
        supabase.from('expense_vendors').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('expenses')
          .select('*')
          .eq('vendor_id', id)
          .is('deleted_at', null)
          .order('business_date', { ascending: false }),
      ]);
      if (v.error || e.error) setError((v.error ?? e.error)!.message);
      setVendor(v.data);
      setRows(e.data ?? []);
    });
  }, [params]);
  const total = rows.reduce((s, r) => s + Number(r.total_amount), 0),
    paid = rows.reduce((s, r) => s + Number(r.paid_amount), 0),
    pending = rows.reduce((s, r) => s + Number(r.pending_amount), 0);
  return (
    <ExpenseShell
      title={vendor?.name ?? 'Vendor detail'}
      subtitle={`${vendor?.city ?? 'Supplier'}${vendor?.mobile ? ` · ${vendor.mobile}` : ''}`}
    >
      <Link href="/expenses/vendors" style={{ fontSize: 12, color: '#277452' }}>
        ← All vendors
      </Link>
      {error && <p className="auth-message">{error}</p>}
      <div className="grid kpis">
        <KPI label="TOTAL EXPENSES" value={money(total)} foot={`${rows.length} purchases`} />
        <KPI label="PAID" value={money(paid)} foot="Paid to this vendor" />
        <KPI label="OUTSTANDING" value={money(pending)} foot="Open balances" accent />
        <KPI
          label="CONTACT"
          value={vendor?.mobile ?? '—'}
          foot={vendor?.address ?? vendor?.city ?? 'No address saved'}
        />
      </div>
      <div className="card">
        <h2 className="section-title">Expense history</h2>
        <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]"><Table className="min-w-[850px]"><TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>CATEGORY</TableHead><TableHead>DESCRIPTION</TableHead><TableHead>TOTAL</TableHead><TableHead>PAID</TableHead><TableHead>PENDING</TableHead><TableHead>STATUS</TableHead></TableRow></TableHeader><TableBody>
          {rows.map((r) => <TableRow key={r.id}><TableCell className="whitespace-nowrap">{formatDate(r.business_date)}</TableCell><TableCell>{r.category_name_snapshot}</TableCell><TableCell>{r.description ?? '—'}</TableCell><TableCell>{money(Number(r.total_amount))}</TableCell><TableCell>{money(Number(r.paid_amount))}</TableCell><TableCell>{money(Number(r.pending_amount))}</TableCell><TableCell><Badge variant={r.payment_status === 'PAID' ? 'secondary' : 'outline'}>{r.payment_status}</Badge></TableCell></TableRow>)}
        </TableBody></Table></div>
        {!rows.length && <div className="empty">No expenses recorded for this vendor.</div>}
      </div>
    </ExpenseShell>
  );
}
