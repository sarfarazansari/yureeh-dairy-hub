'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useFarmRole } from '@/lib/farm-access';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { todayLocal } from '../utils/expense-format';

export function ExpenseShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const farmRole = useFarmRole();
  const isViewer = farmRole === 'viewer';
  const links = [
    { href: '/expenses', label: 'Overview', match: (path: string) => path === '/expenses' },
    ...(!isViewer ? [{ href: '/expenses/new', label: 'New expense', match: (path: string) => path === '/expenses/new' }] : []),
    { href: '/expenses/history', label: 'History', match: (path: string) => path === '/expenses/history' },
    ...(!isViewer ? [
      { href: '/expenses/categories', label: 'Categories', match: (path: string) => path.startsWith('/expenses/categories') },
      { href: '/expenses/vendors', label: 'Vendors', match: (path: string) => path.startsWith('/expenses/vendors') },
    ] : []),
  ];

  return (
    <AppShell
      title={title}
      subtitle={subtitle}
      actions={
        <nav aria-label="Expense navigation" className="expense-nav flex flex-wrap justify-end gap-2">
          {links.map(({ href, label, match }) => {
            const active = match(pathname);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={active ? 'active' : undefined}>
                {label}
              </Link>
            );
          })}
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}

export function ExpenseDateFilters({
  range,
  setRange,
  from,
  setFrom,
  to,
  setTo,
}: {
  range: string;
  setRange: (value: string) => void;
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
}) {
  function preset(value: string) {
    setRange(value);
    const now = new Date();
    const format = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const date = new Date(now);

    if (value === 'today') {
      setFrom(format(now));
      setTo(format(now));
    } else if (value === 'week') {
      date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      setFrom(format(date));
      setTo(format(now));
    } else if (value === 'month') {
      date.setDate(1);
      setFrom(format(date));
      setTo(format(now));
    } else if (value === 'previous') {
      date.setDate(0);
      const end = new Date(date);
      date.setDate(1);
      setFrom(format(date));
      setTo(format(end));
    } else if (value === '3months') {
      date.setMonth(date.getMonth() - 2, 1);
      setFrom(format(date));
      setTo(format(now));
    } else if (value === 'year') {
      date.setMonth(0, 1);
      setFrom(format(date));
      setTo(format(now));
    }
  }

  return (
    <div className="expense-filters items-start">
      <div className="w-56 max-w-full">
        <Label className="mb-1.5 block">Period</Label>
        <Select value={range} onValueChange={(value) => value === 'custom' ? setRange('custom') : preset(value)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="previous">Previous month</SelectItem>
            <SelectItem value="3months">Last 3 months</SelectItem>
            <SelectItem value="year">This year</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {range === 'custom' && (
        <div className="w-full max-w-md">
          <Label className="mb-1.5 block">Date range</Label>
          <DateRangePicker
            from={from}
            to={to}
            max={todayLocal()}
            onChange={({ from: nextFrom, to: nextTo }) => {
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          />
        </div>
      )}
    </div>
  );
}
