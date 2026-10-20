'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AppShell } from '@/components/layout/AppShell';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { KPI } from '@/components/ui/KPI';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/date-format';
import { getAnalyticsDateRange, type AnalyticsDatePreset } from '@/lib/analytics-date-range';
import { money, milkTxt } from '@/lib/farm-format';
import { useMilkPoolReconciliationQuery, useMilkPoolShiftFatQuery } from '@/features/milk/milk.queries';
import {
  useMilkMarginAfterFeedQuery,
  useMilkPoolAdjustmentsQuery,
  useSalesAnalyticsQuery,
} from './sales-analytics.queries';

const chartGrid = '#e9eeea';
const milkColor = '#267653';
const revenueColor = '#c9923f';

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string; payload?: { fullDate?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white p-3 shadow-md" style={{ borderColor: 'var(--line)' }}>
      <p className="mb-2 text-sm font-semibold text-[var(--ink)]">
        {payload[0]?.payload?.fullDate ?? label}
      </p>
      {payload.map((item) => (
        <p key={item.name} className="text-sm" style={{ color: item.color }}>
          {item.name === 'Milk' ? 'Milk sold' : 'Sales revenue'}: {item.name === 'Milk'
            ? `${Number(item.value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`
            : money(Number(item.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

export default function SalesAnalyticsPage() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [range, setRange] = useState<AnalyticsDatePreset | 'custom'>('today');
  const [customerId, setCustomerId] = useState('');

  // Every customer/date combination is part of the TanStack Query key.
  // Farm-pool and feed-cost queries deliberately remain farm-wide.
  const filters = useMemo(() => ({ from, to, customerId: customerId || '' }), [from, to, customerId]);
  const analyticsQuery = useSalesAnalyticsQuery(filters);
  const summary = analyticsQuery.data?.summary ?? null;
  const customers = analyticsQuery.data?.customers ?? [];
  const validRange = Boolean(from && to && from <= to);
  const busy = validRange && analyticsQuery.isPending;
  const error = !validRange
    ? 'Choose a valid report date range.'
    : analyticsQuery.error?.message ?? '';

  const poolQuery = useMilkPoolReconciliationQuery(from, to);
  const poolFatQuery = useMilkPoolShiftFatQuery(from, to);
  const milkMarginQuery = useMilkMarginAfterFeedQuery(from, to);
  const poolAdjustmentsQuery = useMilkPoolAdjustmentsQuery(from, to);

  const poolFatRows = useMemo(() => {
    const byDate = new Map<string, { MORNING?: number; EVENING?: number }>();
    for (const record of poolFatQuery.data ?? []) {
      if (record.shift !== 'MORNING' && record.shift !== 'EVENING') continue;
      const shifts = byDate.get(record.business_date) ?? {};
      shifts[record.shift] = Number(record.fat_percentage);
      byDate.set(record.business_date, shifts);
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [poolFatQuery.data]);

  const poolRows = poolQuery.data ?? [];
  const poolProduced = poolRows.reduce((sum, row) => sum + Number(row.production_litres), 0);
  const poolDelivered = poolRows.reduce((sum, row) => sum + Number(row.customer_delivery_litres), 0);
  const poolOtherUse = poolRows.reduce((sum, row) =>
    sum + Number(row.household_use_litres) + Number(row.wastage_litres) + Number(row.other_use_litres), 0);
  const poolOpening = poolRows.length ? Number(poolRows[0].opening_balance_litres) : null;
  const poolAdjustmentsIn = poolRows.reduce((sum, row) => sum + Number(row.adjustment_in_litres), 0);
  const poolAdjustmentsOut = poolRows.reduce((sum, row) => sum + Number(row.adjustment_out_litres), 0);
  const poolClosing = poolRows.length ? Number(poolRows[poolRows.length - 1].closing_balance_litres) : null;
  const poolVariance = poolOpening === null || poolClosing === null
    ? null
    : poolOpening + poolProduced + poolAdjustmentsIn - poolDelivered - poolOtherUse - poolAdjustmentsOut - poolClosing;

  const milkMargin = milkMarginQuery.data?.[0] ?? null;
  const uncostedEntries = Number(milkMargin?.uncosted_feed_consumption_entries ?? 0);
  const totals = summary?.totals;
  const total = totals?.milkSold ?? 0;
  const revenue = totals?.revenue ?? 0;
  const weightedFat = totals?.weightedFat ?? null;
  const days = from && to
    ? Math.max(1, Math.floor((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1)
    : 1;
  const daily = (summary?.daily ?? []).map((row) => ({
    date: formatDate(row.businessDate, 'D MMM'),
    fullDate: formatDate(row.businessDate, 'D MMMM YYYY'),
    milk: Number(row.milk),
    revenue: Number(row.revenue),
  }));
  const shifts = summary?.shifts ?? [];
  const contribution = summary?.customers ?? [];
  const pricing = summary?.pricing ?? [];
  const selectedCustomerName = customers.find((customer) => customer.id === customerId)?.name;

  const selectPreset = (value: string) => {
    setRange(value as AnalyticsDatePreset | 'custom');
    if (value !== 'custom') {
      const preset = getAnalyticsDateRange(value as AnalyticsDatePreset);
      setFrom(preset.from);
      setTo(preset.to);
    }
  };

  return (
    <AppShell title="Sales analytics" subtitle="Milk sales, farm margin and production quality">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={range} onValueChange={selectPreset}>
          <SelectTrigger className="date-chip w-auto min-w-[9rem] shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="previous">Previous month</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
        {range === 'custom' && (
          <DateRangePicker from={from} to={to} max={today}
            onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); }}
            className="max-w-[22rem]" />
        )}
        <Select value={customerId || 'all'} onValueChange={(value) => setCustomerId(value === 'all' ? '' : value)}>
          <SelectTrigger className="date-chip w-auto min-w-[10rem] max-w-[16rem] shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            {customers.map((customer) => <SelectItem value={customer.id} key={customer.id}>{customer.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-[var(--muted)]">
          {selectedCustomerName ? `Sales for ${selectedCustomerName}` : 'Sales for all customers'}
          {validRange ? ` · ${formatDate(from, 'D MMMM YYYY')} – ${formatDate(to, 'D MMMM YYYY')}` : ''}
        </span>
      </div>
      {error && <p className="auth-message mb-3">{error}</p>}

      {/* Decision-first summary: this card always represents the farm, not a customer allocation. */}
      <section className="card mb-4 border-l-4" style={{ borderLeftColor: '#267653' }}>
        <div className="row mb-3">
          <div>
            <p className="eyebrow mb-1">Farm profitability indicator</p>
            <h2 className="section-title mb-1">Milk margin after feed</h2>
            <p className="kpi-foot">
              {range === 'month' ? 'This month' : `${formatDate(from, 'D MMMM YYYY')} – ${formatDate(to, 'D MMMM YYYY')}`}
              {' · '}Farm-wide, independent of the customer filter
            </p>
          </div>
          <Link href="/feeds/consumption" className="text-sm font-medium text-[var(--green)]">Feed consumption →</Link>
        </div>
        {milkMarginQuery.isPending ? <div className="empty">Calculating farm milk margin…</div>
          : milkMarginQuery.isError ? <p className="auth-message">{milkMarginQuery.error.message}</p>
            : !milkMargin ? <div className="empty">No milk margin summary returned for this range.</div>
              : <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg bg-[var(--paper)] p-4">
                    <div className="kpi-label">MARGIN AFTER FEED</div>
                    <div className="kpi-value">{uncostedEntries > 0 ? '—' : money(Number(milkMargin.milk_sales_revenue ?? 0) - Number(milkMargin.feed_consumption_cost ?? 0))}</div>
                    <div className="kpi-foot">{uncostedEntries > 0 ? 'Incomplete: some feed costs are missing' : 'Revenue minus feed consumed'}</div>
                  </div>
                  <div className="rounded-lg bg-[var(--paper)] p-4">
                    <div className="kpi-label">MILK SALES REVENUE</div>
                    <div className="kpi-value">{money(Number(milkMargin.milk_sales_revenue ?? 0))}</div>
                    <div className="kpi-foot">{milkTxt(Number(milkMargin.milk_litres_sold ?? 0))} sold farm-wide</div>
                  </div>
                  <div className="rounded-lg bg-[var(--paper)] p-4">
                    <div className="kpi-label">FEED CONSUMPTION COST</div>
                    <div className="kpi-value">{uncostedEntries > 0 ? '—' : money(Number(milkMargin.feed_consumption_cost ?? 0))}</div>
                    <div className="kpi-foot">{Number(milkMargin.feed_consumption_entries ?? 0)} consumption entries</div>
                  </div>
                  <div className="rounded-lg bg-[var(--paper)] p-4">
                    <div className="kpi-label">MARGIN PER LITRE</div>
                    <div className="kpi-value">
                      {uncostedEntries > 0 || Number(milkMargin.milk_litres_sold ?? 0) <= 0
                        ? '—'
                        : money((Number(milkMargin.milk_sales_revenue ?? 0) - Number(milkMargin.feed_consumption_cost ?? 0)) / Number(milkMargin.milk_litres_sold))}
                    </div>
                    <div className="kpi-foot">After feed cost only</div>
                  </div>
                </div>
                {uncostedEntries > 0 && <p className="auth-message mt-3">Margin hidden because {uncostedEntries} feed consumption entries have no recorded cost.</p>}
                <p className="kpi-foot mt-3">Feed cost uses inventory movement cost snapshots. This is not net farm profit; other operating costs are excluded.</p>
              </>}
      </section>

      <section className="grid kpis mb-4">
        <KPI label={selectedCustomerName ? 'CUSTOMER MILK SOLD' : 'TOTAL MILK SOLD'}
          value={busy ? '…' : milkTxt(total)}
          foot={`${totals?.entryCount ?? 0} sales entries in selected range`} />
        <KPI label={selectedCustomerName ? 'CUSTOMER REVENUE' : 'TOTAL REVENUE'}
          value={busy ? '…' : money(revenue)}
          foot={total > 0 ? `${money(revenue / total)} average per litre` : 'No sales revenue in this selection'} />
        <KPI label="WEIGHTED AVERAGE FAT"
          value={busy ? '…' : weightedFat === null ? '—' : `${weightedFat.toFixed(2)}%`}
          foot="Customer-sale fat, weighted by litres" accent />
        <KPI label="AVERAGE DAILY MILK SOLD"
          value={busy ? '…' : milkTxt(total / days)}
          foot={`${days} calendar ${days === 1 ? 'day' : 'days'} in selected range`} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card min-w-0">
          <div className="mb-1">
            <h2 className="section-title mb-1">Daily milk sold</h2>
            <p className="kpi-foot">Litres per day · dedicated quantity scale</p>
          </div>
          {busy ? <div className="empty">Loading milk sales…</div> : !daily.length ? <div className="empty">No customer milk sales for this date range and filter.</div> : (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke={chartGrid} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#829087' }} minTickGap={16} />
                  <YAxis tickLine={false} axisLine={false} width={42} tick={{ fontSize: 11, fill: '#829087' }} tickFormatter={(value: number) => `${value} L`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="milk" name="Milk" fill={milkColor} radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="card min-w-0">
          <div className="mb-1">
            <h2 className="section-title mb-1">Daily sales revenue</h2>
            <p className="kpi-foot">Rupees per day · dedicated currency scale</p>
          </div>
          {busy ? <div className="empty">Loading revenue…</div> : !daily.length ? <div className="empty">No customer sales revenue for this date range and filter.</div> : (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke={chartGrid} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#829087' }} minTickGap={16} />
                  <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: '#829087' }} tickFormatter={(value: number) => value >= 1000 ? `₹${(value / 1000).toFixed(1)}k` : `₹${value}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill={revenueColor} radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="card mt-4">
        <div className="row mb-3">
          <div>
            <h2 className="section-title mb-1">Sales breakdown</h2>
            <p className="kpi-foot">All figures in this section follow the selected date range and customer filter.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-semibold text-[var(--ink)]">Morning vs evening</h3>
            <div className="w-full overflow-x-auto rounded-md border border-[var(--line)]">
              <Table className="min-w-[420px]">
                <TableHeader><TableRow><TableHead>SHIFT</TableHead><TableHead>MILK</TableHead><TableHead>REVENUE</TableHead><TableHead>AVG FAT</TableHead></TableRow></TableHeader>
                <TableBody>{shifts.map((row) => <TableRow key={row.shift}>
                  <TableCell>{row.shift === 'MORNING' ? 'Morning' : 'Evening'}</TableCell>
                  <TableCell>{milkTxt(row.milk)}</TableCell><TableCell>{money(row.revenue)}</TableCell>
                  <TableCell>{row.fat === null ? '—' : `${row.fat.toFixed(2)}%`}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-semibold text-[var(--ink)]">Pricing model</h3>
            {pricing.map((row) => <div className="row border-b border-[var(--line)] py-3 text-sm last:border-0" key={row.type}>
              <span>{row.type === 'FIXED_PER_LITRE' ? 'Fixed per litre' : 'Fat based'}</span>
              <span className="text-right font-medium">{milkTxt(row.milk)} · {money(row.revenue)} · {row.count} entries</span>
            </div>)}
          </div>
        </div>
      </section>

      <section className="card mt-4">
        <h2 className="section-title mb-1">Customer contribution</h2>
        <p className="kpi-foot mb-3">{customerId ? 'Showing the selected customer only.' : 'Compare each customer’s share of total milk and revenue.'}</p>
        <div className="w-full overflow-x-auto rounded-md border border-[var(--line)]">
          <Table className="min-w-[600px]">
            <TableHeader><TableRow><TableHead>CUSTOMER</TableHead><TableHead>MILK</TableHead><TableHead>% MILK</TableHead><TableHead>REVENUE</TableHead><TableHead>% REVENUE</TableHead></TableRow></TableHeader>
            <TableBody>{contribution.map((row) => <TableRow key={row.id}>
              <TableCell>{row.name}</TableCell><TableCell>{milkTxt(row.milk)}</TableCell>
              <TableCell>{total ? `${((row.milk / total) * 100).toFixed(1)}%` : '—'}</TableCell>
              <TableCell>{money(row.revenue)}</TableCell>
              <TableCell>{revenue ? `${((row.revenue / revenue) * 100).toFixed(1)}%` : '—'}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
        {!busy && !contribution.length && <div className="empty">No customer sales match this date range and filter.</div>}
      </section>

      <section className="card mt-4">
        <div className="row mb-1">
          <div>
            <h2 className="section-title mb-1">Milk pool reconciliation</h2>
            <p className="kpi-foot">Farm-wide production, deliveries and adjustments from the milk movement ledger.</p>
          </div>
          <Link href="/milk-pool" className="text-sm font-medium text-[var(--green)]">Open milk pool →</Link>
        </div>
        {poolQuery.isPending ? <div className="empty">Loading pool reconciliation…</div>
          : poolQuery.isError ? <p className="auth-message">{poolQuery.error.message}</p>
            : <div className="grid four mt-3">
              <div><div className="kpi-label">OPENING POOL</div><b>{poolOpening === null ? '—' : milkTxt(poolOpening)}</b></div>
              <div><div className="kpi-label">PRODUCED</div><b>{milkTxt(poolProduced)}</b></div>
              <div><div className="kpi-label">ADJUSTMENTS IN</div><b>{milkTxt(poolAdjustmentsIn)}</b></div>
              <div><div className="kpi-label">DELIVERED (NET)</div><b>{milkTxt(poolDelivered)}</b></div>
              <div><div className="kpi-label">OTHER USE / WASTAGE</div><b>{milkTxt(poolOtherUse)}</b></div>
              <div><div className="kpi-label">ADJUSTMENTS OUT</div><b>{milkTxt(poolAdjustmentsOut)}</b></div>
              <div><div className="kpi-label">CLOSING POOL</div><b>{poolClosing === null ? '—' : milkTxt(poolClosing)}</b></div>
              <div><div className="kpi-label">RECONCILIATION VARIANCE</div><b>{poolVariance === null ? '—' : milkTxt(poolVariance)}</b></div>
            </div>}
        {(poolAdjustmentsIn > 0 || poolAdjustmentsOut > 0) && (
          <div className="mt-4">
            <p className="kpi-foot mb-2">Adjustment audit, including system-generated reversals. A balanced total alone does not prove the stock history is correct.</p>
            {poolAdjustmentsQuery.isPending ? <div className="empty">Loading adjustment audit…</div>
              : poolAdjustmentsQuery.isError ? <p className="auth-message">{poolAdjustmentsQuery.error.message}</p>
                : !(poolAdjustmentsQuery.data ?? []).length ? <p className="kpi-foot">No adjustment details returned for this range.</p>
                  : <div className="w-full overflow-x-auto rounded-md border border-[var(--line)]">
                    <Table className="min-w-[700px]">
                      <TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>DIRECTION</TableHead><TableHead>QUANTITY</TableHead><TableHead>SOURCE</TableHead><TableHead>NOTES</TableHead></TableRow></TableHeader>
                      <TableBody>{poolAdjustmentsQuery.data.map((movement) => <TableRow key={movement.id}>
                        <TableCell>{formatDate(movement.business_date, 'D MMMM YYYY')}</TableCell>
                        <TableCell>{movement.movement_direction === 'IN' ? 'Increase pool' : 'Decrease pool'}</TableCell>
                        <TableCell>{milkTxt(Number(movement.quantity))}</TableCell>
                        <TableCell>{movement.reverses_customer_delivery ? 'Delivery reversal' : movement.source_type || 'Manual / unspecified'}{movement.source_id ? ` · ${movement.source_id.slice(0, 8)}` : ''}</TableCell>
                        <TableCell>{movement.notes || 'No note recorded'}</TableCell>
                      </TableRow>)}</TableBody>
                    </Table>
                  </div>}
          </div>
        )}
      </section>

      <section className="card mt-4">
        <div className="row mb-1">
          <div>
            <h2 className="section-title mb-1">Mixed milk fat history</h2>
            <p className="kpi-foot">Farm-pool fat measured separately for morning and evening; not customer-sale weighted fat.</p>
          </div>
          <Link href="/milk-pool" className="text-sm font-medium text-[var(--green)]">View milk pool →</Link>
        </div>
        {poolFatQuery.isPending ? <div className="empty">Loading mixed milk fat…</div>
          : poolFatQuery.isError ? <p className="auth-message">{poolFatQuery.error.message}</p>
            : !poolFatRows.length ? <div className="empty">No mixed milk fat recorded for this date range.</div>
              : <div className="mt-3 w-full overflow-x-auto rounded-md border border-[var(--line)]">
                <Table className="min-w-[420px]">
                  <TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>MORNING FAT</TableHead><TableHead>EVENING FAT</TableHead></TableRow></TableHeader>
                  <TableBody>{poolFatRows.map(([dateKey, fatByShift]) => <TableRow key={dateKey}>
                    <TableCell>{formatDate(dateKey, 'D MMMM YYYY')}</TableCell>
                    <TableCell>{fatByShift.MORNING === undefined ? '—' : `${fatByShift.MORNING.toFixed(2)}%`}</TableCell>
                    <TableCell>{fatByShift.EVENING === undefined ? '—' : `${fatByShift.EVENING.toFixed(2)}%`}</TableCell>
                  </TableRow>)}</TableBody>
                </Table>
              </div>}
      </section>
    </AppShell>
  );
}
