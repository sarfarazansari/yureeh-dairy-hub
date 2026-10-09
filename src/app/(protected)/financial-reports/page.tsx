'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { KPI } from '@/components/ui/KPI';
import { supabase } from '@/lib/supabase';
import { money, todayLocal } from '@/app/(protected)/expenses/shared';

type FinancialSummary = {
  milk_quantity_sold: number | string;
  milk_sales_revenue: number | string;
  customer_collections: number | string;
  operating_expenses: number | string;
  dated_expense_payments: number | string;
  customer_net_receivable: number | string;
  supplier_outstanding: number | string;
  legacy_undated_paid_amount: number | string;
};

export default function FinancialReportsPage() {
  const today = todayLocal();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      if (!from || !to || from > to) {
        setSummary(null);
        setError('Choose a valid date range.');
        setLoading(false);
        return;
      }
      const { data, error: queryError } = await supabase.rpc('get_farm_financial_summary', {
        p_from: from,
        p_to: to,
      });
      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setSummary(null);
      } else {
        setSummary((data?.[0] ?? null) as FinancialSummary | null);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [from, to]);

  const value = (key: keyof FinancialSummary) => Number(summary?.[key] ?? 0);

  return (
    <AppShell
      title="Financial reconciliation"
      subtitle="Separate sales, collections, expenses and outstanding balances"
    >
      <div className="card">
        <div className="expense-form-grid">
          <div className="field">
            <label>From date</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>To date</label>
            <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <p className="kpi-foot">Period metrics use the selected dates. Outstanding balances are current all-time balances.</p>
      </div>
      {error && <p className="auth-message">{error}</p>}
      <div className="grid kpis" style={{ marginTop: 15 }}>
        <KPI label="MILK SALES REVENUE" value={loading ? '…' : money(value('milk_sales_revenue'))} foot="Based on milk entry business dates" />
        <KPI label="MILK SOLD" value={loading ? '…' : `${value('milk_quantity_sold').toLocaleString('en-IN', { maximumFractionDigits: 3 })} L`} foot="Selected period" />
        <KPI label="CUSTOMER COLLECTIONS" value={loading ? '…' : money(value('customer_collections'))} foot="Payments received in selected period" />
        <KPI label="OPERATING EXPENSES" value={loading ? '…' : money(value('operating_expenses'))} foot="Expense business dates in selected period" />
      </div>
      <div className="grid kpis">
        <KPI label="DATED EXPENSE PAYMENTS" value={loading ? '…' : money(value('dated_expense_payments'))} foot="Payments entered in the new payment ledger" />
        <KPI label="CUSTOMER NET RECEIVABLE" value={loading ? '…' : money(Math.max(0, value('customer_net_receivable')))} foot={value('customer_net_receivable') < 0 ? `Customer credit: ${money(Math.abs(value('customer_net_receivable')))}` : 'Current all-time net balance'} accent />
        <KPI label="SUPPLIER OUTSTANDING" value={loading ? '…' : money(value('supplier_outstanding'))} foot="Current unpaid expense balances" />
        <KPI label="LEGACY PAID AMOUNTS" value={loading ? '…' : money(value('legacy_undated_paid_amount'))} foot="Previously recorded payments without dated ledger entries" />
      </div>
      <div className="card" style={{ marginTop: 15 }}>
        <h2 className="section-title">How to interpret this report</h2>
        <ul className="list">
          <li>Sales revenue is not the same as cash collected. Customer collections are shown separately.</li>
          <li>Operating expenses use the expense business date; dated expense payments use the actual payment date entered in the new ledger.</li>
          <li>Legacy paid amounts are shown separately because their original payment dates were not stored. They are not assigned fabricated dates.</li>
          <li>Feed purchases are already linked to expenses, so they are not added a second time.</li>
          <li>This is a reconciliation summary, not a formal net-profit statement. Feed consumption costing and other accounting adjustments are not yet included.</li>
        </ul>
      </div>
    </AppShell>
  );
}
