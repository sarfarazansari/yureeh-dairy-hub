'use client';

import { money, milkTxt } from '@/lib/farm-format';
import {
  getBuffaloProductionHistory,
  type BuffaloProductionHistoryRecord,
} from '@/features/buffalo-production/services/buffalo-production.service';
import { getBuffaloDetails, type BuffaloDetail } from './services/buffalo.service';
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
export default function BuffaloDetailPage({ code }: { code: string }) {
  const [b, setB] = useState<BuffaloDetail | null>(null),
    [rows, setRows] = useState<BuffaloProductionHistoryRecord[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    async function load() {
      if (!supabase) return;
      try {
        const buffalo = await getBuffaloDetails(supabase, code);
        setB(buffalo);
        if (buffalo) setRows(await getBuffaloProductionHistory(supabase, buffalo.id));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Could not load buffalo details.',
        );
      }
    }
    void load();
  }, [code]);
  const purchase = b?.buffalo_purchases?.[0],
    total = rows.reduce((sum, row) => sum + Number(row.milk_quantity), 0),
    days = new Set(rows.map((row) => row.business_date)).size,
    daily = Array.from(new Set(rows.map((row) => row.business_date)))
      .sort()
      .map((date) => {
        const dated = rows.filter((row) => row.business_date === date);
        return {
          date,
          morning: dated
            .filter((row) => row.shift === 'MORNING')
            .reduce((sum, row) => sum + Number(row.milk_quantity), 0),
          evening: dated
            .filter((row) => row.shift === 'EVENING')
            .reduce((sum, row) => sum + Number(row.milk_quantity), 0),
        };
      }),
    trend = daily.map((row) => ({
      ...row,
      date: formatDate(row.date, 'D MMM'),
      milk: row.morning + row.evening,
    }));
  return (
    <AppShell
      title={b?.name ? `${b.buffalo_code} — ${b.name}` : (b?.buffalo_code ?? 'Buffalo details')}
      subtitle={`${b?.breed ?? 'Breed not entered'} · ${b?.current_status ?? ''}`}
    >
      <Link href="/buffaloes" style={{ fontSize: 12, color: '#277452' }}>
        ← All buffaloes
      </Link>
      {error && (
        <p className="auth-message" role="alert">
          {error}
        </p>
      )}
      <div className="grid kpis">
        <KPI
          label="TOTAL MILK PRODUCED"
          value={milkTxt(total)}
          foot={`${days} days with records`}
        />
        <KPI
          label="AVG PER RECORDED DAY"
          value={days ? milkTxt(total / days) : '—'}
          foot="Recorded production days"
        />
        <KPI
          label="PRODUCTION RECORDS"
          value={String(rows.length)}
          foot="One row per date and shift"
        />
        <KPI
          label="BALANCE DUE"
          value={purchase ? money(Number(purchase.amount_pending)) : '—'}
          foot={
            purchase
              ? `Advance paid ${money(Number(purchase.amount_paid))} of ${money(Number(purchase.purchase_price))}`
              : 'No purchase record'
          }
        />
      </div>
      <div className="grid two">
        <div className="card">
          <h2 className="section-title">Milk production trend</h2>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
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
                  name="Total milk"
                  stroke="#267052"
                  fill="#367d5d22"
                />
                <Area
                  type="monotone"
                  dataKey="morning"
                  name="Morning"
                  stroke="#d7a85e"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2 className="section-title">Purchase and vendor</h2>
          <p className="sub">Purchase date: {formatDate(purchase?.purchase_date)}</p>
          <p className="sub">
            Vendor: {purchase?.vendors?.name ?? '—'}{' '}
            {purchase?.vendors?.mobile ? `· ${purchase.vendors.mobile}` : ''}
          </p>
          <p className="sub">
            Purchase location:{' '}
            {purchase?.vendors?.village_city ?? purchase?.vendors?.address ?? '—'}
          </p>
          <p className="sub">
            Payment type:{' '}
            {purchase?.payment_status === 'PAID'
              ? 'Paid in Full'
              : purchase?.payment_status === 'PARTIAL'
                ? 'Partial Credit'
                : purchase?.payment_status === 'CREDIT'
                  ? 'Full Credit'
                  : '—'}{' '}
            · Udhaar due: {formatDate(purchase?.payment_due_date)}
          </p>
          <p className="sub">Udhaar terms: {purchase?.payment_terms ?? '—'}</p>
          <p className="sub">
            Identification: {b?.identification_mark ?? '—'} · Color: {b?.color ?? '—'}
          </p>
        </div>
      </div>
      <div style={{ height: 14 }} />
      <div className="card">
        <h2 className="section-title">Performance history</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>SHIFT</th>
                <th>MILK</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.business_date)}</td>
                  <td>{row.shift === 'MORNING' ? 'Morning' : 'Evening'}</td>
                  <td>{milkTxt(Number(row.milk_quantity))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <div className="empty">No performance records for this buffalo.</div>}
      </div>
    </AppShell>
  );
}
