import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/date-format';

export type MixedMilkFatHistoryRow = {
  businessDate: string;
  morningFat?: number | null;
  eveningFat?: number | null;
};

type MixedMilkFatHistoryTableProps = {
  rows: MixedMilkFatHistoryRow[];
  className?: string;
};

/**
 * Canonical farm-pool fat history table shared by Milk Pool, Sales Analytics, and Buffalo Analytics.
 * Keep date formatting and table structure identical across both routes.
 */
export function MixedMilkFatHistoryTable({ rows, className }: MixedMilkFatHistoryTableProps) {
  return (
    <div className={`w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)] ${className ?? ''}`.trim()}>
      <Table className="min-w-[420px] [&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
        <TableHeader>
          <TableRow>
            <TableHead>DATE</TableHead>
            <TableHead>MORNING FAT</TableHead>
            <TableHead>EVENING FAT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.businessDate}>
              <TableCell className="whitespace-nowrap">{formatDate(row.businessDate, 'D MMMM YYYY')}</TableCell>
              <TableCell>{row.morningFat == null ? '—' : `${row.morningFat.toFixed(2)}%`}</TableCell>
              <TableCell>{row.eveningFat == null ? '—' : `${row.eveningFat.toFixed(2)}%`}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
