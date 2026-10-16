'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { money, milkTxt } from '@/lib/farm-format';
import Link from 'next/link';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { AppShell } from '@/components/layout/AppShell';
import { KPI } from '@/components/ui/KPI';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate } from '@/lib/date-format';
import { useSalesAnalyticsQuery } from './sales-analytics.queries';
import { getAnalyticsDateRange, type AnalyticsDatePreset } from '@/lib/analytics-date-range';
import { useMilkPoolReconciliationQuery, useMilkPoolShiftFatQuery } from '@/features/milk/milk.queries';
export default function SalesAnalyticsPage() {
  const now = new Date(),
    today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [range, setRange] = useState('today'),
    [customerId, setCustomerId] = useState('');
  const analyticsQuery = useSalesAnalyticsQuery({ from, to, customerId });
  const summary = analyticsQuery.data?.summary ?? null;
  const customers = analyticsQuery.data?.customers ?? [];
  const validRange = Boolean(from && to && from <= to);
  const busy = validRange && analyticsQuery.isPending;
  const error = !validRange
    ? 'Choose a valid report date range.'
    : analyticsQuery.error?.message ?? '';
  const poolQuery = useMilkPoolReconciliationQuery(from, to);
  const poolFatQuery = useMilkPoolShiftFatQuery(from, to);
  const poolFatByDate = new Map<string, { MORNING?: number; EVENING?: number }>();
  for (const record of poolFatQuery.data ?? []) {
    if (record.shift !== 'MORNING' && record.shift !== 'EVENING') continue;
    const shifts = poolFatByDate.get(record.business_date) ?? {};
    shifts[record.shift] = Number(record.fat_percentage);
    poolFatByDate.set(record.business_date, shifts);
  }
  const poolFatRows = Array.from(poolFatByDate.entries()).sort(([a], [b]) => b.localeCompare(a));
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
      <div className="flex flex-wrap items-center justify-start gap-3">
        <Select value={range} onValueChange={(value) => { setRange(value); if (value !== 'custom') { const preset = getAnalyticsDateRange(value as AnalyticsDatePreset); setFrom(preset.from); setTo(preset.to); } }}><SelectTrigger className="date-chip w-auto min-w-[9rem] shrink-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="today">Today</SelectItem><SelectItem value="yesterday">Yesterday</SelectItem><SelectItem value="7days">Last 7 days</SelectItem><SelectItem value="week">This week</SelectItem><SelectItem value="month">This month</SelectItem><SelectItem value="previous">Previous month</SelectItem><SelectItem value="custom">Custom range</SelectItem></SelectContent></Select>
        {range === 'custom' && <DateRangePicker from={from} to={to} max={today} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); }} className="max-w-[22rem]" />}
        <Select value={customerId || 'all'} onValueChange={(value) => setCustomerId(value === 'all' ? '' : value)}><SelectTrigger className="date-chip w-auto min-w-[10rem] max-w-[13rem] shrink-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All customers</SelectItem>{customers.map((c) => <SelectItem value={c.id} key={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
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
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <div>
            <h2 className="section-title">Mixed milk fat history</h2>
            <p className="kpi-foot">Fat measured from the combined farm milk, recorded separately for morning and evening. This is not the customer-sale weighted fat shown below.</p>
          </div>
          <Link href="/milk-pool" style={{ fontSize: 10, color: '#277452' }}>View in milk pool →</Link>
        </div>
        {poolFatQuery.isPending ? (
          <div className="empty">Loading mixed milk fat…</div>
        ) : poolFatQuery.isError ? (
          <p className="auth-message">{poolFatQuery.error.message}</p>
        ) : !poolFatRows.length ? (
          <div className="empty">No mixed milk fat recorded for this date range.</div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]">
            <Table className="min-w-[420px]"><TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>MORNING FAT</TableHead><TableHead>EVENING FAT</TableHead></TableRow></TableHeader>
              <TableBody>{poolFatRows.map(([dateKey, shifts]) => <TableRow key={dateKey}><TableCell>{formatDate(dateKey)}</TableCell><TableCell>{shifts.MORNING === undefined ? '—' : `${shifts.MORNING.toFixed(2)}%`}</TableCell><TableCell>{shifts.EVENING === undefined ? '—' : `${shifts.EVENING.toFixed(2)}%`}</TableCell></TableRow>)}</TableBody>
            </Table>
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
          <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]">
            <Table className="min-w-[480px]"><TableHeader><TableRow><TableHead>SHIFT</TableHead><TableHead>MILK</TableHead><TableHead>REVENUE</TableHead><TableHead>AVG FAT</TableHead></TableRow></TableHeader>
              <TableBody>{shifts.map((x) => <TableRow key={x.shift}><TableCell>{x.shift}</TableCell><TableCell>{milkTxt(x.milk)}</TableCell><TableCell>{money(x.revenue)}</TableCell><TableCell>{x.fat === null ? '—' : `${x.fat.toFixed(2)}%`}</TableCell></TableRow>)}</TableBody>
            </Table>
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
        <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]">
          <Table className="min-w-[600px]"><TableHeader><TableRow><TableHead>CUSTOMER</TableHead><TableHead>MILK</TableHead><TableHead>% MILK</TableHead><TableHead>REVENUE</TableHead><TableHead>% REVENUE</TableHead></TableRow></TableHeader>
            <TableBody>{contrib.map((c) => <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell>{milkTxt(c.milk)}</TableCell><TableCell>{total ? `${((c.milk / total) * 100).toFixed(1)}%` : '—'}</TableCell><TableCell>{money(c.revenue)}</TableCell><TableCell>{rev ? `${((c.revenue / rev) * 100).toFixed(1)}%` : '—'}</TableCell></TableRow>)}</TableBody>
          </Table>
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
