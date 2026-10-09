'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { KPI } from '@/components/ui/KPI';
import { supabase } from '@/lib/supabase';
import { money, todayLocal } from '@/app/(protected)/expenses/shared';

type BuffaloSaleSummary = {
  buffalo_sale_revenue: number | string;
  buffalo_sale_collections: number | string;
  buffalo_sale_outstanding: number | string;
  buffalo_sales_count: number | string;
  buffalo_sale_outstanding_as_of: number | string;
};

type FinancialSummary = {
  milk_quantity_sold: number | string;
  milk_sales_revenue: number | string;
  customer_collections: number | string;
  operating_expenses: number | string;
  dated_expense_payments: number | string;
  customer_receivables: number | string;
  customer_credits: number | string;
  supplier_outstanding: number | string;
  buffalo_purchase_cost: number | string;
  buffalo_purchase_payments: number | string;
  buffalo_purchase_outstanding: number | string;
  legacy_undated_paid_amount: number | string;
  customer_receivables_as_of: number | string;
  customer_credits_as_of: number | string;
  supplier_outstanding_as_of_before_legacy: number | string;
  supplier_legacy_undated_paid_amount: number | string;
  buffalo_purchase_outstanding_as_of_before_legacy: number | string;
  buffalo_purchase_legacy_undated_paid_amount: number | string;
};

