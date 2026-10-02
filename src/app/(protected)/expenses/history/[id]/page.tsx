'use client';
import { formatDate, formatDateTime } from '@/lib/date-format';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ExpenseShell, money } from '../../shared';
import type { ExpenseRow } from '@/lib/expense-types';
export default function ExpenseDetail({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState(''),
    [row, setRow] = useState<ExpenseRow | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    Promise.resolve(params).then((p) => {
      if (!alive) return;
      setId(p.id);
      supabase
        ?.from('expenses')
        .select('*')
        .eq('id', p.id)
        .is('deleted_at', null)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) setError(error.message);
          setRow(data);
        });
    });
    return () => {
      alive = false;
    };
  }, [params]);
  const fields: [string, string | null | undefined][] = [
    ['Date', row?.business_date ? formatDate(row.business_date) : null],
    ['Category', row?.category_name_snapshot],
    ['Group', row?.category_group_snapshot?.replaceAll('_', ' ')],
    ['Vendor', row?.vendor_name_snapshot],
    ['Description', row?.description],
    ['Quantity', row?.quantity == null ? null : `${row.quantity} ${row.unit ?? ''}`],
    ['Rate', row?.rate == null ? null : money(Number(row.rate))],
    ['Total amount', row ? money(Number(row.total_amount)) : null],
    ['Paid amount', row ? money(Number(row.paid_amount)) : null],
    ['Pending amount', row ? money(Number(row.pending_amount)) : null],
    ['Payment status', row?.payment_status],
    ['Payment method', row?.payment_method],
    ['Due date', row?.due_date ? formatDate(row.due_date) : null],
    ['Buffalo', row?.buffalo_code_snapshot],
    ['Receipt / reference', row?.receipt_reference],
    ['Notes', row?.notes],
    ['Created at', row?.created_at ? formatDateTime(row.created_at) : null],
  ];
  return (
    <ExpenseShell
      title="Expense detail"
      subtitle="Original category, vendor and buffalo names are retained"
    >
      <Link href="/expenses/history" style={{ fontSize: 12, color: '#277452' }}>
        ← Expense history
      </Link>
      {error && <p className="auth-message">{error}</p>}
      {row ? (
        <div className="card detail-grid">
          {fields.map(([label, value]) => (
            <div className="detail-item" key={label}>
              <span className="kpi-label">{label}</span>
              <b>{value || '—'}</b>
            </div>
          ))}
        </div>
      ) : (
        !error && <div className="empty">Loading expense {id}…</div>
      )}
    </ExpenseShell>
  );
}
