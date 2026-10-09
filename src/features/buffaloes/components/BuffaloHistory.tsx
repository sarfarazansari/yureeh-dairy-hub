import { formatDate } from '@/lib/date-format';
import { money } from '@/lib/farm-format';

import type { BuffaloPurchasePayment, BuffaloStatusHistory } from '../types';

export function BuffaloPaymentHistory({
  payments,
}: {
  payments: BuffaloPurchasePayment[];
}) {
  return (
    <HistoryCard title="Payment history">
      {payments.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>AMOUNT</th>
                <th>METHOD</th>
                <th>REFERENCE</th>
                <th>NOTES</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatDate(payment.payment_date)}</td>
                  <td>{money(payment.amount)}</td>
                  <td>{payment.payment_method}</td>
                  <td>{payment.transaction_reference || '—'}</td>
                  <td>{payment.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No later payment records.</div>
      )}
    </HistoryCard>
  );
}

export function BuffaloStatusHistory({
  history,
}: {
  history: BuffaloStatusHistory[];
}) {
  return (
    <HistoryCard title="Lifecycle history">
      {history.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>STATUS</th>
                <th>REASON / NOTES</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.effective_date)}</td>
                  <td><span className="tag">{item.status}</span></td>
                  <td>{item.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No lifecycle history.</div>
      )}
    </HistoryCard>
  );
}

function HistoryCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <h2 className="section-title">{title}</h2>
      {children}
    </div>
  );
}