export default function FinancialReportsPage() {
  const today = todayLocal();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [saleSummary, setSaleSummary] = useState<BuffaloSaleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) {
        setError('Supabase is not configured.');
        setSummary(null);
        setSaleSummary(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      if (!from || !to || from > to) {
        setSummary(null);
        setSaleSummary(null);
        setError('Choose a valid date range.');
        setLoading(false);
        return;
      }
      const [financialResult, saleResult] = await Promise.all([
        supabase.rpc('get_farm_financial_summary', { p_from: from, p_to: to }),
        supabase.rpc('get_buffalo_sale_financial_summary', { p_from: from, p_to: to }),
      ]);
      if (!active) return;
      if (financialResult.error || saleResult.error) {
        setError(financialResult.error?.message ?? saleResult.error?.message ?? 'Could not load financial summary.');
        setSummary(null);
        setSaleSummary(null);
      } else {
        setSummary((financialResult.data?.[0] ?? null) as FinancialSummary | null);
        setSaleSummary((saleResult.data?.[0] ?? null) as BuffaloSaleSummary | null);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [from, to]);

  const value = (key: keyof FinancialSummary) => Number(summary?.[key] ?? 0);
  const saleValue = (key: keyof BuffaloSaleSummary) => Number(saleSummary?.[key] ?? 0);

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
        <p className="kpi-foot">Period metrics use the selected dates. Current balances include all activity; historical balances are measured at the end date ({to}). Legacy undated payments are shown separately instead of being assigned invented dates.</p>
      </div>
      {error && <p className="auth-message">{error}</p>}
      <div className="grid kpis" style={{ marginTop: 15 }}>
        <KPI label="MILK SALES REVENUE" value={loading ? '…' : money(value('milk_sales_revenue'))} foot="Based on milk entry business dates" />
        <KPI label="MILK SOLD" value={loading ? '…' : `${value('milk_quantity_sold').toLocaleString('en-IN', { maximumFractionDigits: 3 })} L`} foot="Selected period" />
        <KPI label="CUSTOMER COLLECTIONS" value={loading ? '…' : money(value('customer_collections'))} foot="Payments received in selected period" />
        <KPI label="OPERATING EXPENSES" value={loading ? '…' : money(value('operating_expenses'))} foot="Expense business dates in selected period" />
      </div>
      <div className="grid kpis">
        <KPI label="CUSTOMER RECEIVABLES AT PERIOD END" value={loading ? '…' : money(value('customer_receivables_as_of'))} foot={'Balance as of ' + to} />
        <KPI label="CUSTOMER CREDITS AT PERIOD END" value={loading ? '…' : money(value('customer_credits_as_of'))} foot={'Balance as of ' + to} />
        <KPI label="DATED EXPENSE PAYMENTS" value={loading ? '…' : money(value('dated_expense_payments'))} foot="Payments entered in the new payment ledger" />
        <KPI label="CUSTOMER RECEIVABLES" value={loading ? '…' : money(value('customer_receivables'))} foot="Amounts owed across customers" accent />
        <KPI label="CUSTOMER CREDITS" value={loading ? '…' : money(value('customer_credits'))} foot="Advance balances held for customers" />
        <KPI label="SUPPLIER OUTSTANDING (CURRENT)" value={loading ? '…' : money(value('supplier_outstanding'))} foot="Current unpaid expense balances" />
        <KPI label="SUPPLIER BALANCE AT PERIOD END" value={loading ? '…' : money(value('supplier_outstanding_as_of_before_legacy'))} foot="Before undated legacy payments" />
        <KPI label="LEGACY PAID AMOUNTS" value={loading ? '…' : money(value('legacy_undated_paid_amount'))} foot="Previously recorded payments without dated ledger entries" />
      </div>
      <div className="grid kpis">
        <KPI label="BUFFALO SALE PROCEEDS" value={loading ? '…' : money(saleValue('buffalo_sale_revenue'))} foot={`${saleValue('buffalo_sales_count')} sales in selected period`} />
        <KPI label="BUFFALO SALE COLLECTIONS" value={loading ? '…' : money(saleValue('buffalo_sale_collections'))} foot="Payments received in selected period" />
        <KPI label="BUFFALO SALE OUTSTANDING (CURRENT)" value={loading ? '…' : money(saleValue('buffalo_sale_outstanding'))} foot="Current unpaid sale balances" accent />
        <KPI label="BUFFALO SALE OUTSTANDING AT PERIOD END" value={loading ? '…' : money(saleValue('buffalo_sale_outstanding_as_of'))} foot={'Balance as of ' + to} />
        <KPI label="BUFFALO PURCHASE COST" value={loading ? '…' : money(value('buffalo_purchase_cost'))} foot="Purchases dated in selected period" />
        <KPI label="BUFFALO PURCHASE PAYMENTS" value={loading ? '…' : money(value('buffalo_purchase_payments'))} foot="Payments made in selected period" />
        <KPI label="BUFFALO PURCHASE OUTSTANDING (CURRENT)" value={loading ? '…' : money(value('buffalo_purchase_outstanding'))} foot="Current unpaid acquisition balance" accent />
        <KPI label="BUFFALO PURCHASE BALANCE AT PERIOD END" value={loading ? '…' : money(value('buffalo_purchase_outstanding_as_of_before_legacy'))} foot="Before undated legacy payments" />
        <KPI label="BUFFALO PURCHASE LEGACY PAYMENTS" value={loading ? '…' : money(value('buffalo_purchase_legacy_undated_paid_amount'))} foot="Undated initial/legacy paid amounts" />
      </div>
      <div className="card" style={{ marginTop: 15 }}>
        <h2 className="section-title">How to interpret this report</h2>
        <ul className="list">
          <li>Sales revenue is not the same as cash collected. Customer collections are shown separately.</li>
          <li>Operating expenses use the expense business date; dated expense payments use the actual payment date entered in the new ledger.</li>
          <li>Historical supplier and buffalo-purchase balances are shown before undated legacy payments; those amounts are separated because their original dates were not stored. They are not assigned fabricated dates.</li>
          <li>Feed purchases are already linked to expenses, so they are not added a second time. Buffalo purchases are shown separately as asset acquisitions and are not included in operating expenses.</li>
          <li>Buffalo purchases and sale proceeds are asset transactions shown separately from operating expenses. Sale collections use the payment date; sale receivables are current all-time balances.</li>
          <li>This is a reconciliation summary, not a formal net-profit statement. Feed consumption costing and other accounting adjustments are not yet included.</li>
        </ul>
      </div>
    </AppShell>
  );
}
