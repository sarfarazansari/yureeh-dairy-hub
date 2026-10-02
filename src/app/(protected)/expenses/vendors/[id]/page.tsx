'use client';
import { formatDate } from '@/lib/date-format';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExpenseShell, money } from '../../shared';
import { KPI } from '@/components/ui/KPI';
import type { ExpenseRow, ExpenseVendor } from '@/lib/expense-types';
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
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>CATEGORY</th>
                <th>DESCRIPTION</th>
                <th>TOTAL</th>
                <th>PAID</th>
                <th>PENDING</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.business_date)}</td>
                  <td>{r.category_name_snapshot}</td>
                  <td>{r.description ?? '—'}</td>
                  <td>{money(Number(r.total_amount))}</td>
                  <td>{money(Number(r.paid_amount))}</td>
                  <td>{money(Number(r.pending_amount))}</td>
                  <td>{r.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <div className="empty">No expenses recorded for this vendor.</div>}
      </div>
    </ExpenseShell>
  );
}
