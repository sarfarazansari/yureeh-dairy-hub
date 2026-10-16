'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { milkTxt } from '@/lib/farm-format';
import Link from 'next/link';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AppShell } from '@/components/layout/AppShell';
import { KPI } from '@/components/ui/KPI';
import { Button } from '@/components/ui/button';
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
import { localDateKey } from '@/lib/milk-entry-list';
import { getAnalyticsDateRange, type AnalyticsDatePreset } from '@/lib/analytics-date-range';
import { getBuffaloProductionRange, getMilkPoolShiftFatHistory, getProducingBuffaloes } from './services/buffalo-production.service';
import type { MilkPoolShiftFatRecord } from '@/features/milk/milk.types';
import type { BuffaloProductionAnimal, BuffaloProductionRecord } from './types';
function setPreset(value: string, setFrom: (date: string) => void, setTo: (date: string) => void) {
  const range = getAnalyticsDateRange(value as AnalyticsDatePreset);
  setFrom(range.from);
  setTo(range.to);
}
export default function BuffaloAnalyticsPage() {
  const now = new Date(),
    today = localDateKey(now),
    [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [range, setRange] = useState('today'),
    [records, setRecords] = useState<BuffaloProductionRecord[]>([]),
    [fatRecords, setFatRecords] = useState<MilkPoolShiftFatRecord[]>([]),
    [herd, setHerd] = useState<BuffaloProductionAnimal[]>([]),
    [sort, setSort] = useState<'total' | 'average' | 'morning' | 'evening'>('total'),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    async function load() {
      if (!supabase) return;
      setBusy(true);
      try {
        const [production, buffaloes, fatHistory] = await Promise.all([
          getBuffaloProductionRange(supabase, from, to),
          getProducingBuffaloes(supabase),
          getMilkPoolShiftFatHistory(supabase, from, to),
        ]);
        if (!live) return;
        setRecords(production);
        setHerd(buffaloes);
        setFatRecords(fatHistory);
        setError('');
      } catch (loadError) {
        if (live)
          setError(
            loadError instanceof Error ? loadError.message : 'Could not load production analytics.',
          );
      } finally {
        if (live) setBusy(false);
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, [from, to]);
  const total = records.reduce((sum, record) => sum + Number(record.milk_quantity), 0),
    days = new Set(
      records.map((record) => record.business_date),
    ).size;
  const rows = herd.map((animal) => {
    const own = records.filter((record) => record.buffalo_id === animal.id),
      ownDays = new Set(
        own.map((record) => record.business_date),
      ).size,
      morning = own.filter((record) => record.shift === 'MORNING'),
      evening = own.filter((record) => record.shift === 'EVENING'),
      quantity = own.reduce((sum, record) => sum + Number(record.milk_quantity), 0);
    return {
      ...animal,
      total: quantity,
      days: ownDays,
      average: ownDays ? quantity / ownDays : null,
      morning: morning.length
        ? morning.reduce((sum, record) => sum + Number(record.milk_quantity), 0) / morning.length
        : null,
      evening: evening.length
        ? evening.reduce((sum, record) => sum + Number(record.milk_quantity), 0) / evening.length
        : null,
      last: (
        own as (BuffaloProductionRecord & {
          business_date: string;
        })[]
      ).at(-1)?.business_date,
    };
  });
  const sorted = [...rows].sort((a, b) => Number(b[sort] ?? -1) - Number(a[sort] ?? -1));
  const dates = Array.from(
    new Set(
      records.map((record) => record.business_date),
    ),
  ).sort();
  const trend = dates.map((date) => {
    const daily = records.filter(
      (record) =>
        record.business_date === date,
    );
    return {
      date: formatDate(date, 'D MMM'),
      morning: daily
        .filter((record) => record.shift === 'MORNING')
        .reduce((sum, record) => sum + Number(record.milk_quantity), 0),
      evening: daily
        .filter((record) => record.shift === 'EVENING')
        .reduce((sum, record) => sum + Number(record.milk_quantity), 0),
    };
  });
  return (
    <AppShell title="Buffalo analytics" subtitle="Shift-wise production trends and herd comparison">
      <div className="row">
        <Select value={range} onValueChange={(value) => { setRange(value); if (value !== 'custom') setPreset(value, setFrom, setTo); }}><SelectTrigger className="date-chip w-auto min-w-[9rem] shrink-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="today">Today</SelectItem><SelectItem value="yesterday">Yesterday</SelectItem><SelectItem value="7days">Last 7 days</SelectItem><SelectItem value="week">This week</SelectItem><SelectItem value="month">This month</SelectItem><SelectItem value="previous">Previous month</SelectItem><SelectItem value="custom">Custom range</SelectItem></SelectContent></Select>
        {range === 'custom' && <DateRangePicker from={from} to={to} max={today} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); }} className="max-w-[22rem]" />}
      </div>
      {error && (
        <p className="auth-message" role="alert">
          {error}
        </p>
      )}
      <div className="grid kpis">
        <KPI
          label="TOTAL FARM PRODUCTION"
          value={busy ? '…' : milkTxt(total)}
          foot={`${days} days with recorded production`}
        />
        <KPI
          label="AVG DAILY PRODUCTION"
          value={days ? milkTxt(total / days) : '—'}
          foot="Divided by recorded production days"
        />
        <KPI
          label="ACTIVE BUFFALOES"
          value={String(herd.length)}
          foot={`${new Set(records.map((record) => record.buffalo_id)).size} recorded in range`}
        />
        <KPI
          label="PRODUCTION RECORDS"
          value={String(records.length)}
          foot="One record per buffalo, date and shift"
        />
      </div>
      <div style={{ height: 14 }} />
      <div className="card">
        <h2 className="section-title">Mixed milk fat history</h2>
        <p className="kpi-foot">Fat is recorded once for the combined milk for each date and shift.</p>
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
        {!busy && !fatRecords.length && (
          <div className="empty">No mixed milk fat records in this date range. Change the date range or record fat from Daily performance.</div>
        )}
      </div>
      <div className="grid two">
        <div className="card">
          <h2 className="section-title">Milk production by shift</h2>
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
                  dataKey="morning"
                  name="Morning milk"
                  stroke="#267052"
                  fill="#367d5d22"
                />
                <Area
                  type="monotone"
                  dataKey="evening"
                  name="Evening milk"
                  stroke="#d7a85e"
                  fill="#d7a85e22"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2 className="section-title">Herd coverage</h2>
          <p className="sub">
            Average recorded production per active buffalo:{' '}
            {herd.length ? milkTxt(total / herd.length) : '—'} · denominator: all {herd.length}{' '}
            active buffaloes
          </p>
          <p className="sub">No record is distinct from explicitly recorded zero production.</p>
          <Button variant="outline" asChild>
            <Link href="/daily-performance">Enter daily performance</Link>
          </Button>
        </div>
      </div>
      <div style={{ height: 14 }} />
      <div className="card">
        <div className="row">
          <h2 className="section-title">Buffalo comparison</h2>
          <Select value={sort} onValueChange={(value) => setSort(value as typeof sort)}><SelectTrigger aria-label="Sort buffalo comparison" className="date-chip"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="total">Total milk</SelectItem><SelectItem value="average">Average per recorded day</SelectItem><SelectItem value="morning">Morning average</SelectItem><SelectItem value="evening">Evening average</SelectItem></SelectContent></Select>
        </div>
        <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]">
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow>
                <TableHead>BUFFALO</TableHead>
                <TableHead>TOTAL MILK</TableHead>
                <TableHead>AVG / RECORDED DAY</TableHead>
                <TableHead>MORNING AVG</TableHead>
                <TableHead>EVENING AVG</TableHead>
                <TableHead>DAYS RECORDED</TableHead>
                <TableHead>LAST ENTRY</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {busy ? Array.from({ length: 4 }, (_, index) => <TableRow key={index}>{Array.from({ length: 7 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>) : sorted.map((animal) => (
                <TableRow key={animal.id}>
                  <TableCell>
                    <Link href={`/buffaloes/${encodeURIComponent(animal.buffalo_code)}`}>
                      <b>{animal.name || animal.buffalo_code}</b>
                    </Link>
                    <div className="kpi-foot">{animal.buffalo_code}</div>
                  </TableCell>
                  <TableCell>{animal.days ? milkTxt(animal.total) : '—'}</TableCell>
                  <TableCell>{animal.average === null ? '—' : milkTxt(animal.average)}</TableCell>
                  <TableCell>{animal.morning === null ? '—' : milkTxt(animal.morning)}</TableCell>
                  <TableCell>{animal.evening === null ? '—' : milkTxt(animal.evening)}</TableCell>
                  <TableCell>{animal.days}</TableCell>
                  <TableCell>{animal.last ? formatDate(animal.last) : 'No record'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!busy && !herd.length && <div className="empty">No active buffaloes found.</div>}
        {!busy && herd.length && !records.length && (
          <div className="empty">No production records in this date range.</div>
        )}
      </div>
    </AppShell>
  );
}
