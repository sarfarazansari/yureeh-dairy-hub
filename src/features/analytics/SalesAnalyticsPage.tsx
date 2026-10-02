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
  type AnalyticsExpense,
  type AnalyticsFarmSale,
  type AnalyticsProduction,
} from './services/sales-analytics.service';
import type { MilkEntry } from '@/lib/analytics';
import { getAnalyticsDateRange, type AnalyticsDatePreset } from '@/lib/analytics-date-range';
export default function SalesAnalyticsPage() {
  const now = new Date(),
    today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [range, setRange] = useState('today'),
    [customerId, setCustomerId] = useState(''),
    [rows, setRows] = useState<MilkEntry[]>([]),
    [customers, setCustomers] = useState<AnalyticsCustomer[]>([]),
    [expenses, setExpenses] = useState<AnalyticsExpense[]>([]),
    [farmSales, setFarmSales] = useState<AnalyticsFarmSale[]>([]),
    [farmProduction, setFarmProduction] = useState<AnalyticsProduction[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) return;
      setBusy(true);
      setError('');
      try {
        const data = await getSalesAnalyticsData(supabase, { from, to, customerId });
        if (!active) return;
        setRows(data.sales);
        setCustomers(data.customers);
        setExpenses(data.expenses);
        setFarmSales(data.farmSales);
        setFarmProduction(data.production);
      } catch (loadError) {
        if (active)
          setError(loadError instanceof Error ? loadError.message : 'Could not load analytics.');
      } finally {
        if (active) setBusy(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [from, to, customerId]);
  const total = rows.reduce((s, r) => s + Number(r.milk_quantity), 0),
    rev = rows.reduce((s, r) => s + Number(r.calculated_amount), 0),
    den = rows.reduce((s, r) => s + (r.fat == null ? 0 : Number(r.milk_quantity)), 0),
    fat = den
      ? rows.reduce((s, r) => s + Number(r.milk_quantity) * Number(r.fat ?? 0), 0) / den
      : null,
    days =
      from && to
        ? Math.max(
            1,
            Math.floor(
              (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) /
                86400000,
            ) + 1,
          )
        : 1;
  const expenseTotal = expenses.reduce((s, r) => s + Number(r.total_amount), 0),
    farmRevenue = farmSales.reduce((s, r) => s + Number(r.calculated_amount), 0),
    farmMilkSold = farmSales.reduce((s, r) => s + Number(r.milk_quantity), 0),
    farmMilkProduced = farmProduction.reduce((s, r) => s + Number(r.milk_quantity), 0);
  const daily = Array.from(new Set(rows.map((r) => r.business_date)))
    .sort()
    .map((date) => {
      const a = rows.filter((r) => r.business_date === date),
        milk = a.reduce((s, r) => s + Number(r.milk_quantity), 0),
        qty = a.reduce((s, r) => s + (r.fat == null ? 0 : Number(r.milk_quantity)), 0);
      return {
        date: formatDate(date, 'D MMM'),
        milk,
        revenue: a.reduce((s, r) => s + Number(r.calculated_amount), 0),
        fat: qty
          ? a.reduce((s, r) => s + Number(r.milk_quantity) * Number(r.fat ?? 0), 0) / qty
          : null,
      };
    });
  const shifts = ['MORNING', 'EVENING'].map((shift) => {
    const a = rows.filter((r) => r.shift === shift),
      q = a.reduce((s, r) => s + Number(r.milk_quantity), 0),
      known = a.reduce((s, r) => s + (r.fat == null ? 0 : Number(r.milk_quantity)), 0);
    return {
      shift,
      milk: q,
      revenue: a.reduce((s, r) => s + Number(r.calculated_amount), 0),
      fat: known
        ? a.reduce((s, r) => s + Number(r.milk_quantity) * Number(r.fat ?? 0), 0) / known
        : null,
    };
  });
  const contrib = customers
    .map((c) => {
      const a = rows.filter((r) => r.customer_id === c.id);
      return {
        name: c.name,
        milk: a.reduce((s, r) => s + Number(r.milk_quantity), 0),
        revenue: a.reduce((s, r) => s + Number(r.calculated_amount), 0),
      };
    })
    .filter((x) => x.milk || x.revenue)
    .sort((a, b) => b.revenue - a.revenue);
  const splits = ['FIXED_PER_LITRE', 'FAT_BASED'].map((type) => {
    const a = rows.filter((r) => r.pricing_type === type);
    return {
      type,
      milk: a.reduce((s, r) => s + Number(r.milk_quantity), 0),
      revenue: a.reduce((s, r) => s + Number(r.calculated_amount), 0),
      count: a.length,
    };
  });
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
      <div className="grid kpis">
        <KPI
          label="TOTAL MILK SOLD"
          value={busy ? '…' : milkTxt(total)}
          foot={`${rows.length} entries in selected range`}
        />
        <KPI
          label="TOTAL REVENUE"
          value={busy ? '…' : money(rev)}
          foot={total ? `${money(rev / total)} average per litre` : 'No revenue recorded'}
        />
        <KPI
          label="WEIGHTED AVERAGE FAT"
          value={fat === null ? '—' : `${fat.toFixed(2)}%`}
          foot="Weighted by quantity"
          accent
        />
        <KPI
          label="AVERAGE DAILY MILK"
          value={milkTxt(total / days)}
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
                <tr key={c.name}>
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
            <b>{money(farmRevenue)}</b>
          </div>
          <div>
            <div className="kpi-label">EXPENSES</div>
            <b>{money(expenseTotal)}</b>
          </div>
          <div>
            <div className="kpi-label">OPERATING SURPLUS</div>
            <b>{money(farmRevenue - expenseTotal)}</b>
          </div>
          <div>
            <div className="kpi-label">OPERATING EXPENSE / LITRE PRODUCED</div>
            <b>{farmMilkProduced ? money(expenseTotal / farmMilkProduced) : '—'}</b>
            <div className="kpi-foot">
              Sold denominator: {farmMilkSold ? money(expenseTotal / farmMilkSold) : '—'} / L
            </div>
          </div>
        </div>
        <p className="kpi-foot">
          Expense per litre uses buffalo production records; expense per litre sold uses milk sales.
          This is an operating view, not net profit.
        </p>
      </div>
    </AppShell>
  );
}
