'use client';

import { milkTxt } from '@/lib/farm-format';
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
import { localDateKey } from '@/lib/milk-entry-list';
import { getAnalyticsDateRange, type AnalyticsDatePreset } from '@/lib/analytics-date-range';
import { getBuffaloProductionRange, getProducingBuffaloes } from './services/buffalo-production.service';
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
        const [production, buffaloes] = await Promise.all([
          getBuffaloProductionRange(supabase, from, to),
          getProducingBuffaloes(supabase),
        ]);
        if (!live) return;
        setRecords(production);
        setHerd(buffaloes);
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
        <select
          className="date-chip"
          value={range}
          onChange={(event) => {
            setRange(event.target.value);
            if (event.target.value !== 'custom') setPreset(event.target.value, setFrom, setTo);
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
            aria-label="From date"
            className="date-chip"
            type="date"
            value={from}
            onChange={(event) => {
              setRange('custom');
              setFrom(event.target.value);
            }}
          />
          <input
            aria-label="To date"
            className="date-chip"
            type="date"
            value={to}
            onChange={(event) => {
              setRange('custom');
              setTo(event.target.value);
            }}
          />
        </div>
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
          <Link className="btn" href="/daily-performance">
            Enter daily performance
          </Link>
        </div>
      </div>
      <div style={{ height: 14 }} />
      <div className="card">
        <div className="row">
          <h2 className="section-title">Buffalo comparison</h2>
          <select
            aria-label="Sort buffalo comparison"
            className="date-chip"
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
          >
            <option value="total">Total milk</option>
            <option value="average">Average per recorded day</option>
            <option value="morning">Morning average</option>
            <option value="evening">Evening average</option>
          </select>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>BUFFALO</th>
                <th>TOTAL MILK</th>
                <th>AVG / RECORDED DAY</th>
                <th>MORNING AVG</th>
                <th>EVENING AVG</th>
                <th>DAYS RECORDED</th>
                <th>LAST ENTRY</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((animal) => (
                <tr key={animal.id}>
                  <td>
                    <Link href={`/buffaloes/${encodeURIComponent(animal.buffalo_code)}`}>
                      <b>{animal.name || animal.buffalo_code}</b>
                    </Link>
                    <div className="kpi-foot">{animal.buffalo_code}</div>
                  </td>
                  <td>{animal.days ? milkTxt(animal.total) : '—'}</td>
                  <td>{animal.average === null ? '—' : milkTxt(animal.average)}</td>
                  <td>{animal.morning === null ? '—' : milkTxt(animal.morning)}</td>
                  <td>{animal.evening === null ? '—' : milkTxt(animal.evening)}</td>
                  <td>{animal.days}</td>
                  <td>{animal.last ? formatDate(animal.last) : 'No record'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!busy && !herd.length && <div className="empty">No active buffaloes found.</div>}
        {!busy && herd.length && !records.length && (
          <div className="empty">No production records in this date range.</div>
        )}
      </div>
    </AppShell>
  );
}
