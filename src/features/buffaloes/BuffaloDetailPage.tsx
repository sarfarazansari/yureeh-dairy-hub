'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
import { formatDate } from '@/lib/date-format';
import { money, milkTxt } from '@/lib/farm-format';

import {
  useBuffaloDetail,
  useBuffaloProductionHistory,
} from './hooks/use-buffaloes';
import { BuffaloProfileForm } from './components/BuffaloProfileForm';
import { BuffaloPurchasePaymentForm } from './components/BuffaloPurchasePaymentForm';
import { BuffaloStatusForm } from './components/BuffaloStatusForm';

export default function BuffaloDetailPage({ code }: { code: string }) {
  const [editing, setEditing] = useState(false);
  const buffaloQuery = useBuffaloDetail(code);
  const buffalo = buffaloQuery.data;
  const productionQuery = useBuffaloProductionHistory(buffalo?.id);

  const purchase = buffalo?.buffalo_purchases?.[0];
  const production = productionQuery.data ?? [];

  const summary = useMemo(() => {
    const total = production.reduce(
      (sum, row) => sum + Number(row.milk_quantity),
      0,
    );
    const days = new Set(production.map((row) => row.business_date)).size;

    const daily = Array.from(
      new Set(production.map((row) => row.business_date)),
    )
      .sort()
      .map((date) => {
        const records = production.filter((row) => row.business_date === date);
        const morning = records
          .filter((row) => row.shift === 'MORNING')
          .reduce((sum, row) => sum + Number(row.milk_quantity), 0);
        const evening = records
          .filter((row) => row.shift === 'EVENING')
          .reduce((sum, row) => sum + Number(row.milk_quantity), 0);

        return {
          date: formatDate(date, 'D MMM'),
          morning,
          evening,
          milk: morning + evening,
        };
      });

    return { total, days, daily };
  }, [production]);

  if (buffaloQuery.isPending) {
    return <AppShell title="Buffalo details"><div className="empty">Loading buffalo…</div></AppShell>;
  }

  if (buffaloQuery.isError) {
    return (
      <AppShell title="Buffalo details">
        <div className="empty">{buffaloQuery.error.message}</div>
      </AppShell>
    );
  }

  if (!buffalo) {
    return (
      <AppShell title="Buffalo details">
        <div className="empty">Buffalo not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={buffalo.name ? `${buffalo.buffalo_code} — ${buffalo.name}` : buffalo.buffalo_code}
      subtitle={`${buffalo.breed ?? 'Breed not entered'} · ${buffalo.current_status}`}
    >
      <div className="row" style={{ marginBottom: 14 }}>
        <Link href="/buffaloes" style={{ fontSize: 12, color: '#277452' }}>
          ← All buffaloes
        </Link>
        <button className="btn" type="button" onClick={() => setEditing((value) => !value)}>
          {editing ? 'Close edit' : 'Edit buffalo'}
        </button>
      </div>

      {editing && (
        <BuffaloProfileForm buffalo={buffalo} onCancel={() => setEditing(false)} />
      )}

      <div className="grid kpis">
        <KPI
          label="TOTAL MILK PRODUCED"
          value={milkTxt(summary.total)}
          foot={`${summary.days} days with records`}
        />
        <KPI
          label="AVG PER RECORDED DAY"
          value={summary.days ? milkTxt(summary.total / summary.days) : '—'}
          foot="Recorded production days"
        />
        <KPI
          label="PRODUCTION RECORDS"
          value={String(production.length)}
          foot="One row per date and shift"
        />
        <KPI
          label="BALANCE DUE"
          value={purchase ? money(Number(purchase.amount_pending)) : '—'}
          foot={
            purchase
              ? `Paid ${money(Number(purchase.amount_paid))} of ${money(Number(purchase.purchase_price))}`
              : 'No purchase record'
          }
        />
      </div>

      <div className="grid two">
        <div className="card">
          <h2 className="section-title">Milk production trend</h2>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.daily}>
                <CartesianGrid vertical={false} stroke="#eef1ed" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="milk"
                  name="Total milk"
                  stroke="#267052"
                  fill="#367d5d22"
                />
                <Area
                  type="monotone"
                  dataKey="morning"
                  name="Morning"
                  stroke="#d7a85e"
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <PurchaseSummary buffalo={buffalo} />
      </div>

      <div style={{ height: 14 }} />

      <div className="grid two">
        <BuffaloPurchasePaymentForm buffalo={buffalo} />
        <BuffaloStatusForm buffalo={buffalo} />
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <h2 className="section-title">Performance history</h2>

        {productionQuery.isPending ? (
          <div className="empty">Loading production history…</div>
        ) : productionQuery.isError ? (
          <div className="empty">{productionQuery.error.message}</div>
        ) : (
          <ProductionTable production={production} />
        )}
      </div>
    </AppShell>
  );
}

function PurchaseSummary({
  buffalo,
}: {
  buffalo: BuffaloDetail;
}) {
  const purchase = buffalo.buffalo_purchases[0];

  return (
    <div className="card">
      <h2 className="section-title">Purchase and vendor</h2>
      <p className="sub">Purchase date: {formatDate(purchase?.purchase_date)}</p>
      <p className="sub">
        Vendor: {purchase?.vendors?.name ?? '—'}
        {purchase?.vendors?.mobile ? ` · ${purchase.vendors.mobile}` : ''}
      </p>
      <p className="sub">
        Purchase location: {purchase?.vendors?.village_city ?? purchase?.vendors?.address ?? '—'}
      </p>
      <p className="sub">
        Payment type: {paymentTypeLabel(purchase?.payment_status)} · Udhaar due:{' '}
        {formatDate(purchase?.payment_due_date)}
      </p>
      <p className="sub">Udhaar terms: {purchase?.payment_terms ?? '—'}</p>
      <p className="sub">
        Identification: {buffalo.identification_mark ?? '—'} · Color: {buffalo.color ?? '—'}
      </p>
    </div>
  );
}

function ProductionTable({
  production,
}: {
  production: Array<{
    id: string;
    business_date: string;
    shift: string;
    milk_quantity: number;
  }>;
}) {
  return production.length ? (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>SHIFT</th>
            <th>MILK</th>
          </tr>
        </thead>
        <tbody>
          {production.map((row) => (
            <tr key={row.id}>
              <td>{formatDate(row.business_date)}</td>
              <td>{row.shift === 'MORNING' ? 'Morning' : 'Evening'}</td>
              <td>{milkTxt(Number(row.milk_quantity))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty">No performance records for this buffalo.</div>
  );
}

function paymentTypeLabel(status?: string) {
  if (status === 'PAID') return 'Paid in Full';
  if (status === 'PARTIAL') return 'Partial Credit';
  if (status === 'CREDIT') return 'Full Credit';
  return '—';
}
