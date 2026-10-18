'use client';

import Link from 'next/link';

import { money, milkTxt } from '@/lib/farm-format';
import type { DashboardMilkMargin } from '../services/dashboard.service';

type MilkMarginAfterFeedCardProps = {
  loading: boolean;
  summary: DashboardMilkMargin | null;
};

export function MilkMarginAfterFeedCard({ loading, summary }: MilkMarginAfterFeedCardProps) {
  const hasUncostedEntries = (summary?.uncostedFeedConsumptionEntries ?? 0) > 0;
  const margin = summary ? summary.milkSalesRevenue - summary.feedConsumptionCost : 0;
  const perLitre = summary && summary.milkLitresSold > 0 ? margin / summary.milkLitresSold : null;
  const feedCost = hasUncostedEntries ? '—' : summary ? money(summary.feedConsumptionCost) : '—';
  const marginValue = hasUncostedEntries ? '—' : summary ? money(margin) : '—';
  const perLitreValue = hasUncostedEntries || perLitre === null ? '—' : money(perLitre);
  const consumptionFoot = loading
    ? 'Loading consumption cost'
    : hasUncostedEntries
      ? 'Some entries have no cost'
      : summary?.feedConsumptionEntries
        ? String(summary.feedConsumptionEntries) + ' consumption entries'
        : 'No feed consumption recorded';
  const detailFoot = loading
    ? 'Calculating from milk sales and feed inventory consumption.'
    : hasUncostedEntries
      ? 'Margin unavailable: ' + String(summary?.uncostedFeedConsumptionEntries) +
        ' feed consumption entr' +
        (summary?.uncostedFeedConsumptionEntries === 1 ? 'y has' : 'ies have') +
        ' no recorded cost.'
      : summary?.feedConsumptionEntries
        ? 'Feed cost uses actual consumption and its inventory cost snapshot. Setup and one-time expenses are excluded.'
        : 'No feed consumption is recorded for this month; the margin is not a reliable profitability measure yet.';

  return (
    <div className="card">
      <div className="row">
        <h2 className="section-title">Milk margin after feed · This month</h2>
        <Link href="/feeds/consumption" style={{ fontSize: 10, color: '#277452' }}>
          View feed consumption →
        </Link>
      </div>
      <div className="grid four">
        <div>
          <div className="kpi-label">MILK SALES</div>
          <b>{loading ? '…' : summary ? money(summary.milkSalesRevenue) : '—'}</b>
          <div className="kpi-foot">{loading ? 'Loading monthly sales' : milkTxt(summary?.milkLitresSold ?? 0) + ' sold'}</div>
        </div>
        <div>
          <div className="kpi-label">FEED CONSUMED</div>
          <b>{loading ? '…' : feedCost}</b>
          <div className="kpi-foot">{consumptionFoot}</div>
        </div>
        <div>
          <div className="kpi-label">MARGIN AFTER FEED</div>
          <b style={{ color: !hasUncostedEntries && summary ? (margin >= 0 ? '#267052' : '#b42318') : undefined }}>
            {loading ? '…' : marginValue}
          </b>
          <div className="kpi-foot">Sales minus recorded feed cost</div>
        </div>
        <div>
          <div className="kpi-label">MARGIN PER LITRE SOLD</div>
          <b>{loading ? '…' : perLitreValue}</b>
          <div className="kpi-foot">After feed cost only</div>
        </div>
      </div>
      <div className="kpi-foot" style={{ marginTop: 12 }}>{detailFoot}</div>
    </div>
  );
}
