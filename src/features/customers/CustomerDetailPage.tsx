'use client';

import { money, milkTxt } from '@/lib/farm-format';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { KPI } from '@/components/ui/KPI';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate } from '@/lib/date-format';
import {
  getCustomerDetails,
  type CustomerEntry,
  type CustomerSummary,
} from './services/customer.service';
export default function CustomerDetailPage({ id }: { id: string }) {
  const [c, setC] = useState<CustomerSummary | null>(null),
    [rows, setRows] = useState<CustomerEntry[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    async function load() {
      if (!supabase) return;
      try {
        const details = await getCustomerDetails(supabase, id);
        setC(details.customer);
        setRows(details.entries);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Could not load customer details.',
        );
      }
    }
    load();
  }, [id]);
  const total = rows.reduce((s, r) => s + Number(r.milk_quantity), 0),
    rev = rows.reduce((s, r) => s + Number(r.calculated_amount), 0),
    fatDen = rows.reduce((s, r) => s + (r.fat == null ? 0 : Number(r.milk_quantity)), 0),
    fatNum = rows.reduce((s, r) => s + Number(r.milk_quantity) * Number(r.fat ?? 0), 0),
    avgFat = fatDen ? fatNum / fatDen : null,
    daily = Array.from(new Set(rows.map((r) => r.business_date)))
      .sort()
      .map((date) => {
        const d = rows.filter((r) => r.business_date === date);
        return {
          date: formatDate(date, 'D MMM'),
          milk: d.reduce((s, r) => s + Number(r.milk_quantity), 0),
          revenue: d.reduce((s, r) => s + Number(r.calculated_amount), 0),
        };
      });
  return (
    <AppShell
      title={c?.name ?? 'Customer details'}
      subtitle={`${c?.pricing_type === 'FAT_BASED' ? 'Fat based' : 'Fixed per litre'} · default rate ₹${c?.default_rate ?? '—'}`}
    >
      <Link href="/customers" style={{ fontSize: 12, color: '#277452' }}>
        ← All customers
      </Link>
      {error && <p className="auth-message">{error}</p>}
      <div className="grid kpis">
        <KPI label="TOTAL MILK" value={milkTxt(total)} foot={`${rows.length} entries`} />
        <KPI
          label="TOTAL REVENUE"
          value={money(rev)}
          foot={total ? `${money(rev / total)} per litre` : 'No sales'}
        />
        <KPI
          label="WEIGHTED AVG FAT"
          value={avgFat === null ? '—' : `${avgFat.toFixed(2)}%`}
          foot="Weighted by milk quantity"
          accent
        />
        <KPI
          label="AVG MILK PER ENTRY"
          value={rows.length ? milkTxt(total / rows.length) : '—'}
          foot={
            rows.length ? `${money(rev / rows.length)} average revenue per entry` : 'No entries'
          }
        />
      </div>
      <div className="card">
        <h2 className="section-title">Milk and revenue trend</h2>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily}>
              <CartesianGrid vertical={false} stroke="#eef1ed" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: '#9ba69f' }}
              />
              <YAxis hide />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="milk"
                name="Milk (L)"
                stroke="#267052"
                fill="#367d5d22"
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue (₹)"
                stroke="#d7a85e"
                fill="#d7a85e22"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ height: 14 }} />
      <div className="card">
        <h2 className="section-title">Entry history</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>SHIFT</th>
                <th>MILK</th>
                <th>FAT</th>
                <th>RATE SNAPSHOT</th>
                <th>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.business_date)}</td>
                  <td>{r.shift}</td>
                  <td>{milkTxt(Number(r.milk_quantity))}</td>
                  <td>{r.fat == null ? '—' : `${r.fat}%`}</td>
                  <td>
                    {r.pricing_type === 'FIXED_PER_LITRE'
                      ? '₹' + r.applied_rate + '/L'
                      : '₹' + r.applied_rate + '/fat'}
                  </td>
                  <td>{money(Number(r.calculated_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <div className="empty">No entries for this customer yet.</div>}
      </div>
    </AppShell>
  );
}
