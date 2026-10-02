'use client';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppShell } from '@/components/layout/AppShell';
export const money = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export function ExpenseShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell title={title} subtitle={subtitle}>
      <nav className="expense-nav">
        <Link href="/expenses">Overview</Link>
        <Link href="/expenses/new">New expense</Link>
        <Link href="/expenses/history">History</Link>
        <Link href="/expenses/categories">Categories</Link>
        <Link href="/expenses/vendors">Vendors</Link>
      </nav>
      {children}
    </AppShell>
  );
}
export async function ensureExpenseCategories(client: SupabaseClient) {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return;
  const { data: owned, error } = await client
    .from('expense_categories')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1);
  if (error || owned?.length) return;
  const { data: defaults, error: defaultError } = await client
    .from('expense_categories')
    .select('name,category_group,default_unit,is_quantity_based,is_active,description')
    .is('owner_id', null);
  if (defaultError || !defaults?.length) return;
  const { error: insertError } = await client
    .from('expense_categories')
    .insert(defaults.map((category) => ({ ...category, owner_id: user.id })));
  if (insertError && insertError.code !== '23505') throw insertError;
}
export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function ExpenseDateFilters({
  range,
  setRange,
  from,
  setFrom,
  to,
  setTo,
}: {
  range: string;
  setRange: (v: string) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
}) {
  function preset(v: string) {
    setRange(v);
    const now = new Date(),
      fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      d = new Date(now);
    if (v === 'today') {
      setFrom(fmt(now));
      setTo(fmt(now));
    } else if (v === 'week') {
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      setFrom(fmt(d));
      setTo(fmt(now));
    } else if (v === 'month') {
      d.setDate(1);
      setFrom(fmt(d));
      setTo(fmt(now));
    } else if (v === 'previous') {
      d.setDate(0);
      const end = new Date(d);
      d.setDate(1);
      setFrom(fmt(d));
      setTo(fmt(end));
    } else if (v === '3months') {
      d.setMonth(d.getMonth() - 2, 1);
      setFrom(fmt(d));
      setTo(fmt(now));
    } else if (v === 'year') {
      d.setMonth(0, 1);
      setFrom(fmt(d));
      setTo(fmt(now));
    }
  }
  return (
    <div className="expense-filters">
      <select
        className="date-chip"
        value={range}
        onChange={(e) =>
          e.target.value === 'custom' ? setRange('custom') : preset(e.target.value)
        }
      >
        <option value="today">Today</option>
        <option value="week">This week</option>
        <option value="month">This month</option>
        <option value="previous">Previous month</option>
        <option value="3months">Last 3 months</option>
        <option value="year">This year</option>
        <option value="custom">Custom range</option>
      </select>
      <input
        type="date"
        className="date-chip"
        value={from}
        onChange={(e) => {
          setRange('custom');
          setFrom(e.target.value);
        }}
      />
      <input
        type="date"
        className="date-chip"
        value={to}
        onChange={(e) => {
          setRange('custom');
          setTo(e.target.value);
        }}
      />
    </div>
  );
}
