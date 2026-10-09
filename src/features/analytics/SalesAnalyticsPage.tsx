'use client';

import { money, milkTxt } from '@/lib/farm-format';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { KPI } from '@/components/ui/KPI';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate } from '@/lib/date-format';
import {
  getSalesAnalyticsData,
  type AnalyticsCustomer,
  type SalesAnalyticsSummary,
} from './services/sales-analytics.service';
import { getAnalyticsDateRange, type AnalyticsDatePreset } from '@/lib/analytics-date-range';
import { useMilkPoolReconciliationQuery } from '@/features/milk/milk.queries';
export default function SalesAnalyticsPage() {
  const now = new Date(),
    today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [range, setRange] = useState('today'),
    [customerId, setCustomerId] = useState(''),
    [summary, setSummary] = useState<SalesAnalyticsSummary | null>(null),
    [customers, setCustomers] = useState<AnalyticsCustomer[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!from || !to || from > to) {
        setSummary(null);
        setBusy(false);
        setError('Choose a valid report date range.');
        return;
      }
      if (!supabase) {
        setSummary(null);
        setBusy(false);
        setError('Supabase is not configured.');
        return;
      }

      setBusy(true);
      setSummary(null);
      setError('');
      try {
        const data = await getSalesAnalyticsData(supabase, { from, to, customerId });
        if (!active) return;
        setSummary(data.summary);
        setCustomers(data.customers);
      } catch (loadError) {
        if (active) {
          setSummary(null);
          setError(loadError instanceof Error ? loadError.message : 'Could not load analytics.');
        }
      } finally {
        if (active) setBusy(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [from, to, customerId]);
  const poolQuery = useMilkPoolReconciliationQuery(from, to);
  const poolRows = poolQuery.data ?? [];
  const poolProduced = poolRows.reduce((sum, row) => sum + Number(row.production_litres), 0);
  const poolDelivered = poolRows.reduce((sum, row) => sum + Number(row.customer_delivery_litres), 0);
  const poolOtherUse = poolRows.reduce((sum, row) => sum + Number(row.household_use_litres) + Number(row.wastage_litres) + Number(row.other_use_litres), 0);
  const poolClosing = poolRows.length ? Number(poolRows[poolRows.length - 1].closing_balance_litres) : null;
  const totals = summary?.totals;
  const total = totals?.milkSold ?? 0;
  const rev = totals?.revenue ?? 0;
  const fat = totals?.weightedFat ?? null;
  const days =
    from && to
      ? Math.max(
          1,
          Math.floor(
            (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) /
              86400000,
          ) + 1,
        )
      : 1;
  const expenseTotal = totals?.expenseTotal ?? 0;
  const farmRevenue = totals?.farmRevenue ?? 0;
  const farmMilkSold = totals?.farmMilkSold ?? 0;
  const farmMilkProduced = totals?.farmMilkProduced ?? 0;
  const daily = (summary?.daily ?? []).map((row) => ({
    date: formatDate(row.businessDate, 'D MMM'),
    milk: row.milk,
    revenue: row.revenue,
    fat: row.fat,
  }));
  const shifts = summary?.shifts ?? [];
  const contrib = summary?.customers ?? [];
  const splits = summary?.pricing ?? [];
  return (
    <AppShell title="Sales analytics" subtitle="Farm-level milk, fat and revenue">
      <div className="row">
        <select
          className="date-chip"
          value={range}
          onChange={(e) => {
            setRange(e.target.value);
            if (e.target.value !== 'custom') {
              const preset = getAnalyticsDateRange(e.target.value as AnalyticsDatePreset);
              setFrom(preset.from);
              setTo(preset.to);
            }
          }}
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7days">Last 7 days</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="previous">Previous month</option>
          <option value="custom">Custom range</option>
        </select>
        <div className="row">
          <input
            className="date-chip"
            type="date"
            value={from}
            onChange={(e) => {
              setRange('custom');
              setFrom(e.target.value);
            }}
          />
          <input
            className="date-chip"
            type="date"
            value={to}
            onChange={(e) => {
              setRange('custom');
              setTo(e.target.value);
            }}
          />
          <select
            className="date-chip"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="auth-message">{error}</p>}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <div>
            <h2 className="section-title">Milk pool reconciliation</h2>
            <p className="kpi-foot">Production and customer sales are now connected through the farm milk movement ledger.</p>
          </div>
          <Link href="/milk-pool" style={{ fontSize: 10, color: '#277452' }}>Open milk pool →</Link>
        </div>
        {poolQuery.isPending ? (
          <div className="empty">Loading pool reconciliation…</div>
        ) : poolQuery.isError ? (
          <p className="auth-message">{poolQuery.error.message}</p>
        ) : (
          <div className="grid four">
            <div><div className="kpi-label">PRODUCED</div><b>{milkTxt(poolProduced)}</b></div>
            <div><div className="kpi-label">DELIVERED</div><b>{milkTxt(poolDelivered)}</b></div>
            <div><div className="kpi-label">OTHER USE / WASTAGE</div><b>{milkTxt(poolOtherUse)}</b></div>
            <div><div className="kpi-label">CLOSING POOL</div><b>{poolClosing === null ? '—' : milkTxt(poolClosing)}</b></div>
          </div>
        )}
      </div>
      <div className="grid kpis">
        <KPI
          label="TOTAL MILK SOLD"
          value={busy ? '…' : milkTxt(total)}
          foot={`${totals?.entryCount ?? 0} entries in selected range`}
        />
        <KPI
          label="TOTAL REVENUE"
          value={busy ? '…' : money(rev)}
          foot={total ? `${money(rev / total)} average per litre` : 'No revenue recorded'}
        />
        <KPI
          label="WEIGHTED AVERAGE FAT"
          value={busy ? '…' : fat === null ? '—' : `${fat.toFixed(2)}%`}
          foot="Weighted by quantity"
          accent
        />
        <KPI
          label="AVERAGE DAILY MILK"
          value={busy ? '…' : milkTxt(total / days)}
          foot={`${days} calendar ${days === 1 ? 'day' : 'days'} in range`}
        />
      </div>
      <div className="grid two">
        <div className="card">
          <h2 className="section-title">Daily milk and revenue</h2>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid vertical={false} stroke="#eef1ed" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9, fill: '#9ba69f' }}
                />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="milk" name="Milk (L)" fill="#367d5d" radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" name="Revenue (₹)" fill="#d7a85e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2 className="section-title">Morning vs evening</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SHIFT</th>
                  <th>MILK</th>
                  <th>REVENUE</th>
                  <th>AVG FAT</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((x) => (
                  <tr key={x.shift}>
                    <td>{x.shift}</td>
                    <td>{milkTxt(x.milk)}</td>
                    <td>{money(x.revenue)}</td>
                    <td>{x.fat === null ? '—' : `${x.fat.toFixed(2)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ height: 20 }} />
          <h2 className="section-title">Pricing model</h2>
          {splits.map((x) => (
            <div className="row" key={x.type} style={{ padding: '7px 0', fontSize: 11 }}>
              <span>{x.type === 'FIXED_PER_LITRE' ? 'Fixed per litre' : 'Fat based'}</span>
              <b>
                {milkTxt(x.milk)} · {money(x.revenue)} · {x.count} entries
              </b>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 14 }} />
      <div className="card">
        <h2 className="section-title">Customer contribution</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>CUSTOMER</th>
                <th>MILK</th>
                <th>% MILK</th>
                <th>REVENUE</th>
                <th>% REVENUE</th>
              </tr>
            </thead>
            <tbody>
              {contrib.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{milkTxt(c.milk)}</td>
                  <td>{total ? `${((c.milk / total) * 100).toFixed(1)}%` : '—'}</td>
                  <td>{money(c.revenue)}</td>
                  <td>{rev ? `${((c.revenue / rev) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!contrib.length && <div className="empty">No customer sales in this range.</div>}
      </div>
      <div style={{ height: 14 }} />
      <div className="card">
        <div className="row">
          <h2 className="section-title">Farm operating summary</h2>
          <Link href="/expenses" style={{ fontSize: 10, color: '#277452' }}>
            Expense analytics →
          </Link>
        </div>
        <div className="grid four">
          <div>
            <div className="kpi-label">REVENUE</div>
            <b>{busy ? '…' : money(farmRevenue)}</b>
          </div>
          <div>
            <div className="kpi-label">EXPENSES</div>
            <b>{busy ? '…' : money(expenseTotal)}</b>
          </div>
          <div>
            <div className="kpi-label">OPERATING SURPLUS</div>
            <b>{busy ? '…' : money(farmRevenue - expenseTotal)}</b>
          </div>
          <div>
            <div className="kpi-label">OPERATING EXPENSE / LITRE PRODUCED</div>
            <b>{busy ? '…' : farmMilkProduced ? money(expenseTotal / farmMilkProduced) : '—'}</b>
            <div className="kpi-foot">
              Sold denominator: {busy ? '…' : farmMilkSold ? money(expenseTotal / farmMilkSold) : '—'} / L
            </div>
          </div>
        </div>
        <p className="kpi-foot">
          Expense per litre uses buffalo production records; expense per litre sold uses milk sales.
          Farm operating figures remain farm-wide when a customer filter is selected. Expenses follow expense
          entry dates and exclude costs capitalized to buffalo assets. Feed inventory consumption valuation
          is not used in this recorded-expense view, so this is not net profit.
        </p>
      </div>
    </AppShell>
  );
}
