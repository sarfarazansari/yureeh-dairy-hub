'use client';
import { formatDate } from '@/lib/date-format';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import {
  ExpenseShell,
  ExpenseDateFilters,
  ensureExpenseCategories,
  money,
  todayLocal,
} from './shared';
import { KPI } from '@/components/ui/KPI';
import type { ExpenseRow } from '@/lib/expense-types';
export default function ExpenseDashboard() {
  const today = todayLocal(),
    monthStart = `${today.slice(0, 8)}01`,
    [from, setFrom] = useState(monthStart),
    [to, setTo] = useState(today),
    [range, setRange] = useState('month'),
    [rows, setRows] = useState<ExpenseRow[]>([]),
    [outstandingRows, setOutstandingRows] = useState<ExpenseRow[]>([]),
    [feedCategory, setFeedCategory] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) return;
      setLoading(true);
      try {
        await ensureExpenseCategories(supabase);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load categories');
      }
      const [period, open] = await Promise.all([
        supabase
          .from('expenses')
          .select('*')
          .gte('business_date', from)
          .lte('business_date', to)
          .is('deleted_at', null)
          .order('business_date', { ascending: false }),
        supabase
          .from('expenses')
          .select('*')
          .gt('pending_amount', 0)
          .is('deleted_at', null)
          .order('due_date', { ascending: true })
          .limit(500),
      ]);
      if (!alive) return;
      if (period.error || open.error) setError((period.error ?? open.error)!.message);
      setRows(period.data ?? []);
      setOutstandingRows(open.data ?? []);
      setLoading(false);
    }
    load();
    return () => {
      alive = false;
    };
  }, [from, to]);
  const total = rows.reduce((s, r) => s + Number(r.total_amount), 0),
    paid = rows.reduce((s, r) => s + Number(r.paid_amount), 0),
    pending = rows.reduce((s, r) => s + Number(r.pending_amount), 0),
    days = Math.max(
      1,
      Math.floor(
        (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000,
      ) + 1,
    ),
    feed = rows.filter((r) => r.category_group_snapshot === 'FEED'),
    animal = rows.filter((r) => r.category_group_snapshot === 'ANIMAL');
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) =>
      m.set(
        r.category_group_snapshot,
        (m.get(r.category_group_snapshot) ?? 0) + Number(r.total_amount),
      ),
    );
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const categoryRows = useMemo(() => {
    const m = new Map<
      string,
      {
        amount: number;
        quantity: number;
        weightedCost: number;
        count: number;
        unit: string | null;
        group: string;
      }
    >();
    for (const r of rows) {
      const key = r.category_name_snapshot,
        d = m.get(key) ?? {
          amount: 0,
          quantity: 0,
          weightedCost: 0,
          count: 0,
          unit: r.unit,
          group: r.category_group_snapshot,
        };
      d.amount += Number(r.total_amount);
      d.quantity += Number(r.quantity ?? 0);
      d.weightedCost += Number(r.quantity ?? 0) * Number(r.rate ?? 0);
      d.count++;
      m.set(key, d);
    }
    return [...m.entries()]
      .map(([name, v]) => ({
        name,
        ...v,
        avgRate: v.quantity ? v.weightedCost / v.quantity : null,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [rows]);
  const feedItems = categoryRows.filter((c) => c.group === 'FEED');
  const currentFeed =
    feedItems.find((c) => c.name === feedCategory)?.name ?? feedItems[0]?.name ?? '';
  const feedPrices = (() => {
    const m = new Map<string, { sum: number; count: number }>();
    for (const r of rows.filter(
      (x) => x.category_name_snapshot === currentFeed && x.rate != null,
    )) {
      const d = m.get(r.business_date) ?? { sum: 0, count: 0 };
      d.sum += Number(r.rate);
      d.count++;
      m.set(r.business_date, d);
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, x]) => ({ date: formatDate(date, 'D MMM'), rate: x.sum / x.count }));
  })();
  const outstanding = outstandingRows;
  const isMonthRange = days > 60;
  const chartRows = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const key = isMonthRange ? r.business_date.slice(0, 7) : r.business_date;
      m.set(key, (m.get(key) ?? 0) + Number(r.total_amount));
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({
        date: formatDate(isMonthRange ? `${date}-01` : date, isMonthRange ? 'MMM YYYY' : 'D MMM'),
        amount,
      }));
  }, [rows, isMonthRange]);
  return (
    <ExpenseShell
      title="Expense dashboard"
      subtitle="Farm spending, supplier payments and feed costs"
    >
      <ExpenseDateFilters
        range={range}
        setRange={setRange}
        from={from}
        setFrom={setFrom}
        to={to}
        setTo={setTo}
      />
      {error && <p className="auth-message">{error}</p>}
      <div className="grid kpis">
        <KPI
          label="TOTAL EXPENSES"
          value={loading ? '…' : money(total)}
          foot={`${rows.length} records in range`}
        />
        <KPI label="PAID" value={money(paid)} foot="Payments made in these expenses" />
        <KPI label="OUTSTANDING" value={money(pending)} foot="Pending supplier balances" accent />
        <KPI
          label="AVERAGE DAILY EXPENSE"
          value={money(total / days)}
          foot={`${days} calendar days`}
        />
      </div>
      <div className="grid kpis">
        <KPI
          label="FEED EXPENSES"
          value={money(feed.reduce((s, r) => s + Number(r.total_amount), 0))}
          foot={`${feed.reduce((s, r) => s + Number(r.quantity ?? 0), 0).toLocaleString('en-IN')} recorded units`}
        />
        <KPI
          label="ANIMAL EXPENSES"
          value={money(animal.reduce((s, r) => s + Number(r.total_amount), 0))}
          foot="Veterinary, medicines and other animal costs"
        />
        <div className="card">
          <div className="kpi-label">QUICK ACTION</div>
          <Link className="btn full" href="/expenses/new">
            ＋ &nbsp;Record expense
          </Link>
        </div>
        <div className="card">
          <div className="kpi-label">MANAGE</div>
          <div className="row" style={{ marginTop: 12 }}>
            <Link href="/expenses/categories" className="sub">
              Categories →
            </Link>
            <Link href="/expenses/vendors" className="sub">
              Vendors →
            </Link>
          </div>
        </div>
      </div>
      <div className="grid two">
        <div className="card">
          <h2 className="section-title">Expense trend</h2>
          <div className="chart">
            {chartRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartRows}>
                  <defs>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d7a85e" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#d7a85e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#eef1ed" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: '#9ba69f' }}
                  />
                  <YAxis hide />
                  <Tooltip formatter={(value: number | string) => money(Number(value))} />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    name="Expenses"
                    stroke="#b88645"
                    fill="url(#expenseFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty">No expenses recorded in this range.</div>
            )}
          </div>
        </div>
        <div className="card">
          <h2 className="section-title">Spending by group</h2>
          {groups.length ? (
            groups.map(([g, amount]) => (
              <div key={g} style={{ marginBottom: 13 }}>
                <div className="row" style={{ fontSize: 11 }}>
                  <span>{g.replaceAll('_', ' ')}</span>
                  <b>
                    {money(amount)} · {total ? ((amount / total) * 100).toFixed(1) : 0}%
                  </b>
                </div>
                <div className="progress">
                  <i
                    style={{
                      width: `${total ? (100 * amount) / total : 0}%`,
                      background: '#c2914b',
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="empty">Group breakdown appears when expenses are recorded.</div>
          )}
        </div>
      </div>
      <div className="grid two">
        <div className="card">
          <div className="row">
            <h2 className="section-title">Feed cost by item</h2>
            <span className="tag">FEED</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>QUANTITY</th>
                  <th>EXPENSE</th>
                  <th>AVG RATE</th>
                  <th>PURCHASES</th>
                </tr>
              </thead>
              <tbody>
                {feedItems.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <td>
                      {c.quantity ? `${c.quantity.toLocaleString('en-IN')} ${c.unit ?? ''}` : '—'}
                    </td>
                    <td>{money(c.amount)}</td>
                    <td>{c.avgRate === null ? '—' : `${money(c.avgRate)}/${c.unit ?? 'unit'}`}</td>
                    <td>{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!feedItems.length && <div className="empty">No feed purchases in this range.</div>}
        </div>
        <div className="card">
          <div className="row">
            <h2 className="section-title">Feed price trend</h2>
            <select
              className="date-chip"
              value={currentFeed}
              onChange={(e) => setFeedCategory(e.target.value)}
            >
              {feedItems.map((f) => (
                <option key={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="chart">
            {feedPrices.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={feedPrices}>
                  <CartesianGrid vertical={false} stroke="#eef1ed" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: '#9ba69f' }}
                  />
                  <YAxis hide />
                  <Tooltip formatter={(value: number | string) => money(Number(value))} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name="Average purchase rate"
                    stroke="#367d5d"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty">
                No quantity-based price records for this feed item in this range.
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="row">
            <h2 className="section-title">Outstanding expenses</h2>
            <Link
              href="/expenses/history?outstanding=true"
              style={{ fontSize: 10, color: '#277452' }}
            >
              View history →
            </Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>DUE</th>
                  <th>VENDOR</th>
                  <th>CATEGORY</th>
                  <th>PENDING</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.slice(0, 6).map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.due_date)}</td>
                    <td>{r.vendor_name_snapshot ?? '—'}</td>
                    <td>{r.category_name_snapshot}</td>
                    <td>{money(Number(r.pending_amount))}</td>
                    <td>
                      <span
                        className={`tag ${r.due_date && r.due_date < today ? 'status-overdue' : r.due_date === today ? 'status-today' : ''}`}
                      >
                        {!r.due_date
                          ? 'No due date'
                          : r.due_date < today
                            ? 'Overdue'
                            : r.due_date === today
                              ? 'Due today'
                              : 'Upcoming'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!outstanding.length && (
            <div className="empty">No outstanding balances in this range.</div>
          )}
        </div>
      </div>
      <div className="card">
        <div className="row">
          <h2 className="section-title">Category analytics</h2>
          <Link href="/expenses/history" style={{ fontSize: 10, color: '#277452' }}>
            Expense history →
          </Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>CATEGORY</th>
                <th>GROUP</th>
                <th>AMOUNT</th>
                <th>QUANTITY</th>
                <th>AVG RATE</th>
                <th>COUNT</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td>{c.group.replaceAll('_', ' ')}</td>
                  <td>{money(c.amount)}</td>
                  <td>{c.quantity ? `${c.quantity} ${c.unit ?? ''}` : '—'}</td>
                  <td>{c.avgRate === null ? '—' : money(c.avgRate)}</td>
                  <td>{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ExpenseShell>
  );
}
