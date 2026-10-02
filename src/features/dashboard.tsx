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
  getDashboardData,
  type DashboardCustomer,
  type DashboardHerdItem,
  type DashboardExpense,
  type DashboardSale,
} from './dashboard/services/dashboard.service';
import type { MilkEntry } from '@/lib/analytics';
export default function Dashboard() {
  const [entries, setEntries] = useState<MilkEntry[]>([]),
    [herd, setHerd] = useState<DashboardHerdItem[]>([]),
    [customersLive, setCustomersLive] = useState<DashboardCustomer[]>([]),
    [monthExpenses, setMonthExpenses] = useState<DashboardExpense[]>([]),
    [monthSales, setMonthSales] = useState<DashboardSale[]>([]),
    [monthProduction, setMonthProduction] = useState<Array<{ milk_quantity: number }>>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const today = new Date();
  const asDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = asDate(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  const startKey = asDate(start);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthKey = asDate(monthStart);
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await getDashboardData(supabase, {
          startDate: startKey,
          today: todayKey,
          monthStart: monthKey,
        });
        if (!active) return;
        setEntries(data.entries);
        setCustomersLive(data.customers);
        setHerd(data.herd);
        setMonthExpenses(data.expenses);
        setMonthSales(data.monthSales);
        setMonthProduction(data.monthProduction);
      } catch (loadError) {
        if (active)
          setError(loadError instanceof Error ? loadError.message : 'Could not load farm data.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [startKey, todayKey, monthKey]);
  const monthExpenseTotal = monthExpenses.reduce((s, e) => s + Number(e.total_amount), 0),
    monthRevenue = monthSales.reduce((s, e) => s + Number(e.calculated_amount), 0),
    monthProduced = monthProduction.reduce((s, e) => s + Number(e.milk_quantity), 0),
    monthSold = monthSales.reduce((s, e) => s + Number(e.milk_quantity), 0);
  const todayEntries = entries.filter((e) => e.business_date === todayKey),
    milk = (rows: MilkEntry[]) => rows.reduce((s, e) => s + Number(e.milk_quantity), 0),
    revenue = (rows: MilkEntry[]) => rows.reduce((s, e) => s + Number(e.calculated_amount), 0),
    weighted = (rows: MilkEntry[]) => {
      const den = rows.reduce((s, e) => s + (e.fat == null ? 0 : Number(e.milk_quantity)), 0);
      return den
        ? rows.reduce((s, e) => s + Number(e.milk_quantity) * Number(e.fat ?? 0), 0) / den
        : null;
    };
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = asDate(d),
      rows = entries.filter((e) => e.business_date === key);
    return {
      d: formatDate(d, 'D MMM'),
      m: milk(rows.filter((e) => e.shift === 'MORNING')),
      e: milk(rows.filter((e) => e.shift === 'EVENING')),
      r: revenue(rows),
      f: weighted(rows),
    };
  });
  const customerRows = customersLive
    .map((c) => {
      const rows = entries.filter((e) => e.customer_id === c.id);
      return {
        id: c.id,
        name: c.name,
        type:
          c.pricing_type === 'FIXED_PER_LITRE'
            ? `Fixed · ₹${c.default_rate}/L`
            : `Fat · ₹${c.default_rate}`,
        milk: milk(rows),
        revenue: revenue(rows),
      };
    })
    .filter((x) => x.milk || x.revenue)
    .sort((a, b) => b.milk - a.milk)
    .slice(0, 4);
  const production = herd.map((b) => ({
    ...b,
    total: b.performance ? Number(b.performance.milk_quantity) : null,
  }));
  const prodMilk = production.reduce((s, b) => s + (b.total ?? 0), 0);
  const sold = milk(todayEntries),
    rev = revenue(todayEntries),
    fat = weighted(todayEntries),
    morning = todayEntries.filter((e) => e.shift === 'MORNING'),
    evening = todayEntries.filter((e) => e.shift === 'EVENING');
  const dayName = formatDate(today, 'dddd, D MMM');
  return (
    <AppShell title="Farm overview" subtitle="Your milk business at a glance">
      <div className="row">
        <div>
          <span className="tag">TODAY · {dayName.toUpperCase()}</span>
        </div>
        <span className="date-chip">Last 7 days</span>
      </div>
      {error && <p className="auth-message">Couldn’t load farm data: {error}</p>}
      <div className="grid kpis">
        <KPI
          label="MILK SOLD TODAY"
          value={loading ? '…' : milkTxt(sold)}
          foot={`Morning ${milkTxt(milk(morning))} · Evening ${evening.length ? 'Recorded' : 'pending'}`}
        />
        <KPI
          label="FARM PRODUCTION"
          value={loading ? '…' : milkTxt(prodMilk)}
          foot={`${production.filter((b) => b.performance).length} of ${herd.length} active buffaloes recorded`}
        />
        <KPI
          label="REVENUE TODAY"
          value={loading ? '…' : money(rev)}
          foot={sold ? `${money(rev / sold)} average per litre` : 'No sales recorded today'}
        />
        <KPI
          label="WEIGHTED AVG FAT"
          value={loading ? '…' : fat === null ? '—' : `${fat.toFixed(2)}%`}
          foot={fat === null ? 'No milk fat data today' : `Quantity-weighted · ${milkTxt(sold)}`}
          accent
        />
      </div>
      <div className="grid two">
        <div className="card">
          <div className="row">
            <h2 className="section-title">Milk sold · last 7 days</h2>
            <span className="tag">Live data</span>
          </div>
          <div className="legend">
            <span>
              <i className="dot" />
              Morning
            </span>
            <span>
              <i className="dot gold" />
              Evening
            </span>
          </div>
          <div className="chart">
            {daily.some((d) => d.m || d.e) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="fillMilk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#458465" stopOpacity={0.19} />
                      <stop offset="100%" stopColor="#458465" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#eef1ed" />
                  <XAxis
                    dataKey="d"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: '#9ba69f' }}
                  />
                  <YAxis hide />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="m"
                    name="Morning milk"
                    stroke="#267052"
                    fill="url(#fillMilk)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="e"
                    name="Evening milk"
                    stroke="#d7a85e"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty">No milk entries in this date range yet.</div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="row">
            <h2 className="section-title">Today’s shifts</h2>
            <span style={{ fontSize: 10, color: '#91a097' }}>ENTRY STATUS</span>
          </div>
          {(['MORNING', 'EVENING'] as const).map((shift, i) => {
            const rows = todayEntries.filter((e) => e.shift === shift);
            return (
              <div
                className="row"
                key={shift}
                style={{
                  padding: '12px 0',
                  borderBottom: i === 0 ? '1px solid #eff1ee' : undefined,
                }}
              >
                <div>
                  <b style={{ fontSize: 12 }}>{i ? 'Evening' : 'Morning'}</b>
                  <div className="kpi-foot">
                    {rows.length} entr{rows.length === 1 ? 'y' : 'ies'} · {milkTxt(milk(rows))}
                  </div>
                </div>
                <span className={`tag ${rows.length ? '' : 'gold'}`}>
                  {rows.length ? 'Completed' : 'Pending'}
                </span>
              </div>
            );
          })}
          <Link
            href="/new-entry"
            className="btn full"
            style={{ display: 'block', textAlign: 'center' }}
          >
            ＋ &nbsp;Record milk entry
          </Link>
          <div style={{ height: 22 }} />
          <div className="row">
            <h2 className="section-title">Farm production today</h2>
            <Link href="/buffalo-analytics" style={{ fontSize: 10, color: '#277452' }}>
              View analytics →
            </Link>
          </div>
          <div className="row">
            <span className="kpi-foot">Buffaloes recorded</span>
            <b style={{ fontSize: 12 }}>
              {production.filter((b) => b.performance).length} / {herd.length}
            </b>
          </div>
          <div className="progress">
            <i
              style={{
                width: `${herd.length ? (100 * production.filter((b) => b.performance).length) / herd.length : 0}%`,
              }}
            />
          </div>
          <div className="row">
            <span className="kpi-foot">Shift-wise records</span>
            <b style={{ fontSize: 12 }}>
              {production.reduce((sum, b) => sum + (b.performance?.record_count ?? 0), 0)}
            </b>
          </div>
        </div>
      </div>
      <div className="grid two" style={{ marginTop: 15 }}>
        <div className="card">
          <div className="row">
            <h2 className="section-title">Customer contribution · 7 days</h2>
            <Link href="/customers" style={{ fontSize: 10, color: '#277452' }}>
              All customers →
            </Link>
          </div>
          {customerRows.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>CUSTOMER</th>
                  <th>PRICING</th>
                  <th>MILK</th>
                  <th>REVENUE</th>
                </tr>
              </thead>
              <tbody>
                {customerRows.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <Link href={`/customers/${c.id}`}>
                        <b>{c.name}</b>
                      </Link>
                    </td>
                    <td>
                      <span className="tag">{c.type}</span>
                    </td>
                    <td>{milkTxt(c.milk)}</td>
                    <td>{money(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">Customer totals appear after milk entries are recorded.</div>
          )}
        </div>
        <div className="card">
          <div className="row">
            <h2 className="section-title">Buffalo production</h2>
            <Link href="/daily-performance" style={{ fontSize: 10, color: '#277452' }}>
              Enter performance →
            </Link>
          </div>
          {production.length ? (
            production.slice(0, 3).map((b) => (
              <div
                className="row"
                key={b.id}
                style={{ padding: '9px 0', borderBottom: '1px solid #eff1ee' }}
              >
                <div>
                  <b style={{ fontSize: 11 }}>{b.name || b.buffalo_code}</b>
                  <div className="kpi-foot">{b.buffalo_code} · Milk production</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <b style={{ fontSize: 13 }}>
                    {b.total === null ? 'No record' : milkTxt(b.total)}
                  </b>
                  <div className="kpi-foot">
                    {b.performance ? 'Recorded today' : 'No record today'}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">Add buffaloes to track farm production.</div>
          )}
        </div>
      </div>
      <div style={{ height: 15 }} />
      <div className="card">
        <h2 className="section-title">Daily sales summary · last 7 days</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>MORNING</th>
                <th>EVENING</th>
                <th>TOTAL MILK</th>
                <th>AVG FAT</th>
                <th>REVENUE</th>
              </tr>
            </thead>
            <tbody>
              {daily
                .slice()
                .reverse()
                .map((d) => (
                  <tr key={d.d}>
                    <td>
                      <b>{d.d}</b>
                    </td>
                    <td>{milkTxt(d.m)}</td>
                    <td>{milkTxt(d.e)}</td>
                    <td>{milkTxt(d.m + d.e)}</td>
                    <td>{d.f === null ? '—' : `${d.f.toFixed(2)}%`}</td>
                    <td>{money(d.r)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!entries.length && !loading && (
          <div className="empty">No milk sales in this range. Start with a new milk entry.</div>
        )}
      </div>
      <div style={{ height: 15 }} />
      <div className="card">
        <div className="row">
          <h2 className="section-title">This month · farm finances</h2>
          <Link href="/expenses" style={{ fontSize: 10, color: '#277452' }}>
            View financial analytics →
          </Link>
        </div>
        <div className="grid four">
          <div>
            <div className="kpi-label">MILK REVENUE</div>
            <b>{money(monthRevenue)}</b>
          </div>
          <div>
            <div className="kpi-label">OPERATING EXPENSES</div>
            <b>{money(monthExpenseTotal)}</b>
          </div>
          <div>
            <div className="kpi-label">OPERATING SURPLUS</div>
            <b>{money(monthRevenue - monthExpenseTotal)}</b>
          </div>
          <div>
            <div className="kpi-label">EXPENSE / LITRE PRODUCED</div>
            <b>{monthProduced ? money(monthExpenseTotal / monthProduced) : '—'}</b>
            <div className="kpi-foot">
              {milkTxt(monthProduced)} produced · {milkTxt(monthSold)} sold
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
