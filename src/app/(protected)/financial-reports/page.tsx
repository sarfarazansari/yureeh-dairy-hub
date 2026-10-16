'use client';

import { Label } from '@/components/ui/label';

import { useState } from 'react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { AppShell } from '@/components/layout/AppShell';
import { KPI } from '@/components/ui/KPI';
import { useFinancialReportQuery } from '@/features/financial-reports/financial-reports.queries';
import type { BuffaloSaleSummary, FinancialSummary } from '@/features/financial-reports/services/financial-reports.service';
import { money, todayLocal } from '@/app/(protected)/expenses/shared';

export default function FinancialReportsPage() {
  const today = todayLocal();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const reportQuery = useFinancialReportQuery(from, to);
  const summary = reportQuery.data?.summary ?? null;
  const saleSummary = reportQuery.data?.saleSummary ?? null;
  const validRange = Boolean(from && to && from <= to);
  const loading = validRange && reportQuery.isPending;
  const error = !validRange
    ? 'Choose a valid date range.'
    : reportQuery.error?.message ?? '';

  const value = (key: keyof FinancialSummary) => Number(summary?.[key] ?? 0);
  const saleValue = (key: keyof BuffaloSaleSummary) => Number(saleSummary?.[key] ?? 0);

  return (
    <AppShell
      title="Financial reconciliation"
      subtitle="Separate sales, collections, expenses and outstanding balances"
    >
      <div className="card">
        <div className="max-w-md"><Label className="mb-2 block">Date range</Label><DateRangePicker from={from} to={to} max={today} onChange={({ from: nextFrom, to: nextTo }) => { setFrom(nextFrom); setTo(nextTo); }} />
          {from && to && from > to && <p role="alert" className="auth-message">Start date must be on or before end date.</p>}</div>
        <p className="kpi-foot">Period metrics use the selected dates. Current balances include all activity; historical balances are measured at the end date ({to}). Legacy undated payments are shown separately instead of being assigned invented dates.</p>
      </div>
      {error && <p role="alert" className="auth-message">{error}</p>}
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
