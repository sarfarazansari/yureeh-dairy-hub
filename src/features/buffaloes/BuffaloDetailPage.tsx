'use client';

import { money, milkTxt } from '@/lib/farm-format';
import { getBuffaloProductionHistory, type BuffaloProductionHistoryRecord } from '@/features/buffalo-production/services/buffalo-production.service';
import { changeBuffaloStatus, getBuffaloDetails, recordBuffaloPurchasePayment, type BuffaloDetail } from './services/buffalo.service';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { KPI } from '@/components/ui/KPI';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate } from '@/lib/date-format';

const statuses = ['ACTIVE', 'DRY', 'SOLD', 'DECEASED', 'OTHER'] as const;
const paymentMethods = ['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'] as const;

export default function BuffaloDetailPage({ code }: { code: string }) {
  const [b, setB] = useState<BuffaloDetail | null>(null);
  const [rows, setRows] = useState<BuffaloProductionHistoryRecord[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<(typeof statuses)[number]>('ACTIVE');
  const [statusDate, setStatusDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusNotes, setStatusNotes] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  async function load() {
    if (!supabase) return;
    const buffalo = await getBuffaloDetails(supabase, code);
    setB(buffalo);
    if (buffalo) {
      setStatus(buffalo.current_status as (typeof statuses)[number]);
      setRows(await getBuffaloProductionHistory(supabase, buffalo.id));
    }
  }

  useEffect(() => {
    void load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load buffalo details.'));
  }, [code]);

  async function saveStatus() {
    if (!supabase || !b || status === b.current_status) return;
    setBusy(true); setError('');
    try { await changeBuffaloStatus(supabase, b.id, status, statusDate, statusNotes); setStatusNotes(''); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not change buffalo status.'); }
    finally { setBusy(false); }
  }

  async function savePayment() {
    if (!supabase || !b) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid payment amount.'); return; }
    const pending = Number(b.buffalo_purchases[0]?.amount_pending ?? 0);
    if (amount > pending) { setError('Payment cannot be greater than the pending purchase balance.'); return; }
    setBusy(true); setError('');
    try {
      await recordBuffaloPurchasePayment(supabase, b.id, {
        payment_date: paymentDate, amount, payment_method: paymentMethod,
        transaction_reference: paymentReference, notes: paymentNotes,
      });
      setPaymentAmount(''); setPaymentReference(''); setPaymentNotes(''); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not record purchase payment.'); }
    finally { setBusy(false); }
  }

  const purchase = b?.buffalo_purchases?.[0];
  const total = rows.reduce((sum, row) => sum + Number(row.milk_quantity), 0);
  const days = new Set(rows.map((row) => row.business_date)).size;
  const daily = Array.from(new Set(rows.map((row) => row.business_date))).sort().map((date) => {
    const dated = rows.filter((row) => row.business_date === date);
    return {
      date,
      morning: dated.filter((row) => row.shift === 'MORNING').reduce((sum, row) => sum + Number(row.milk_quantity), 0),
      evening: dated.filter((row) => row.shift === 'EVENING').reduce((sum, row) => sum + Number(row.milk_quantity), 0),
    };
  });
  const trend = daily.map((row) => ({ ...row, date: formatDate(row.date, 'D MMM'), milk: row.morning + row.evening }));

  return (
    <AppShell title={b?.name ? `${b.buffalo_code} — ${b.name}` : (b?.buffalo_code ?? 'Buffalo details')} subtitle={`${b?.breed ?? 'Breed not entered'} · ${b?.current_status ?? ''}`}>
      <Link href="/buffaloes" style={{ fontSize: 12, color: '#277452' }}>← All buffaloes</Link>
      {error && <p className="auth-message" role="alert">{error}</p>}

      <div className="grid kpis">
        <KPI label="TOTAL MILK PRODUCED" value={milkTxt(total)} foot={`${days} days with records`} />
        <KPI label="AVG PER RECORDED DAY" value={days ? milkTxt(total / days) : '—'} foot="Recorded production days" />
        <KPI label="PRODUCTION RECORDS" value={String(rows.length)} foot="One row per date and shift" />
        <KPI label="BALANCE DUE" value={purchase ? money(Number(purchase.amount_pending)) : '—'} foot={purchase ? `Paid ${money(Number(purchase.amount_paid))} of ${money(Number(purchase.purchase_price))}` : 'No purchase record'} />
      </div>

      <div className="grid two">
        <div className="card">
          <h2 className="section-title">Milk production trend</h2>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid vertical={false} stroke="#eef1ed" /><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#9ba69f' }} /><YAxis hide /><Tooltip />
                <Area type="monotone" dataKey="milk" name="Total milk" stroke="#267052" fill="#367d5d22" />
                <Area type="monotone" dataKey="morning" name="Morning" stroke="#d7a85e" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2 className="section-title">Purchase and vendor</h2>
          <p className="sub">Purchase date: {formatDate(purchase?.purchase_date)}</p>
          <p className="sub">Vendor: {purchase?.vendors?.name ?? '—'} {purchase?.vendors?.mobile ? `· ${purchase.vendors.mobile}` : ''}</p>
          <p className="sub">Purchase location: {purchase?.vendors?.village_city ?? purchase?.vendors?.address ?? '—'}</p>
          <p className="sub">Payment type: {purchase?.payment_status === 'PAID' ? 'Paid in Full' : purchase?.payment_status === 'PARTIAL' ? 'Partial Credit' : purchase?.payment_status === 'CREDIT' ? 'Full Credit' : '—'} · Udhaar due: {formatDate(purchase?.payment_due_date)}</p>
          <p className="sub">Udhaar terms: {purchase?.payment_terms ?? '—'}</p>
          <p className="sub">Identification: {b?.identification_mark ?? '—'} · Color: {b?.color ?? '—'}</p>
        </div>
      </div>

      <div style={{ height: 14 }} />
      <div className="grid two">
        <div className="card">
          <h2 className="section-title">Purchase payment</h2>
          <p className="sub">Pending: {money(Number(purchase?.amount_pending ?? 0))}</p>
          <div className="grid two">
            <div className="field"><label>Payment Date</label><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
            <div className="field"><label>Amount · ₹</label><input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></div>
            <div className="field"><label>Method</label><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as (typeof paymentMethods)[number])}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></div>
            <div className="field"><label>Reference</label><input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Optional transaction reference" /></div>
          </div>
          <div className="field"><label>Notes</label><input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Optional" /></div>
          <button className="btn" type="button" disabled={busy || !purchase || Number(purchase.amount_pending) <= 0} onClick={() => void savePayment()}>Record payment</button>
        </div>

        <div className="card">
          <h2 className="section-title">Buffalo status</h2>
          <p className="sub">Current status: <b>{b?.current_status ?? '—'}</b>. Changes are recorded as lifecycle history.</p>
          <div className="grid two">
            <div className="field"><label>Status</label><select value={status} onChange={(e) => setStatus(e.target.value as (typeof statuses)[number])}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></div>
            <div className="field"><label>Effective Date</label><input type="date" value={statusDate} onChange={(e) => setStatusDate(e.target.value)} /></div>
          </div>
          <div className="field"><label>Reason / Notes</label><input value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} placeholder="Optional" /></div>
          <button className="btn" type="button" disabled={busy || !b || status === b.current_status} onClick={() => void saveStatus()}>Save status change</button>
        </div>
      </div>

      <div style={{ height: 14 }} />
      <div className="card">
        <h2 className="section-title">Performance history</h2>
        <div className="table-wrap"><table className="table"><thead><tr><th>DATE</th><th>SHIFT</th><th>MILK</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}><td>{formatDate(row.business_date)}</td><td>{row.shift === 'MORNING' ? 'Morning' : 'Evening'}</td><td>{milkTxt(Number(row.milk_quantity))}</td></tr>)}
        </tbody></table></div>
        {!rows.length && <div className="empty">No performance records for this buffalo.</div>}
      </div>
    </AppShell>
  );
}
