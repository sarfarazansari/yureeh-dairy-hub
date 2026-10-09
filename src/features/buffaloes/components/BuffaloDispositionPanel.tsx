'use client';

import { formatDate } from '@/lib/date-format';
import { money } from '@/lib/farm-format';
import {
  useBuffaloDisposal,
  useBuffaloSale,
  useBuffaloSalePayments,
} from '../hooks/use-buffaloes';
import type { BuffaloDetail } from '../types';
import { BuffaloDisposalForm } from './BuffaloDisposalForm';
import { BuffaloSaleForm } from './BuffaloSaleForm';
import { BuffaloSalePaymentForm } from './BuffaloSalePaymentForm';

export function BuffaloDispositionPanel({ buffalo, mode = 'all' }: { buffalo: BuffaloDetail; mode?: 'all' | 'sale' }) {
  const saleQuery = useBuffaloSale(buffalo.id);
  const paymentsQuery = useBuffaloSalePayments(buffalo.id);
  const disposalQuery = useBuffaloDisposal(buffalo.id);
  const sale = saleQuery.data;
  const disposal = disposalQuery.data;

  if (saleQuery.isPending || disposalQuery.isPending) {
    return <div className="card"><h2 className="section-title">Sale and disposal</h2><div className="empty">Loading disposition records…</div></div>;
  }
  if (saleQuery.isError || disposalQuery.isError) {
    return <div className="card"><h2 className="section-title">Sale and disposal</h2><div className="empty">{saleQuery.error?.message ?? disposalQuery.error?.message}</div></div>;
  }

  if (sale) {
    return (
      <div className="management-stack">
        <div className="card">
          <h2 className="section-title">Sale record</h2>
          <div className="grid two">
            <p className="sub">Sale date: <b>{formatDate(sale.sale_date)}</b></p>
            <p className="sub">Buyer: <b>{sale.buyer_name}</b></p>
            <p className="sub">Buyer mobile: {sale.buyer_mobile || '—'}</p>
            <p className="sub">Buyer location: {sale.buyer_location || '—'}</p>
            <p className="sub">Sale price: <b>{money(Number(sale.sale_price))}</b></p>
            <p className="sub">Carrying value at sale: <b>{sale.carrying_value_at_sale == null ? "Not calculated" : money(Number(sale.carrying_value_at_sale))}</b></p>
            <p className="sub">{sale.gain_loss_amount != null && Number(sale.gain_loss_amount) < 0 ? "Loss on sale" : "Gain on sale"}: <b>{sale.gain_loss_amount == null ? "Not calculated" : money(Math.abs(Number(sale.gain_loss_amount)))}</b></p>
            <p className="sub">Received: <b>{money(Number(sale.amount_received))}</b></p>
            <p className="sub">Outstanding: <b>{money(Number(sale.amount_pending))}</b></p>
            <p className="sub">Payment status: <b>{sale.payment_status}</b></p>
            <p className="sub">Due date: {formatDate(sale.payment_due_date)}</p>
            <p className="sub">Terms: {sale.payment_terms || '—'}</p>
            <p className="sub">Reference: {sale.transaction_reference || '—'}</p>
            <p className="sub">Notes: {sale.notes || '—'}</p>
          </div>
        </div>
        <div className="grid two">
          <BuffaloSalePaymentForm saleId={sale.id} pending={Number(sale.amount_pending)} />
          <div className="card">
            <h2 className="section-title">Sale payment history</h2>
            {paymentsQuery.isPending ? <div className="empty">Loading payments…</div> : paymentsQuery.isError ? <div className="empty">{paymentsQuery.error.message}</div> : paymentsQuery.data?.length ? (
              <div className="table-wrap"><table className="table"><thead><tr><th>DATE</th><th>AMOUNT</th><th>METHOD</th><th>REFERENCE / NOTES</th></tr></thead><tbody>
                {paymentsQuery.data.map((payment) => <tr key={payment.id}><td>{formatDate(payment.payment_date)}</td><td>{money(Number(payment.amount))}</td><td>{payment.payment_method}</td><td>{[payment.transaction_reference, payment.notes].filter(Boolean).join(' · ') || '—'}</td></tr>)}
              </tbody></table></div>
            ) : <div className="empty">No sale payments recorded.</div>}
          </div>
        </div>
      </div>
    );
  }

  if (disposal) {
    return (
      <div className="card">
        <h2 className="section-title">Disposal record</h2>
        <p className="sub">Type: <b>{disposal.disposal_type.replace('_', ' ')}</b></p>
        <p className="sub">Effective date: <b>{formatDate(disposal.effective_date)}</b></p>
        <p className="sub">Reason: {disposal.reason}</p>
        <p className="sub">Carrying value at disposal: <b>{disposal.carrying_value_at_disposal == null ? "Not calculated" : money(Number(disposal.carrying_value_at_disposal))}</b></p>
        <p className="sub">Disposal loss: <b>{disposal.disposal_loss_amount == null ? "Not calculated" : money(Number(disposal.disposal_loss_amount))}</b></p>
        <p className="sub">Notes: {disposal.notes || '—'}</p>
      </div>
    );
  }

  if (!['ACTIVE', 'DRY'].includes(buffalo.current_status)) {
    return (
      <div className="card">
        <h2 className="section-title">Sale and disposal</h2>
        <p className="sub">This buffalo is marked <b>{buffalo.current_status}</b>, but no matching sale or disposal transaction exists. Review its legacy status before recording a new transaction.</p>
      </div>
    );
  }

  if (mode === 'sale') return <BuffaloSaleForm buffalo={buffalo} />;

  return (
    <div className="grid two">
      <BuffaloSaleForm buffalo={buffalo} />
      <BuffaloDisposalForm buffalo={buffalo} />
    </div>
  );
}
