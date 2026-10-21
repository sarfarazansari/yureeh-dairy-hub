'use client';
import { formatDate } from '@/lib/date-format';
import { useIsViewer } from '@/lib/farm-access';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MixedMilkFatHistoryTable } from './components/MixedMilkFatHistoryTable';

import { useMemo, useState } from 'react';

import { DatePicker } from '@/components/ui/date-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { AppShell } from '@/components/layout/AppShell';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { localDateKey, getMilkEntryPresetRange } from '@/lib/milk-entry-list';
import { milkTxt } from '@/lib/farm-format';

import {
  MILK_POOL_MOVEMENT_LABELS,
  MILK_POOL_MOVEMENT_TYPES,
  MILK_POOL_SHIFT_OPTIONS,
  type MilkPoolManualMovementType,
  type MilkPoolMovementDirection,
} from './milk.constants';
import {
  useMilkPoolReconciliationQuery,
  useMilkPoolShiftFatQuery,
  useRecordMilkPoolMovementMutation,
} from './milk.queries';

const formatLitres = (value: number) => milkTxt(Number(value || 0));

export default function MilkPoolPage() {
  const isViewer = useIsViewer();
  const defaultRange = getMilkEntryPresetRange('current-month');
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [businessDate, setBusinessDate] = useState(() => localDateKey());
  const [shift, setShift] = useState<'MORNING' | 'EVENING' | ''>('');
  const [movementType, setMovementType] =
    useState<MilkPoolManualMovementType>('HOUSEHOLD_USE');
  const [direction, setDirection] = useState<MilkPoolMovementDirection>('OUT');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  const reconciliationQuery = useMilkPoolReconciliationQuery(from, to);
  const fatQuery = useMilkPoolShiftFatQuery(from, to);
  const fatByDate = useMemo(() => {
    const grouped: Record<string, { MORNING?: number; EVENING?: number }> = {};
    for (const record of fatQuery.data ?? []) {
      if (record.shift !== 'MORNING' && record.shift !== 'EVENING') continue;
      grouped[record.business_date] ??= {};
      grouped[record.business_date][record.shift] = Number(record.fat_percentage);
    }
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [fatQuery.data]);
  const recordMutation = useRecordMilkPoolMovementMutation();
  const rows = reconciliationQuery.data ?? [];

  const totals = useMemo(
    () =>
      rows.reduce(
        (result, row) => ({
          production: result.production + Number(row.production_litres),
          delivery: result.delivery + Number(row.customer_delivery_litres),
          household: result.household + Number(row.household_use_litres),
          wastage: result.wastage + Number(row.wastage_litres),
          other: result.other + Number(row.other_use_litres),
          adjustmentIn: result.adjustmentIn + Number(row.adjustment_in_litres),
          adjustmentOut: result.adjustmentOut + Number(row.adjustment_out_litres),
        }),
        {
          production: 0,
          delivery: 0,
          household: 0,
          wastage: 0,
          other: 0,
          adjustmentIn: 0,
          adjustmentOut: 0,
        },
      ),
    [rows],
  );

  const openingBalance = rows.length ? Number(rows[0].opening_balance_litres) : 0;
  const closingBalance = rows.length ? Number(rows[rows.length - 1].closing_balance_litres) : openingBalance;

  async function recordMovement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const value = Number(quantity);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage('Enter a milk quantity greater than zero.');
      return;
    }
    if (movementType !== 'ADJUSTMENT' && direction !== 'OUT') {
      setMessage('Consumption movements must be OUT.');
      return;
    }

    try {
      await recordMutation.mutateAsync({
        businessDate,
        shift: shift || null,
        movementType,
        quantity: value,
        direction,
        notes,
      });
      setQuantity('');
      setNotes('');
      setMessage('Milk pool movement recorded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not record movement.');
    }
  }

  return (
    <AppShell
      title="Farm milk pool"
      subtitle="Reconcile production, customer deliveries and other milk consumption"
    >
      <div className="card">
        <div className="row production-controls">
          <div>
            <h2 className="section-title">Milk balance</h2>
            <p className="kpi-foot">
              Production comes from buffalo records. Customer deliveries are linked automatically.
              Household use, wastage, other use and adjustments are recorded separately.
            </p>
          </div>
          <Label className="field milk-pool-date-range">
            <span>Date range</span>
            <DateRangePicker
              from={from}
              to={to}
              max={localDateKey()}
              onChange={({ from: nextFrom, to: nextTo }) => {
                setFrom(nextFrom);
                setTo(nextTo);
              }}
              ariaLabel="Milk pool date range"
            />
          </Label>
        </div>

        <div className="grid three">
          <div className="card">
            <div className="eyebrow">OPENING POOL</div>
            <strong className="title">{formatLitres(openingBalance)}</strong>
            <p className="kpi-foot">Balance carried into the selected period.</p>
          </div>
          <div className="card">
            <div className="eyebrow">PRODUCED</div>
            <strong className="title">{formatLitres(totals.production)}</strong>
            <p className="kpi-foot">Recorded buffalo production.</p>
          </div>
          <div className="card">
            <div className="eyebrow">CUSTOMER DELIVERED</div>
            <strong className="title">{formatLitres(totals.delivery)}</strong>
            <p className="kpi-foot">Linked to milk sales entries.</p>
          </div>
          <div className="card">
            <div className="eyebrow">OTHER CONSUMPTION</div>
            <strong className="title">{formatLitres(totals.household + totals.wastage + totals.other)}</strong>
            <p className="kpi-foot">Household + wastage + other use.</p>
          </div>
          <div className="card">
            <div className="eyebrow">ADJUSTMENTS</div>
            <strong className="title">{formatLitres(totals.adjustmentIn - totals.adjustmentOut)}</strong>
            <p className="kpi-foot">Net manual corrections.</p>
          </div>
          <div className="card">
            <div className="eyebrow">CLOSING POOL</div>
            <strong className="title">{formatLitres(closingBalance)}</strong>
            <p className={`kpi-foot ${closingBalance < 0 ? 'field-error' : ''}`}>
              {closingBalance < 0
                ? 'Negative balance: investigate missing receipts or excess outflow.'
                : 'Derived from the movement ledger.'}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row production-controls">
          <div>
            <h2 className="section-title">Mixed milk fat by shift</h2>
            <p className="kpi-foot">Fat measured from the combined milk pool. This is separate from each customer's sale fat.</p>
          </div>
          {fatQuery.isFetching && <span className="kpi-foot">Updating…</span>}
        </div>
        {fatQuery.isError ? (
          <div className="list-error" role="alert">
            <span>{fatQuery.error.message}</span>
            <Button type="button" variant="outline" onClick={() => void fatQuery.refetch()}>Retry</Button>
          </div>
        ) : fatQuery.isPending ? (
          <div className="empty">Loading mixed milk fat…</div>
        ) : !fatByDate.length ? (
          <div className="empty">No fat records in this date range. Enter mixed milk fat from Daily performance for each shift.</div>
        ) : (
          <MixedMilkFatHistoryTable rows={fatByDate.map(([businessDate, shifts]) => ({
            businessDate,
            morningFat: shifts.MORNING,
            eveningFat: shifts.EVENING,
          }))} />
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Record milk usage or adjustment</h2>
        <p className="kpi-foot">
          Do not use this form for buffalo production or customer delivery; those are generated from
          their source transactions.
        </p>
        {!isViewer && <form className="grid three" onSubmit={recordMovement}>
          <div className="field">
            <Label htmlFor="pool-movement-date">Business date</Label>
            <DatePicker id="pool-movement-date" value={businessDate} max={localDateKey()} onChange={setBusinessDate} ariaLabel="Business date" />
          </div>
          <div className="field">
            <Label htmlFor="pool-movement-shift">Shift (optional)</Label>
            <Select value={shift || 'none'} onValueChange={(value) => setShift(value === 'none' ? '' : value as 'MORNING' | 'EVENING')}><SelectTrigger id="pool-movement-shift"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem>{MILK_POOL_SHIFT_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label htmlFor="pool-movement-type">Movement</Label>
            <Select value={movementType} onValueChange={(rawValue) => { const value = rawValue as MilkPoolManualMovementType; setMovementType(value); if (value !== 'ADJUSTMENT') setDirection('OUT'); }}><SelectTrigger id="pool-movement-type"><SelectValue /></SelectTrigger><SelectContent>{MILK_POOL_MOVEMENT_TYPES.map((value) => <SelectItem key={value} value={value}>{MILK_POOL_MOVEMENT_LABELS[value]}</SelectItem>)}</SelectContent></Select>
          </div>
          {movementType === 'ADJUSTMENT' && (
            <div className="field">
              <Label htmlFor="pool-movement-direction">Direction</Label>
              <Select value={direction} onValueChange={(value) => setDirection(value as MilkPoolMovementDirection)}><SelectTrigger id="pool-movement-direction"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OUT">Decrease pool</SelectItem><SelectItem value="IN">Increase pool</SelectItem></SelectContent></Select>
            </div>
          )}
          <div className="field">
            <Label htmlFor="pool-movement-quantity">Quantity (L)</Label>
            <Input
              id="pool-movement-quantity"
              type="number"
              min="0.001"
              step="0.001"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="e.g. 2.5"
            />
          </div>
          <div className="field">
            <Label htmlFor="pool-movement-notes">Notes</Label>
            <Textarea id="pool-movement-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Why was milk consumed/adjusted?" rows={2} />
          </div>
          <div>
            <Button type="submit" disabled={recordMutation.isPending}>
              {recordMutation.isPending ? 'Saving…' : 'Record movement'}
            </Button>
          </div>
        </form>}
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
      </div>

      <div className="card">
        <div className="row production-controls">
          <div>
            <h2 className="section-title">Daily reconciliation</h2>
            <p className="kpi-foot">Opening + inflows − outflows = closing. The system does not force same-day production to equal sales.</p>
          </div>
          {reconciliationQuery.isFetching && <span className="kpi-foot">Updating…</span>}
        </div>
        {reconciliationQuery.isError ? (
          <div className="list-error" role="alert">
            <span>{reconciliationQuery.error.message}</span>
            <Button type="button" variant="outline" onClick={() => void reconciliationQuery.refetch()}>Retry</Button>
          </div>
        ) : reconciliationQuery.isPending ? (
          <div className="empty">Loading reconciliation…</div>
        ) : !rows.length ? (
          <div className="empty">No milk movements in the selected period.</div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]" aria-busy={reconciliationQuery.isFetching}>
            <Table className="min-w-[1000px] [&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
              <TableHeader><TableRow><TableHead>DATE</TableHead><TableHead>OPENING</TableHead><TableHead>PRODUCED</TableHead><TableHead>DELIVERED</TableHead><TableHead>HOUSEHOLD</TableHead><TableHead>WASTAGE</TableHead><TableHead>OTHER</TableHead><TableHead>ADJUSTMENT</TableHead><TableHead>CLOSING</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map((row) => {
                const adjustment = Number(row.adjustment_in_litres) - Number(row.adjustment_out_litres);
                return <TableRow key={formatDate(row.business_date)}><TableCell className="whitespace-nowrap">{formatDate(row.business_date)}</TableCell><TableCell>{formatLitres(Number(row.opening_balance_litres))}</TableCell><TableCell>{formatLitres(Number(row.production_litres))}</TableCell><TableCell>{formatLitres(Number(row.customer_delivery_litres))}</TableCell><TableCell>{formatLitres(Number(row.household_use_litres))}</TableCell><TableCell>{formatLitres(Number(row.wastage_litres))}</TableCell><TableCell>{formatLitres(Number(row.other_use_litres))}</TableCell><TableCell>{formatLitres(adjustment)}</TableCell><TableCell>{formatLitres(Number(row.closing_balance_litres))}</TableCell></TableRow>;
              })}</TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
