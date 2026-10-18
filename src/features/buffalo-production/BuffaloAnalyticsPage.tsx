'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppShell } from '@/components/layout/AppShell';
import { KPI } from '@/components/ui/KPI';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/date-format';
import { getAnalyticsDateRange, type AnalyticsDatePreset } from '@/lib/analytics-date-range';
import { localDateKey } from '@/lib/milk-entry-list';
import { milkTxt } from '@/lib/farm-format';
import type { BuffaloProductionRecord } from './types';
import {
  useBuffaloProductionRangeQuery,
  useMilkPoolShiftFatHistoryQuery,
  useProducingBuffaloesQuery,
} from './buffalo-production.queries';

type ShiftFilter = 'BOTH' | 'MORNING' | 'EVENING';
type SortKey = 'status' | 'total' | 'average' | 'change' | 'coverage';

function setPreset(value: string, setFrom: (date: string) => void, setTo: (date: string) => void) {
  const range = getAnalyticsDateRange(value as AnalyticsDatePreset);
  setFrom(range.from);
  setTo(range.to);
}

function dateKey(date: Date) {
  return localDateKey(date);
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function previousEquivalentRange(from: string, to: string) {
  const days = Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000) + 1;
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

function sumQuantity(records: BuffaloProductionRecord[]) {
  return records.reduce((sum, record) => sum + Number(record.milk_quantity || 0), 0);
}

function pct(current: number, previous: number) {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

function rangeDays(from: string, to: string) {
  return Math.max(1, Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000) + 1);
}

function statusFor(coverage: number, change: number | null, hasData: boolean) {
  if (!hasData || coverage < 0.8) return { key: 'incomplete', label: 'Insufficient data', className: 'bg-slate-100 text-slate-700', action: 'Complete missing milking entries before judging performance.' };
  if (change !== null && change <= -15) return { key: 'declining', label: 'Declining', className: 'bg-red-100 text-red-800', action: 'Review missing shifts, feed intake and animal health; compare like-for-like days.' };
  if (change !== null && change <= -5) return { key: 'attention', label: 'Needs attention', className: 'bg-amber-100 text-amber-800', action: 'Check the recent production dip and confirm both shifts were recorded.' };
  return { key: 'productive', label: 'Productive', className: 'bg-emerald-100 text-emerald-800', action: 'Production is stable or improving against the previous period.' };
}

function fmtChange(value: number | null) {
  return value === null ? 'Not enough comparison data' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function BuffaloAnalyticsPage() {
  const today = localDateKey(new Date());
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [range, setRange] = useState('30days');
  const [selectedBuffaloId, setSelectedBuffaloId] = useState('all');
  const [shift, setShift] = useState<ShiftFilter>('BOTH');
  const [sort, setSort] = useState<SortKey>('status');

  const previousRange = useMemo(() => previousEquivalentRange(from, to), [from, to]);
  const productionQuery = useBuffaloProductionRangeQuery(from, to);
  const previousProductionQuery = useBuffaloProductionRangeQuery(previousRange.from, previousRange.to);
  const fatQuery = useMilkPoolShiftFatHistoryQuery(from, to);
  const herdQuery = useProducingBuffaloesQuery();

  const records = productionQuery.data ?? [];
  const previousRecords = previousProductionQuery.data ?? [];
  const herd = herdQuery.data ?? [];
  const fatRecords = fatQuery.data ?? [];
  const fatByDate = useMemo(() => {
    const byDate = new Map<string, { business_date: string; morning: number | null; evening: number | null }>();
    for (const record of fatRecords) {
      const row = byDate.get(record.business_date) ?? { business_date: record.business_date, morning: null, evening: null };
      if (record.shift === 'MORNING') row.morning = Number(record.fat_percentage);
      if (record.shift === 'EVENING') row.evening = Number(record.fat_percentage);
      byDate.set(record.business_date, row);
    }
    return [...byDate.values()].sort((a, b) => b.business_date.localeCompare(a.business_date));
  }, [fatRecords]);

  const isSingle = selectedBuffaloId !== 'all';
  const selectedBuffalo = herd.find((animal) => animal.id === selectedBuffaloId);
  const scopeLabel = isSingle ? (selectedBuffalo?.name || selectedBuffalo?.buffalo_code || 'Selected buffalo') : 'Farm';
  const busy = productionQuery.isPending || previousProductionQuery.isPending || fatQuery.isPending || herdQuery.isPending;
  const error = productionQuery.error?.message ?? previousProductionQuery.error?.message ?? fatQuery.error?.message ?? herdQuery.error?.message ?? '';
  const days = rangeDays(from, to);
  const expectedSlots = days * (shift === 'BOTH' ? 2 : 1);

  const scopedRecords = useMemo(() => records.filter((record) =>
    (selectedBuffaloId === 'all' || record.buffalo_id === selectedBuffaloId) &&
    (shift === 'BOTH' || record.shift === shift)), [records, selectedBuffaloId, shift]);
  const scopedPreviousRecords = useMemo(() => previousRecords.filter((record) =>
    (selectedBuffaloId === 'all' || record.buffalo_id === selectedBuffaloId) &&
    (shift === 'BOTH' || record.shift === shift)), [previousRecords, selectedBuffaloId, shift]);
  const total = sumQuantity(scopedRecords);
  const previousTotal = sumQuantity(scopedPreviousRecords);
  const recordedDays = new Set(scopedRecords.map((record) => record.business_date)).size;
  const average = recordedDays ? total / recordedDays : null;
  const change = pct(total, previousTotal);
  const currentDailyAverage = total / Math.max(1, days);
  const previousDays = rangeDays(previousRange.from, previousRange.to);
  const previousDailyAverage = previousTotal / Math.max(1, previousDays);

  const rows = useMemo(() => herd.map((animal) => {
    const own = records.filter((record) => record.buffalo_id === animal.id && (shift === 'BOTH' || record.shift === shift));
    const ownPrevious = previousRecords.filter((record) => record.buffalo_id === animal.id && (shift === 'BOTH' || record.shift === shift));
    const ownDays = new Set(own.map((record) => record.business_date)).size;
    const quantity = sumQuantity(own);
    const previousQuantity = sumQuantity(ownPrevious);
    const ownChange = pct(quantity, previousQuantity);
    const slots = new Set(own.map((record) => `${record.business_date}:${record.shift}`)).size;
    const coverage = Math.min(1, slots / expectedSlots);
    const status = statusFor(coverage, ownChange, own.length > 0);
    const morning = own.filter((record) => record.shift === 'MORNING');
    const evening = own.filter((record) => record.shift === 'EVENING');
    return {
      ...animal, total: quantity, days: ownDays, average: ownDays ? quantity / ownDays : null,
      change: ownChange, coverage, status, slots,
      morningAverage: morning.length ? sumQuantity(morning) / new Set(morning.map((record) => record.business_date)).size : null,
      eveningAverage: evening.length ? sumQuantity(evening) / new Set(evening.map((record) => record.business_date)).size : null,
      last: own.map((record) => record.business_date).sort().at(-1),
    };
  }), [herd, records, previousRecords, shift, expectedSlots]);

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    if (sort === 'status') {
      const order = { declining: 0, attention: 1, incomplete: 2, productive: 3 };
      return order[a.status.key as keyof typeof order] - order[b.status.key as keyof typeof order] || b.total - a.total;
    }
    if (sort === 'coverage') return a.coverage - b.coverage;
    const left = a[sort as 'total' | 'average' | 'change'];
    const right = b[sort as 'total' | 'average' | 'change'];
    if (left == null) return 1;
    if (right == null) return -1;
    return Number(right) - Number(left);
  }), [rows, sort]);

  const trend = useMemo(() => {
    const result: { businessDate: string; date: string; morning: number | null; evening: number | null; total: number | null }[] = [];
    for (let i = 0; i < days; i++) {
      const key = addDays(from, i);
      const daily = scopedRecords.filter((record) => record.business_date === key);
      const morning = daily.filter((record) => record.shift === 'MORNING');
      const evening = daily.filter((record) => record.shift === 'EVENING');
      result.push({
        businessDate: key, date: formatDate(key, 'D MMM'),
        morning: shift !== 'EVENING' && morning.length ? sumQuantity(morning) : null,
        evening: shift !== 'MORNING' && evening.length ? sumQuantity(evening) : null,
        total: daily.length ? sumQuantity(daily) : null,
      });
    }
    return result;
  }, [from, days, scopedRecords, shift]);

  const recentTrend = trend.slice(-7);
  const priorTrend = trend.slice(-14, -7);
  const recentAvg = recentTrend.filter((d) => d.total !== null).length
    ? sumQuantity(scopedRecords.filter((r) => r.business_date >= (recentTrend[0]?.businessDate ?? from))) / Math.max(1, new Set(scopedRecords.filter((r) => r.business_date >= (recentTrend[0]?.businessDate ?? from)).map((r) => r.business_date)).size)
    : null;
  const priorAvg = priorTrend.filter((d) => d.total !== null).length
    ? sumQuantity(scopedRecords.filter((r) => r.business_date >= (priorTrend[0]?.businessDate ?? from) && r.business_date <= (priorTrend[priorTrend.length - 1]?.businessDate ?? from))) / Math.max(1, new Set(scopedRecords.filter((r) => r.business_date >= (priorTrend[0]?.businessDate ?? from) && r.business_date <= (priorTrend[priorTrend.length - 1]?.businessDate ?? from)).map((r) => r.business_date)).size)
    : null;
  const missingSlots = Math.max(0, expectedSlots - new Set(scopedRecords.map((r) => `${r.business_date}:${r.shift}`)).size);
  const statusCounts = {
    productive: rows.filter((r) => r.status.key === 'productive').length,
    attention: rows.filter((r) => r.status.key === 'attention').length,
    declining: rows.filter((r) => r.status.key === 'declining').length,
    incomplete: rows.filter((r) => r.status.key === 'incomplete').length,
  };
  const selectedRow = rows.find((r) => r.id === selectedBuffaloId);
  const shiftTotals = {
    morning: sumQuantity(scopedRecords.filter((r) => r.shift === 'MORNING')),
    evening: sumQuantity(scopedRecords.filter((r) => r.shift === 'EVENING')),
  };
  const recentDirection = recentAvg === null || priorAvg === null ? 'Not enough recent data'
    : recentAvg > priorAvg * 1.03 ? 'Improving'
    : recentAvg < priorAvg * 0.97 ? 'Declining'
    : 'Stable';
  const recentMessage = recentAvg === null || priorAvg === null
    ? 'Record complete morning and evening entries for at least two weeks to compare recent performance.'
    : `Recent recorded-day average is ${milkTxt(recentAvg)} L/day versus ${milkTxt(priorAvg)} L/day in the preceding 7-day window.`;

  return (
    <AppShell title="Buffalo analytics" subtitle="Know which buffaloes are performing well, which need attention, and where records are incomplete">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="section-title">1. Filters</h2><p className="kpi-foot">Choose the herd, animal, period and milking shift.</p></div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'today', label: 'Today' }, { value: '7days', label: '7 days' },
              { value: '30days', label: '30 days' }, { value: 'month', label: 'This month' },
              { value: 'custom', label: 'Custom range' },
            ].map((item) => <Button key={item.value} size="sm" variant={range === item.value ? 'default' : 'outline'} onClick={() => {
              setRange(item.value);
              if (item.value === '30days') { setFrom(addDays(today, -29)); setTo(today); }
              else if (item.value !== 'custom') setPreset(item.value === '7days' ? '7days' : item.value, setFrom, setTo);
            }}>{item.label}</Button>)}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div><label className="mb-1 block text-sm font-medium">View</label><Select value={isSingle ? 'single' : 'all'} onValueChange={(v) => { if (v === 'all') setSelectedBuffaloId('all'); else if (!isSingle && herd[0]) setSelectedBuffaloId(herd[0].id); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All buffaloes · Herd overview</SelectItem><SelectItem value="single">Single buffalo</SelectItem></SelectContent></Select></div>
          <div><label className="mb-1 block text-sm font-medium">Buffalo</label><Select value={selectedBuffaloId} onValueChange={setSelectedBuffaloId}><SelectTrigger><SelectValue placeholder="Select buffalo" /></SelectTrigger><SelectContent><SelectItem value="all">All buffaloes</SelectItem>{herd.map((animal) => <SelectItem key={animal.id} value={animal.id}>{animal.name || animal.buffalo_code} · {animal.buffalo_code}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="mb-1 block text-sm font-medium">Shift</label><Select value={shift} onValueChange={(v) => setShift(v as ShiftFilter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BOTH">Both shifts</SelectItem><SelectItem value="MORNING">Morning</SelectItem><SelectItem value="EVENING">Evening</SelectItem></SelectContent></Select></div>
        </div>
        {range === 'custom' && <DateRangePicker from={from} to={to} max={today} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); }} className="max-w-[24rem]" />}
      </section>

      {error && <p className="auth-message" role="alert">{error}</p>}

      <section className="card space-y-3">
        <div><h2 className="section-title">2. {isSingle ? 'Buffalo performance overview' : 'Herd overview'}</h2><p className="kpi-foot">Milk production and data coverage for {formatDate(from)} – {formatDate(to)}.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Total milk production', value: busy ? '…' : milkTxt(total), foot: 'Litres in selected period' },
            { label: 'Daily average', value: busy ? '…' : `${milkTxt(average ?? 0)} L/day`, foot: `${recordedDays} recorded production days` },
            { label: 'Change vs previous period', value: busy ? '…' : fmtChange(change), foot: `Current: ${formatDate(from)} – ${formatDate(to)} · Previous: ${formatDate(previousRange.from)} – ${formatDate(previousRange.to)}` },
            { label: 'Missing shift entries', value: busy ? '…' : String(isSingle ? Math.max(0, expectedSlots - new Set(scopedRecords.map((r) => `${r.business_date}:${r.shift}`)).size) : missingSlots), foot: `Expected ${expectedSlots} shift entries in this view` },
          ].map((kpi) => <div key={kpi.label} className="rounded-xl border border-[var(--line)] bg-white p-4"><p className="text-sm font-medium text-slate-600">{kpi.label}</p><p className="mt-2 break-words text-2xl font-bold text-slate-950">{kpi.value}</p><p className="mt-2 text-xs leading-5 text-slate-600">{kpi.foot}</p></div>)}
        </div>
      </section>

      {!isSingle && <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="section-title">3. Buffalo performance summary</h2><p className="kpi-foot">Status uses period-over-period change and completeness; it is a screening aid, not a veterinary diagnosis.</p></div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}><SelectTrigger className="w-[13rem]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="status">Needs attention first</SelectItem><SelectItem value="total">Total milk</SelectItem><SelectItem value="average">Daily average</SelectItem><SelectItem value="change">Change vs previous</SelectItem><SelectItem value="coverage">Lowest data coverage</SelectItem></SelectContent></Select>
        </div>
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
          {[
            ['Productive', statusCounts.productive, 'bg-emerald-50 text-emerald-800'],
            ['Needs attention', statusCounts.attention, 'bg-amber-50 text-amber-800'],
            ['Declining', statusCounts.declining, 'bg-red-50 text-red-800'],
            ['Insufficient data', statusCounts.incomplete, 'bg-slate-100 text-slate-700'],
          ].map(([label, count, cls]) => <div key={String(label)} className={`rounded-lg p-3 ${cls}`}><p className="text-sm">{label}</p><p className="text-2xl font-bold">{count}</p></div>)}
        </div>
        <div className="w-full overflow-x-auto rounded-md border border-[var(--line)]"><Table className="min-w-[900px]">
          <TableHeader><TableRow><TableHead>Buffalo</TableHead><TableHead>Decision status</TableHead><TableHead>Total milk</TableHead><TableHead>Avg / recorded day</TableHead><TableHead>Change vs previous</TableHead><TableHead>Recorded days</TableHead><TableHead>Shift coverage</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
          <TableBody>{busy ? Array.from({ length: 4 }, (_, i) => <TableRow key={i}>{Array.from({ length: 8 }, (_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : sorted.map((animal) => <TableRow key={animal.id}>
            <TableCell><button className="text-left" onClick={() => setSelectedBuffaloId(animal.id)}><span className="font-semibold text-slate-900">{animal.name || animal.buffalo_code}</span><span className="block text-xs text-slate-500">{animal.buffalo_code}</span></button></TableCell>
            <TableCell><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${animal.status.className}`}>{animal.status.label}</span></TableCell>
            <TableCell>{animal.days ? milkTxt(animal.total) : '—'}</TableCell><TableCell>{animal.average === null ? '—' : `${milkTxt(animal.average)} L/day`}</TableCell>
            <TableCell className={animal.change !== null && animal.change < -5 ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'}>{fmtChange(animal.change)}</TableCell>
            <TableCell>{animal.days} / {days}</TableCell><TableCell>{Math.round(animal.coverage * 100)}%</TableCell>
            <TableCell><Button size="sm" variant="outline" onClick={() => setSelectedBuffaloId(animal.id)}>View details</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table></div>
        {!busy && !rows.length && <div className="empty">No active buffaloes found for this view.</div>}
      </section>}

      {isSingle && <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="section-title">4. {scopeLabel}</h2><p className="kpi-foot">{selectedBuffalo?.buffalo_code} · Individual performance summary</p></div><span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${selectedRow?.status.className ?? 'bg-slate-100 text-slate-700'}`}>{selectedRow?.status.label ?? 'Insufficient data'}</span></div>
        <p className="text-sm leading-6 text-slate-700">{selectedRow?.status.action}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Total milk', milkTxt(total), `${days}-day selected period`],
            ['Daily average', average === null ? '—' : `${milkTxt(average)} L/day`, `Based on ${recordedDays} recorded dates`],
            ['Period change', fmtChange(change), `Previous: ${formatDate(previousRange.from)} – ${formatDate(previousRange.to)}`],
            ['Data coverage', `${Math.round((selectedRow?.coverage ?? 0) * 100)}%`, `${selectedRow?.slots ?? 0} of ${expectedSlots} expected shifts recorded`],
          ].map(([label, value, foot]) => <div key={label} className="rounded-xl border border-[var(--line)] p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-xl font-bold text-slate-950">{value}</p><p className="mt-2 text-xs leading-5 text-slate-600">{foot}</p></div>)}
        </div>
      </section>}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="card min-w-0">
          <h2 className="section-title">5. Production trend</h2><p className="kpi-foot">Missing shifts appear as gaps, not zero litres.</p>
          <div className="mt-3 h-[300px]">
            {busy ? <Skeleton className="h-full w-full" /> : trend.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><CartesianGrid vertical={false} stroke="#e8eee9" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#475569' }} minTickGap={20} /><YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: '#475569' }} /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.businessDate ? formatDate(String(payload[0].payload.businessDate)) : ''} formatter={(value, name) => value == null ? ['No entry', name] : [`${Number(value).toFixed(2)} L`, name]} /><Area type="monotone" dataKey="morning" name="Morning" connectNulls={false} stroke="#16804a" fill="#16804a20" isAnimationActive={false} /><Area type="monotone" dataKey="evening" name="Evening" connectNulls={false} stroke="#d97706" fill="#d9770620" isAnimationActive={false} /><Area type="monotone" dataKey="total" name="Daily total" connectNulls={false} stroke="#1d4ed8" fill="#1d4ed810" isAnimationActive={false} /></AreaChart></ResponsiveContainer> : <div className="empty">No production records for this period.</div>}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700"><span>Morning: <b>{milkTxt(shiftTotals.morning)} L</b></span><span>Evening: <b>{milkTxt(shiftTotals.evening)} L</b></span></div>
        </section>
        <section className="card space-y-3">
          <h2 className="section-title">6. Production insights & recommended actions</h2>
          <div className="rounded-lg border border-[var(--line)] p-4"><p className="font-semibold text-slate-900">Period comparison</p><p className="mt-2 text-sm leading-6 text-slate-700">{change === null ? 'Not enough previous-period data to compare.' : `Production ${change > 0 ? 'increased' : change < 0 ? 'decreased' : 'was unchanged'} by ${Math.abs(change).toFixed(1)}% compared with the previous equivalent period.`}</p><div className="mt-3 grid grid-cols-2 gap-2 bg-slate-50 p-3 text-sm"><div><p className="font-medium text-slate-600">Current</p><p className="font-semibold text-slate-900">{formatDate(from)} – {formatDate(to)}</p><p>{milkTxt(total)} L total</p><p>{milkTxt(currentDailyAverage)} L/calendar day</p></div><div><p className="font-medium text-slate-600">Previous</p><p className="font-semibold text-slate-900">{formatDate(previousRange.from)} – {formatDate(previousRange.to)}</p><p>{milkTxt(previousTotal)} L total</p><p>{milkTxt(previousDailyAverage)} L/calendar day</p></div></div><p className="mt-2 text-sm font-medium text-slate-700">Absolute difference: {total - previousTotal >= 0 ? '+' : ''}{milkTxt(total - previousTotal)} L</p></div>
          <div className="rounded-lg border border-[var(--line)] p-4"><p className="font-semibold text-slate-900">Recent 7-day trend</p><p className="mt-2 text-sm font-semibold text-slate-800">{recentDirection}</p><p className="mt-1 text-sm leading-6 text-slate-700">{recentMessage}</p></div>
          <div className="rounded-lg border border-[var(--line)] p-4"><p className="font-semibold text-slate-900">Data quality</p><p className="mt-2 text-sm leading-6 text-slate-700">{missingSlots === 0 ? 'All expected shifts have records for this selected view.' : `${missingSlots} expected shift entries are missing in this view. Fill gaps before interpreting a production decline.`}</p><Button asChild variant="outline" className="mt-3"><Link href="/daily-performance">Enter daily performance</Link></Button></div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-950">Profitability not yet verified</p><p className="mt-2 text-sm leading-6 text-amber-900">Production alone cannot prove profit or loss. Animal-level milk revenue must be reconciled with actual feed consumption and buffalo-linked expenses before showing a financial status.</p></div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card min-w-0"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="section-title">7. Daily milk history</h2><p className="kpi-foot">{isSingle ? scopeLabel : 'Herd total'} · recent 15 days</p></div><Button variant="outline" size="sm" onClick={() => { setFrom(addDays(today, -14)); setTo(today); setRange('custom'); }}>View last 15 days</Button></div>
          <div className="mt-3 overflow-x-auto rounded-md border border-[var(--line)]"><Table className="min-w-[520px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Morning (L)</TableHead><TableHead>Evening (L)</TableHead><TableHead>Total (L)</TableHead></TableRow></TableHeader><TableBody>{busy ? Array.from({length:4},(_,i)=><TableRow key={i}>{Array.from({length:4},(_,j)=><TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>)}</TableRow>) : trend.slice(-15).reverse().map((day)=><TableRow key={day.businessDate}><TableCell>{formatDate(day.businessDate)}</TableCell><TableCell>{day.morning === null ? '—' : milkTxt(day.morning)}</TableCell><TableCell>{day.evening === null ? '—' : milkTxt(day.evening)}</TableCell><TableCell className="font-semibold">{day.total === null ? 'No entry' : milkTxt(day.total)}</TableCell></TableRow>)}</TableBody></Table></div>
        </section>
        <section className="card min-w-0"><h2 className="section-title">Mixed milk fat history</h2><p className="kpi-foot">Farm-level combined milk fat, not individual buffalo fat.</p><div className="mt-3 overflow-x-auto rounded-md border border-[var(--line)]"><Table className="min-w-[420px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Morning fat</TableHead><TableHead>Evening fat</TableHead></TableRow></TableHeader><TableBody>{busy ? Array.from({length:3},(_,i)=><TableRow key={i}>{Array.from({length:3},(_,j)=><TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>)}</TableRow>) : fatByDate.slice(-15).reverse().map((fat)=><TableRow key={fat.business_date}><TableCell>{formatDate(fat.business_date)}</TableCell><TableCell>{fat.morning === null ? <span className="text-slate-500">Not recorded</span> : `${fat.morning.toFixed(2)}%`}</TableCell><TableCell>{fat.evening === null ? <span className="text-slate-500">Not recorded</span> : `${fat.evening.toFixed(2)}%`}</TableCell></TableRow>)}</TableBody></Table></div>{!busy && !fatByDate.length && <div className="empty">No mixed milk fat entries in this period.</div>}</section>
      </div>
    </AppShell>
  );
}
