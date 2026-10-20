'use client';

import Link from 'next/link';

import { money, milkTxt } from '@/lib/farm-format';

export type MilkMarginSummary = {
  milkLitresSold: number;
  milkSalesRevenue: number;
  feedConsumptionCost: number;
  feedConsumptionEntries: number;
  uncostedFeedConsumptionEntries: number;
};

type MilkMarginAfterFeedCardProps = {
  loading: boolean;
  summary: MilkMarginSummary | null;
  periodLabel?: string;
  error?: string;
};

export function MilkMarginAfterFeedCard({
  loading,
  summary,
  periodLabel = 'This month',
  error,
}: MilkMarginAfterFeedCardProps) {
  const uncostedEntries = summary?.uncostedFeedConsumptionEntries ?? 0;
  const margin = summary ? summary.milkSalesRevenue - summary.feedConsumptionCost : 0;
  const hasUncostedEntries = uncostedEntries > 0;
  const canCalculate = Boolean(summary) && !hasUncostedEntries;
  const perLitre = summary && summary.milkLitresSold > 0 ? margin / summary.milkLitresSold : null;

  return (
    <section className="card mb-4 border-l-4" style={{ borderLeftColor: '#267653' }}>
      <div className="row mb-3">
        <div>
          <p className="eyebrow mb-1">Farm profitability indicator</p>
          <h2 className="section-title mb-1">Milk margin after feed</h2>
          <p className="kpi-foot">{periodLabel} · Farm-wide, independent of the customer filter</p>
        </div>
        <Link href="/feeds/consumption" className="text-sm font-medium text-[var(--green)]">
          Feed consumption →
        </Link>
      </div>
      {loading ? <div className="empty">Calculating farm milk margin…</div>
        : error ? <p className="auth-message">{error}</p>
          : !summary ? <div className="empty">No milk margin summary returned for this range.</div>
            : <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg bg-[var(--paper)] p-4">
                  <div className="kpi-label">MARGIN AFTER FEED</div>
                  <div className="kpi-value">{canCalculate ? money(margin) : '—'}</div>
                  <div className="kpi-foot">{hasUncostedEntries ? 'Incomplete: some feed costs are missing' : 'Revenue minus feed consumed'}</div>
                </div>
                <div className="rounded-lg bg-[var(--paper)] p-4">
                  <div className="kpi-label">MILK SALES REVENUE</div>
                  <div className="kpi-value">{money(summary.milkSalesRevenue)}</div>
                  <div className="kpi-foot">{milkTxt(summary.milkLitresSold)} sold farm-wide</div>
                </div>
                <div className="rounded-lg bg-[var(--paper)] p-4">
                  <div className="kpi-label">FEED CONSUMPTION COST</div>
                  <div className="kpi-value">{canCalculate ? money(summary.feedConsumptionCost) : '—'}</div>
                  <div className="kpi-foot">{summary.feedConsumptionEntries} consumption entries</div>
                </div>
                <div className="rounded-lg bg-[var(--paper)] p-4">
                  <div className="kpi-label">MARGIN PER LITRE</div>
                  <div className="kpi-value">
                    {!canCalculate || perLitre === null ? '—' : money(perLitre)}
                  </div>
                  <div className="kpi-foot">After feed cost only</div>
                </div>
              </div>
              {hasUncostedEntries && (
                <p className="auth-message mt-3">
                  Margin hidden because {uncostedEntries} feed consumption {uncostedEntries === 1 ? 'entry has' : 'entries have'} no recorded cost.
                </p>
              )}
              <p className="kpi-foot mt-3">
                Feed cost uses inventory movement cost snapshots. This is not net farm profit; other operating costs are excluded.
              </p>
            </>}
    </section>
  );
}
