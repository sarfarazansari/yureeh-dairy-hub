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
type SortKey = 'total' | 'average' | 'morning' | 'evening' | 'change' | 'days';

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

function inRange(record: BuffaloProductionRecord, from: string, to: string) {
  return record.business_date >= from && record.business_date <= to;
}

function sumQuantity(records: BuffaloProductionRecord[]) {
  return records.reduce((sum, record) => sum + Number(record.milk_quantity || 0), 0);
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function describeChange(change: number | null) {
  if (change === null) return 'Not enough comparable production data to calculate a percentage change.';
  if (Math.abs(change) < 0.5) return 'Production is broadly stable versus the previous equivalent period.';
  return change > 0
    ? `Production increased by ${Math.abs(change).toFixed(1)}% versus the previous equivalent period.`
    : `Production decreased by ${Math.abs(change).toFixed(1)}% versus the previous equivalent period.`;
}

export default function BuffaloAnalyticsPage() {
  const today = localDateKey(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [range, setRange] = useState('today');
  const [selectedBuffaloId, setSelectedBuffaloId] = useState('all');
  const [shift, setShift] = useState<ShiftFilter>('BOTH');
  const [sort, setSort] = useState<SortKey>('total');

  const previousRange = useMemo(() => previousEquivalentRange(from, to), [from, to]);
  const productionQuery = useBuffaloProductionRangeQuery(from, to);
  const previousProductionQuery = useBuffaloProductionRangeQuery(previousRange.from, previousRange.to);
  const fatQuery = useMilkPoolShiftFatHistoryQuery(from, to);
  const herdQuery = useProducingBuffaloesQuery();

  const records = productionQuery.data ?? [];
  const previousRecords = previousProductionQuery.data ?? [];
  const herd = herdQuery.data ?? [];
  const fatRecords = (fatQuery.data ?? []).filter((record) => shift === 'BOTH' || record.shift === shift);
  const isSingle = selectedBuffaloId !== 'all';
  const selectedBuffalo = herd.find((animal) => animal.id === selectedBuffaloId);
  const busy = productionQuery.isPending || previousProductionQuery.isPending || fatQuery.isPending || herdQuery.isPending;
  const error = productionQuery.error?.message ?? previousProductionQuery.error?.message ?? fatQuery.error?.message ?? herdQuery.error?.message ?? '';

  const scopedRecords = useMemo(
    () => records.filter((record) =>
      (selectedBuffaloId === 'all' || record.buffalo_id === selectedBuffaloId) &&
      (shift === 'BOTH' || record.shift === shift),
    ),
    [records, selectedBuffaloId, shift],
  );
  const scopedPreviousRecords = useMemo(
    () => previousRecords.filter((record) =>
      (selectedBuffaloId === 'all' || record.buffalo_id === selectedBuffaloId) &&
      (shift === 'BOTH' || record.shift === shift),
    ),
    [previousRecords, selectedBuffaloId, shift],
  );

  const total = sumQuantity(scopedRecords);
  const recordedDays = new Set(scopedRecords.map((record) => record.business_date)).size;
  const previousTotal = sumQuantity(scopedPreviousRecords);
  const change = percentChange(total, previousTotal);
  const scopeLabel = isSingle ? (selectedBuffalo?.name || selectedBuffalo?.buffalo_code || 'Selected buffalo') : 'Farm';
  const average = recordedDays ? total / recordedDays : null;

  const rows = useMemo(() => herd.map((animal) => {
    const own = records.filter((record) => record.buffalo_id === animal.id && (shift === 'BOTH' || record.shift === shift));
    const ownPrevious = previousRecords.filter((record) => record.buffalo_id === animal.id && (shift === 'BOTH' || record.shift === shift));
    const ownDays = new Set(own.map((record) => record.business_date)).size;
    const morning = own.filter((record) => record.shift === 'MORNING');
    const evening = own.filter((record) => record.shift === 'EVENING');
    const quantity = sumQuantity(own);
    const previousQuantity = sumQuantity(ownPrevious);
    const morningQuantity = sumQuantity(morning);
    const eveningQuantity = sumQuantity(evening);
    const ownChange = percentChange(quantity, previousQuantity);
    return {
      ...animal,
      total: quantity,
      days: ownDays,
      average: ownDays ? quantity / ownDays : null,
      morning: morning.length ? morningQuantity / new Set(morning.map((record) => record.business_date)).size : null,
      evening: evening.length ? eveningQuantity / new Set(evening.map((record) => record.business_date)).size : null,
      change: ownChange,
      last: own.map((record) => record.business_date).sort().at(-1),
    };
  }), [herd, records, previousRecords, shift]);

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const left = a[sort];
    const right = b[sort];
    if (left == null) return 1;
    if (right == null) return -1;
    return Number(right) - Number(left);
  }), [rows, sort]);

  const trend = useMemo(() => {
    const start = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    const result: { date: string; morning: number | null; evening: number | null; total: number | null }[] = [];
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = dateKey(cursor);
      const daily = scopedRecords.filter((record) => record.business_date === key);
      const morning = daily.filter((record) => record.shift === 'MORNING');
      const evening = daily.filter((record) => record.shift === 'EVENING');
      result.push({
        date: formatDate(key, 'D MMM'),
        morning: shift !== 'EVENING' && morning.length ? sumQuantity(morning) : shift === 'EVENING' ? null : null,
        evening: shift !== 'MORNING' && evening.length ? sumQuantity(evening) : null,
        total: daily.length ? sumQuantity(daily) : null,
      });
    }
    return result;
  }, [from, to, scopedRecords, shift]);

  const recentRecordedDays = trend.filter((day) => day.total !== null).slice(-3);
  const precedingRecordedDays = trend.filter((day) => day.total !== null).slice(-6, -3);
  const consecutiveDecline = recentRecordedDays.length === 3 &&
    precedingRecordedDays.length === 3 &&
    recentRecordedDays.every((day, index) => Number(day.total) < Number(precedingRecordedDays[index].total));
  const hasEnoughData = scopedRecords.length > 0 && scopedPreviousRecords.length > 0;
  const changeInsight = describeChange(change);
  const declineInsight = consecutiveDecline
    ? 'The last three recorded production days are each lower than the corresponding three preceding recorded days. Check shift entries and feed/health context before drawing a cause.'
    : 'No three-day consecutive decline pattern is confirmed by the available recorded data.';
  const shiftTotals = {
    morning: sumQuantity(scopedRecords.filter((record) => record.shift === 'MORNING')),
    evening: sumQuantity(scopedRecords.filter((record) => record.shift === 'EVENING')),
  };

  return (
    <AppShell title="Buffalo analytics" subtitle="Understand production growth, shift performance, and herd comparisons">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem]">
          <Select value={selectedBuffaloId} onValueChange={setSelectedBuffaloId}>
            <SelectTrigger aria-label="Analytics scope" className="w-full">
              <SelectValue placeholder="Select buffalo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All buffaloes · Farm overview</SelectItem>
              {herd.map((animal) => (
                <SelectItem key={animal.id} value={animal.id}>
                  {(animal.name || animal.buffalo_code) + ' · ' + animal.buffalo_code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={range} onValueChange={(value) => {
          setRange(value);
          if (value !== 'custom') setPreset(value, setFrom, setTo);
        }}>
          <SelectTrigger aria-label="Date range" className="w-auto min-w-[9rem]">
            <SelectValue />
          </SelectTrigger>
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
          <DateRangePicker
            from={from}
            to={to}
            max={today}
            onChange={({ from: nextFrom, to: nextTo }) => {
              setFrom(nextFrom);
              setTo(nextTo);
            }}
            className="max-w-[22rem]"
          />
        )}
        <Select value={shift} onValueChange={(value) => setShift(value as ShiftFilter)}>
          <SelectTrigger aria-label="Milking shift" className="w-auto min-w-[9rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BOTH">Both shifts</SelectItem>
            <SelectItem value="MORNING">Morning</SelectItem>
            <SelectItem value="EVENING">Evening</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="auth-message" role="alert">{error}</p>}

      <div className="grid kpis">
        <KPI label={isSingle ? 'BUFFALO MILK PRODUCTION' : 'TOTAL FARM PRODUCTION'} value={busy ? '…' : milkTxt(total)} foot={`${scopeLabel} · ${from} to ${to}`} />
        <KPI label="AVG / RECORDED DAY" value={busy ? '…' : average === null ? '—' : milkTxt(average)} foot={`${recordedDays} recorded production day(s); missing dates excluded`} />
        <KPI label="CHANGE VS PREVIOUS PERIOD" value={busy ? '…' : change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`} foot={`${previousRange.from} to ${previousRange.to}`} />
        <KPI label={isSingle ? 'PRODUCTION RECORDS' : 'ACTIVE BUFFALOES'} value={busy ? '…' : isSingle ? String(scopedRecords.length) : String(herd.length)} foot={isSingle ? 'One record per date and shift' : `${new Set(records.map((record) => record.buffalo_id)).size} recorded in range`} />
      </div>

      <div className="grid two">
        <section className="card min-w-0">
          <h2 className="section-title">{isSingle ? `${scopeLabel}: milk production trend` : 'Milk production by shift'}</h2>
          <p className="kpi-foot">Actual recorded quantities in litres. Gaps indicate missing records, not zero production.</p>
          <div className="chart">
            {busy ? <Skeleton className="h-full w-full" /> : trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <CartesianGrid vertical={false} stroke="#eef1ed" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#718078' }} minTickGap={16} />
                  <YAxis tickLine={false} axisLine={false} width={42} tick={{ fontSize: 10, fill: '#718078' }} unit=" L" />
                  <Tooltip formatter={(value) => value == null ? ['No record', 'Production'] : [`${Number(value).toFixed(2)} L`, '']} />
                  <Area type="monotone" dataKey="morning" name="Morning" connectNulls={false} stroke="#267052" fill="#367d5d22" isAnimationActive={false} />
                  <Area type="monotone" dataKey="evening" name="Evening" connectNulls={false} stroke="#d7a85e" fill="#d7a85e22" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="empty">No production records in this date range.</div>}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span>Morning: <b>{milkTxt(shiftTotals.morning)}</b></span>
            <span>Evening: <b>{milkTxt(shiftTotals.evening)}</b></span>
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Production insights</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--line)] p-3">
              <p className="text-sm font-semibold">Period comparison</p>
              <p className="sub mt-1">{hasEnoughData ? changeInsight : 'Insufficient comparable records to determine a reliable period trend.'}</p>
              <p className="kpi-foot mt-1">Current: {from}–{to} · Previous: {previousRange.from}–{previousRange.to}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] p-3">
              <p className="text-sm font-semibold">Consecutive production trend</p>
              <p className="sub mt-1">{declineInsight}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] p-3">
              <p className="text-sm font-semibold">Financial profitability</p>
              <p className="sub mt-1">Profit/loss is not calculated yet: current production records cannot reliably attribute customer milk-sale revenue to an individual buffalo. Showing a number here would be misleading.</p>
              <p className="kpi-foot mt-1">Next prerequisite: reconcile animal-level revenue with actual feed consumption cost and buffalo-linked expenses.</p>
            </div>
          </div>
          <Button variant="outline" asChild className="mt-3">
            <Link href="/daily-performance">Enter daily performance</Link>
          </Button>
        </section>
      </div>

      <section className="card">
        <h2 className="section-title">Mixed milk fat history</h2>
        <p className="kpi-foot">Farm-level fat for combined milk per date and shift; it is not an individual buffalo fat measurement.</p>
        <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]">
          <Table className="min-w-[650px]">
            <TableHeader><TableRow><TableHead>BUSINESS DATE</TableHead><TableHead>SHIFT</TableHead><TableHead>MIXED MILK FAT</TableHead></TableRow></TableHeader>
            <TableBody>
              {busy ? Array.from({ length: 3 }, (_, index) => <TableRow key={index}><TableCell><Skeleton className="h-4 w-28" /></TableCell><TableCell><Skeleton className="h-4 w-20" /></TableCell><TableCell><Skeleton className="h-4 w-16" /></TableCell></TableRow>) : fatRecords.map((record) => (
                <TableRow key={record.business_date + record.shift}>
                  <TableCell>{formatDate(record.business_date)}</TableCell>
                  <TableCell>{record.shift === 'MORNING' ? 'Morning' : 'Evening'}</TableCell>
                  <TableCell><b>{Number(record.fat_percentage).toFixed(2)}%</b></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!busy && !fatRecords.length && <div className="empty">No mixed milk fat records in this date range. Change the date range or record fat from Daily performance.</div>}
      </section>

      {!isSingle && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">Buffalo comparison</h2>
            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger aria-label="Sort buffalo comparison" className="w-auto min-w-[12rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Total milk</SelectItem>
                <SelectItem value="average">Average per recorded day</SelectItem>
                <SelectItem value="morning">Morning average</SelectItem>
                <SelectItem value="evening">Evening average</SelectItem>
                <SelectItem value="days">Recorded days</SelectItem>
                <SelectItem value="change">Change vs previous period</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]">
            <Table className="min-w-[1050px]">
              <TableHeader><TableRow>
                <TableHead>BUFFALO</TableHead><TableHead>TOTAL MILK</TableHead><TableHead>AVG / RECORDED DAY</TableHead><TableHead>MORNING AVG</TableHead><TableHead>EVENING AVG</TableHead><TableHead>DAYS RECORDED</TableHead><TableHead>PERIOD CHANGE</TableHead><TableHead>LAST ENTRY</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {busy ? Array.from({ length: 4 }, (_, index) => <TableRow key={index}>{Array.from({ length: 8 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : sorted.map((animal) => (
                  <TableRow key={animal.id}>
                    <TableCell><button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => setSelectedBuffaloId(animal.id)}><b>{animal.name || animal.buffalo_code}</b><div className="kpi-foot">{animal.buffalo_code} · View analytics</div></button></TableCell>
                    <TableCell>{animal.days ? milkTxt(animal.total) : '—'}</TableCell>
                    <TableCell>{animal.average === null ? '—' : milkTxt(animal.average)}</TableCell>
                    <TableCell>{animal.morning === null ? '—' : milkTxt(animal.morning)}</TableCell>
                    <TableCell>{animal.evening === null ? '—' : milkTxt(animal.evening)}</TableCell>
                    <TableCell>{animal.days}</TableCell>
                    <TableCell>{animal.change === null ? '—' : `${animal.change > 0 ? '+' : ''}${animal.change.toFixed(1)}%`}</TableCell>
                    <TableCell>{animal.last ? formatDate(animal.last) : 'No record'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!busy && !herd.length && <div className="empty">No active buffaloes found.</div>}
          {!busy && herd.length > 0 && !records.length && <div className="empty">No production records in this date range.</div>}
        </section>
      )}

      {isSingle && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="section-title">{scopeLabel} · Daily production history</h2>
              <p className="kpi-foot">{selectedBuffalo?.buffalo_code} · Missing entries are not treated as zero.</p>
            </div>
            <Button variant="outline" onClick={() => setSelectedBuffaloId('all')}>Back to all buffaloes</Button>
          </div>
          <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]">
            <Table className="min-w-[600px]">
              <TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>MORNING</TableHead><TableHead>EVENING</TableHead><TableHead>TOTAL RECORDED</TableHead><TableHead>ENTRY STATUS</TableHead></TableRow></TableHeader>
              <TableBody>
                {busy ? Array.from({ length: 4 }, (_, index) => <TableRow key={index}>{Array.from({ length: 5 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : trend.slice().reverse().map((day) => {
                  const key = addDays(from, 0) && day.date;
                  const morningRecord = scopedRecords.find((record) => formatDate(record.business_date, 'D MMM') === key && record.shift === 'MORNING');
                  const eveningRecord = scopedRecords.find((record) => formatDate(record.business_date, 'D MMM') === key && record.shift === 'EVENING');
                  const dayTotal = [morningRecord, eveningRecord].filter(Boolean).reduce((sum, record) => sum + Number(record?.milk_quantity ?? 0), 0);
                  const hasRecord = Boolean(morningRecord || eveningRecord);
                  return <TableRow key={day.date}><TableCell>{day.date}</TableCell><TableCell>{morningRecord ? milkTxt(morningRecord.milk_quantity) : '—'}</TableCell><TableCell>{eveningRecord ? milkTxt(eveningRecord.milk_quantity) : '—'}</TableCell><TableCell>{hasRecord ? milkTxt(dayTotal) : '—'}</TableCell><TableCell>{hasRecord ? 'Recorded shift(s)' : 'No record in range data'}</TableCell></TableRow>;
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
