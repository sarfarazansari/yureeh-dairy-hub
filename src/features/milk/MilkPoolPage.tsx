'use client';

import { useMemo, useState } from 'react';

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
  useRecordMilkPoolMovementMutation,
} from './milk.queries';

const formatLitres = (value: number) => milkTxt(Number(value || 0));

export default function MilkPoolPage() {
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
          <div className="grid two">
            <label className="field">
              <span>From</span>
              <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="field">
              <span>To</span>
              <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
            </label>
          </div>
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
        <h2 className="section-title">Record milk usage or adjustment</h2>
        <p className="kpi-foot">
          Do not use this form for buffalo production or customer delivery; those are generated from
          their source transactions.
        </p>
        <form className="grid three" onSubmit={recordMovement}>
          <label className="field">
            <span>Business date</span>
            <input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
          </label>
          <label className="field">
            <span>Shift (optional)</span>
            <select value={shift} onChange={(event) => setShift(event.target.value as 'MORNING' | 'EVENING' | '')}>
              <option value="">Not specified</option>
              {MILK_POOL_SHIFT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Movement</span>
            <select
              value={movementType}
              onChange={(event) => {
                const value = event.target.value as MilkPoolManualMovementType;
                setMovementType(value);
                if (value !== 'ADJUSTMENT') setDirection('OUT');
              }}
            >
              {MILK_POOL_MOVEMENT_TYPES.map((value) => (
                <option key={value} value={value}>{MILK_POOL_MOVEMENT_LABELS[value]}</option>
              ))}
            </select>
          </label>
          {movementType === 'ADJUSTMENT' && (
            <label className="field">
              <span>Direction</span>
              <select value={direction} onChange={(event) => setDirection(event.target.value as MilkPoolMovementDirection)}>
                <option value="OUT">Decrease pool</option>
                <option value="IN">Increase pool</option>
              </select>
            </label>
          )}
          <label className="field">
            <span>Quantity (L)</span>
            <input
              type="number"
              min="0.001"
              step="0.001"
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="e.g. 2.5"
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Why was milk consumed/adjusted?" />
          </label>
          <div>
            <button className="btn" disabled={recordMutation.isPending}>
              {recordMutation.isPending ? 'Saving…' : 'Record movement'}
            </button>
          </div>
        </form>
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
            <button type="button" className="btn secondary" onClick={() => void reconciliationQuery.refetch()}>Retry</button>
          </div>
        ) : reconciliationQuery.isPending ? (
          <div className="empty">Loading reconciliation…</div>
        ) : !rows.length ? (
          <div className="empty">No milk movements in the selected period.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>OPENING</th>
                  <th>PRODUCED</th>
                  <th>DELIVERED</th>
                  <th>HOUSEHOLD</th>
                  <th>WASTAGE</th>
                  <th>OTHER</th>
                  <th>ADJUSTMENT</th>
                  <th>CLOSING</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const adjustment = Number(row.adjustment_in_litres) - Number(row.adjustment_out_litres);
                  return (
                    <tr key={row.business_date}>
                      <td>{row.business_date}</td>
                      <td>{formatLitres(Number(row.opening_balance_litres))}</td>
                      <td>{formatLitres(Number(row.production_litres))}</td>
                      <td>{formatLitres(Number(row.customer_delivery_litres))}</td>
                      <td>{formatLitres(Number(row.household_use_litres))}</td>
                      <td>{formatLitres(Number(row.wastage_litres))}</td>
                      <td>{formatLitres(Number(row.other_use_litres))}</td>
                      <td>{formatLitres(adjustment)}</td>
                      <td>{formatLitres(Number(row.closing_balance_litres))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
