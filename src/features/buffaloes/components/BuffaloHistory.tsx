import { formatDate } from '@/lib/date-format';
import { money } from '@/lib/farm-format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
          <Table className="min-w-[650px]">
            <TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>AMOUNT</TableHead><TableHead>METHOD</TableHead><TableHead>REFERENCE</TableHead><TableHead>NOTES</TableHead></TableRow></TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatDate(payment.payment_date)}</TableCell>
                  <TableCell>{money(payment.amount)}</TableCell>
                  <TableCell>{payment.payment_method}</TableCell>
                  <TableCell>{payment.transaction_reference || '—'}</TableCell>
                  <TableCell>{payment.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
          <Table className="min-w-[500px]">
            <TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>STATUS</TableHead><TableHead>REASON / NOTES</TableHead></TableRow></TableHeader>
            <TableBody>
              {history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDate(item.effective_date)}</TableCell>
                  <TableCell><span className="tag">{item.status}</span></TableCell>
                  <TableCell>{item.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
