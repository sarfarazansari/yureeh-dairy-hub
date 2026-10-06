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
  useBuffaloPurchasePayments,
  useBuffaloStatusHistory,
} from './hooks/use-buffaloes';
import { BuffaloProfileForm } from './components/BuffaloProfileForm';
import { BuffaloPurchaseForm } from './components/BuffaloPurchaseForm';
import { BuffaloPurchasePaymentForm } from './components/BuffaloPurchasePaymentForm';
import { BuffaloStatusForm } from './components/BuffaloStatusForm';
import { BuffaloVendorForm } from './components/BuffaloVendorForm';
import {
  BuffaloPaymentHistory,
  BuffaloStatusHistory,
} from './components/BuffaloHistory';
import { BuffaloDetail } from './services/buffalo.service';

export default function BuffaloDetailPage({ id }: { id: string }) {
  const [editing, setEditing] = useState<'profile' | 'purchase' | 'vendor' | null>(null);
  const buffaloQuery = useBuffaloDetail(id);
  const buffalo = buffaloQuery.data;
  const productionQuery = useBuffaloProductionHistory(buffalo?.id);
  const paymentsQuery = useBuffaloPurchasePayments(buffalo?.id);
  const statusHistoryQuery = useBuffaloStatusHistory(buffalo?.id);

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
    return <AppShell title="Buffalo details" subtitle=""><div className="empty">Loading buffalo…</div></AppShell>;
  }

  if (buffaloQuery.isError) {
    return (
      <AppShell title="Buffalo details" subtitle="">
        <div className="empty">{buffaloQuery.error.message}</div>
      </AppShell>
    );
  }

  if (!buffalo) {
    return (
      <AppShell title="Buffalo details" subtitle="">
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn"
            type="button"
            onClick={() => setEditing((value) => (value === 'profile' ? null : 'profile'))}
          >
            Edit profile
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setEditing((value) => (value === 'purchase' ? null : 'purchase'))}
          >
            Edit purchase
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setEditing((value) => (value === 'vendor' ? null : 'vendor'))}
          >
            Edit vendor
          </button>
        </div>
      </div>

      {editing === 'profile' && (
        <BuffaloProfileForm buffalo={buffalo} onCancel={() => setEditing(null)} />
      )}
      {editing === 'purchase' && (
        <BuffaloPurchaseForm buffalo={buffalo} onCancel={() => setEditing(null)} />
      )}
      {editing === 'vendor' && (
        <BuffaloVendorForm buffalo={buffalo} onCancel={() => setEditing(null)} />
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
          label="PURCHASE PRICE"
          value={purchase ? money(Number(purchase.purchase_price)) : '—'}
          foot={purchase ? `Paid ${money(Number(purchase.amount_paid))}` : 'No purchase record'}
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
        <ProfileSummary buffalo={buffalo} />
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

      <div className="grid two">
        <BuffaloPaymentHistory payments={paymentsQuery.data ?? []} />
        <BuffaloStatusHistory history={statusHistoryQuery.data ?? []} />
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div className="row">
          <div>
            <h2 className="section-title">Performance history</h2>
            <p className="sub">Milk recorded for this buffalo by date and shift.</p>
          </div>
          <Link className="date-chip" href="/daily-performance">
            Open production
          </Link>
        </div>

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

function ProfileSummary({ buffalo }: { buffalo: BuffaloDetail }) {
  return (
    <div className="card">
      <h2 className="section-title">Buffalo profile</h2>
      <p className="sub">Code: <b>{buffalo.buffalo_code}</b></p>
      <p className="sub">Breed: {buffalo.breed || '—'}</p>
      <p className="sub">
        Age at purchase: {buffalo.age_at_purchase_months == null ? '—' : `${buffalo.age_at_purchase_months} months`}
      </p>
      <p className="sub">Color: {buffalo.color || '—'}</p>
      <p className="sub">Identification: {buffalo.identification_mark || '—'}</p>
      <p className="sub">Notes: {buffalo.notes || '—'}</p>
    </div>
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
        Purchase price: {purchase ? money(Number(purchase.purchase_price)) : '—'} · Paid:{' '}
        {purchase ? money(Number(purchase.amount_paid)) : '—'}
      </p>
      <p className="sub">
        Vendor: {purchase?.vendors?.name ?? '—'}
        {purchase?.vendors?.mobile ? ` · ${purchase.vendors.mobile}` : ''}
      </p>
      <p className="sub">
        Location: {purchase?.vendors?.village_city ?? purchase?.vendors?.address ?? '—'}
        {purchase?.vendors?.state ? `, ${purchase.vendors.state}` : ''}
      </p>
      <p className="sub">Vendor mobile: {purchase?.vendors?.mobile ?? '—'}</p>
      <p className="sub">
        Payment type: {paymentTypeLabel(purchase?.payment_status)} · Udhaar due:{' '}
        {formatDate(purchase?.payment_due_date)}
      </p>
      <p className="sub">Udhaar terms: {purchase?.payment_terms ?? '—'}</p>
      <p className="sub">Reference: {purchase?.transaction_reference ?? '—'}</p>
      <p className="sub">Purchase notes: {purchase?.notes ?? '—'}</p>
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
    milk_quantity: number | string;
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
