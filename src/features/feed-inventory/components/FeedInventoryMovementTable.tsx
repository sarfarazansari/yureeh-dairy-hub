'use client';

import type { FeedInventoryMovementRow } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Props = {
  rows: FeedInventoryMovementRow[];
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

const money = (value: number | string | null) =>
  `₹${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const movementLabel = (value: string) => value.replaceAll('_', ' ');
function movementSign(type: string) {
  return ['PURCHASE', 'ADJUSTMENT_IN'].includes(type) ? '+' : '−';
}
function sourceLabel(value: string | null) {
  if (!value) return 'Manual / unspecified';
  return value.replaceAll('_', ' ');
}

export function FeedInventoryMovementTable({ rows, count, page, pageSize, onPageChange, onPageSizeChange, loading = false, error, onRetry }: Props) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const start = count ? page * pageSize + 1 : 0;
  const end = Math.min((page + 1) * pageSize, count);
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title mb-0">Movement history</h2>
        <Badge variant="secondary">{count} movements</Badge>
      </div>
      {error ? (
        <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm">
          <p>{error}</p>
          {onRetry && <Button className="mt-3" type="button" variant="outline" size="sm" onClick={onRetry}>Retry</Button>}
        </div>
      ) : (
        <>
          <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]" aria-busy={loading}>
            <Table className="min-w-[900px] [&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
              <TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>FEED ITEM</TableHead><TableHead>MOVEMENT</TableHead><TableHead>QUANTITY</TableHead><TableHead>UNIT COST</TableHead><TableHead>VALUE</TableHead><TableHead>SOURCE</TableHead><TableHead>NOTES</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>{Array.from({ length: 8 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-4 w-24" /></TableCell>)}</TableRow>) : rows.map((row) => {
                  const incoming = movementSign(row.movement_type) === '+';
                  return <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{new Date(row.occurred_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                    <TableCell><b>{row.feed_item_name}</b><div className="text-xs text-muted-foreground">{row.base_unit}</div></TableCell>
                    <TableCell><Badge variant={incoming ? 'secondary' : 'outline'}>{movementLabel(row.movement_type)}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap"><b>{movementSign(row.movement_type)}{Number(row.quantity).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {row.base_unit}</b></TableCell>
                    <TableCell>{row.unit_cost === null ? '—' : money(row.unit_cost)}</TableCell>
                    <TableCell>{money((incoming ? 1 : -1) * Number(row.quantity) * Number(row.unit_cost ?? 0))}</TableCell>
                    <TableCell><span>{sourceLabel(row.source_type)}</span>{row.source_id && <div className="text-xs text-muted-foreground">{row.source_id.slice(0, 8)}</div>}</TableCell>
                    <TableCell>{row.notes || '—'}{row.reversal_of_movement_id && <div className="text-xs text-muted-foreground">Reversal of {row.reversal_of_movement_id.slice(0, 8)}</div>}</TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </div>
          {!loading && !rows.length && <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No inventory movements match these filters.</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
            <p className="text-sm text-muted-foreground">Showing {start}–{end} of {count}</p>
            <div className="flex flex-wrap items-center gap-2"><label className="text-sm text-muted-foreground" htmlFor="feed-movement-page-size">Rows</label><Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}><SelectTrigger id="feed-movement-page-size" className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="20">20 per page</SelectItem><SelectItem value="50">50 per page</SelectItem><SelectItem value="100">100 per page</SelectItem></SelectContent></Select>
              <Button type="button" variant="outline" size="sm" disabled={loading || page <= 0} onClick={() => onPageChange(page - 1)}>Previous</Button>
              <span className="min-w-24 text-center text-sm text-muted-foreground">Page {page + 1} of {pages}</span>
              <Button type="button" variant="outline" size="sm" disabled={loading || page >= pages - 1} onClick={() => onPageChange(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
