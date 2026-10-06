'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { Dialog } from '@/app/dialog';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { money, milkTxt } from '@/lib/farm-format';
import { formatDate } from '@/lib/date-format';
import {
  compactMilkEntryPages,
  getMilkEntryListUrl,
  getMilkEntryPresetRange,
  isValidBusinessDate,
  localDateKey,
  type MilkEntryDatePreset,
  type MilkEntryFilters,
  type MilkEntryListRow,
  type MilkEntryShift,
} from '@/lib/milk-entry-list';
import { type PricingType } from '@/lib/analytics';
import { milkEntrySchema } from '@/lib/milk-entry-validation';

import {
  useDeleteMilkEntryMutation,
  useMilkEntryCustomersQuery,
  useMilkEntryListQuery,
  useUpdateMilkEntryMutation,
} from './milk.queries';
import { MILK_ENTRY_PAGE_SIZE } from './milk.constants';

type EditableMilkEntry = Omit<
  MilkEntryListRow,
  'milk_quantity' | 'fat' | 'applied_rate' | 'notes'
> & {
  milk_quantity: string;
  fat: string;
  applied_rate: string;
  notes: string;
  _original: {
    milk_quantity: number;
    fat: number | null;
    pricing_type: PricingType;
    applied_rate: number;
    calculated_amount: number;
  };
};

const isMilkEntryPreset = (value: string | null): value is MilkEntryDatePreset =>
  value === 'current-month' ||
  value === 'last-7-days' ||
  value === 'last-15-days' ||
  value === 'custom';

export default function EntriesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const range: MilkEntryDatePreset = isMilkEntryPreset(searchParams.get('range'))
    ? (searchParams.get('range') as MilkEntryDatePreset)
    : 'current-month';
  const fallbackRange = getMilkEntryPresetRange('current-month');
  const today = localDateKey();
  const presetRange = range === 'custom' ? null : getMilkEntryPresetRange(range);
  const from =
    range === 'custom' ? searchParams.get('from') ?? fallbackRange.from : presetRange!.from;
  const to = range === 'custom' ? searchParams.get('to') ?? today : presetRange!.to;
  const pageValue = Number(searchParams.get('page') ?? '1');
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const customerId = searchParams.get('customer') ?? '';
  const querySearch = (searchParams.get('q') ?? '').trim().slice(0, 100);
  const rawShift = searchParams.get('shift');
  const shift: MilkEntryShift | '' =
    rawShift === 'MORNING' || rawShift === 'EVENING' ? rawShift : '';
  const rawPricing = searchParams.get('pricing');
  const pricing: PricingType | '' =
    rawPricing === 'FAT_BASED' || rawPricing === 'FIXED_PER_LITRE' ? rawPricing : '';

  const filters: MilkEntryFilters = useMemo(
    () => ({
      from,
      to,
      customerSearch: querySearch,
      customerId,
      shift,
      pricingType: pricing,
    }),
    [from, to, querySearch, customerId, shift, pricing],
  );
  const pagination = useMemo(() => ({ page, pageSize: MILK_ENTRY_PAGE_SIZE }), [page]);
  const dateError =
    range === 'custom' && (!isValidBusinessDate(from) || !isValidBusinessDate(to) || from > to);

  const listQuery = useMilkEntryListQuery(filters, pagination);
  const customersQuery = useMilkEntryCustomersQuery();
  const updateMutation = useUpdateMilkEntryMutation();
  const deleteMutation = useDeleteMilkEntryMutation();

  const rows = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / MILK_ENTRY_PAGE_SIZE));

  const [customerSearch, setCustomerSearch] = useState(querySearch);
  const [editing, setEditing] = useState<EditableMilkEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MilkEntryListRow | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  function replaceParams(next: URLSearchParams) {
    router.replace(getMilkEntryListUrl(pathname, next), { scroll: false });
  }

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    replaceParams(next);
  }

  function applySearch() {
    const next = new URLSearchParams(searchParams.toString());
    const value = customerSearch.trim().slice(0, 100);
    if (value) next.set('q', value);
    else next.delete('q');
    next.set('page', '1');
    replaceParams(next);
  }

  function selectPreset(value: MilkEntryDatePreset) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('range', value);
    next.set('page', '1');
    if (value === 'custom') {
      const current = range === 'custom' ? { from, to } : (presetRange ?? fallbackRange);
      next.set('from', current.from);
      next.set('to', current.to);
    } else {
      next.delete('from');
      next.delete('to');
    }
    replaceParams(next);
  }

  function clearFilters() {
    setCustomerSearch('');
    replaceParams(new URLSearchParams('range=current-month'));
  }

  function openEdit(row: MilkEntryListRow) {
    setEditErrors({});
    setEditing({
      ...row,
      milk_quantity: String(row.milk_quantity),
      fat: row.fat == null ? '' : String(row.fat),
      applied_rate: String(row.applied_rate),
      notes: row.notes ?? '',
      _original: {
        milk_quantity: Number(row.milk_quantity),
        fat: row.fat,
        pricing_type: row.pricing_type,
        applied_rate: Number(row.applied_rate),
        calculated_amount: Number(row.calculated_amount),
      },
    });
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const parsed = milkEntrySchema.safeParse({
      business_date: editing.business_date,
      shift: editing.shift,
      customer_id: editing.customer_id,
      milk_quantity: editing.milk_quantity,
      fat: editing.fat,
      pricing_type: editing.pricing_type,
      applied_rate: editing.applied_rate,
      notes: editing.notes,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!next[key]) next[key] = issue.message;
      }
      setEditErrors(next);
      return;
    }

    try {
      await updateMutation.mutateAsync({ entryId: editing.id, entry: parsed.data });
      setEditing(null);
      setMessage('Milk entry updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update milk entry.');
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
      setMessage('Milk entry deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete milk entry.');
    }
  }

  const clearable =
    range !== 'current-month' ||
    querySearch !== '' ||
    customerId !== '' ||
    shift !== '' ||
    pricing !== '' ||
    page !== 1;

  return (
    <AppShell title="Milk entries" subtitle="Browse, filter and manage recorded sales">
      <div className="card">
        <div className="milk-entry-filters">
          <div className="milk-date-range">
            <span className="filter-caption">Date range</span>
            <div className="date-range-segment" role="group" aria-label="Date range">
              {([
                ['current-month', 'Current Month'],
                ['last-7-days', 'Last 7 Days'],
                ['last-15-days', 'Last 15 Days'],
                ['custom', 'Custom Range'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={range === value ? 'active' : ''}
                  aria-pressed={range === value}
                  onClick={() => selectPreset(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="entries-search">Search customer</label>
            <div className="row">
              <input
                id="entries-search"
                type="search"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applySearch();
                }}
                placeholder="Customer name"
                maxLength={100}
              />
              <button type="button" className="date-chip" onClick={applySearch}>Search</button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="entries-customer">Customer</label>
            <select
              id="entries-customer"
              value={customerId}
              onChange={(event) => setFilter('customer', event.target.value)}
            >
              <option value="">All customers</option>
              {(customersQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.is_active ? '' : ' · inactive'}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="entries-shift">Shift</label>
            <select id="entries-shift" value={shift} onChange={(event) => setFilter('shift', event.target.value)}>
              <option value="">All shifts</option>
              <option value="MORNING">Morning</option>
              <option value="EVENING">Evening</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="entries-pricing">Pricing model</label>
            <select id="entries-pricing" value={pricing} onChange={(event) => setFilter('pricing', event.target.value)}>
              <option value="">All models</option>
              <option value="FIXED_PER_LITRE">Fixed per litre</option>
              <option value="FAT_BASED">Fat based</option>
            </select>
          </div>
          {clearable && (
            <button type="button" className="filter-reset" onClick={clearFilters}>Clear filters</button>
          )}
        </div>

        {range === 'custom' && (
          <div className="custom-date-range">
            <div className="field">
              <label htmlFor="entries-from">From</label>
              <input id="entries-from" type="date" value={from} max={to} onChange={(event) => setFilter('from', event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="entries-to">To</label>
              <input id="entries-to" type="date" value={to} min={from} max={today} onChange={(event) => setFilter('to', event.target.value)} />
            </div>
          </div>
        )}

        {dateError && <p className="field-error">Choose a valid start and end date; the start must not be after the end.</p>}
        {customersQuery.isError && <p className="field-error">Customer options could not be loaded: {customersQuery.error.message}</p>}
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        {listQuery.isError && (
          <div className="list-error" role="alert">
            <span>Unable to load milk entries: {listQuery.error.message}</span>
            <button type="button" className="btn secondary" onClick={() => void listQuery.refetch()}>Retry</button>
          </div>
        )}

        <div className="table-wrap" aria-busy={listQuery.isFetching}>
          <table className="table">
            <thead>
              <tr>
                <th>DATE</th><th>SHIFT</th><th>CUSTOMER</th><th>MILK</th><th>FAT</th>
                <th>PRICING</th><th>RATE</th><th>AMOUNT</th><th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isPending
                ? Array.from({ length: 5 }, (_, index) => (
                    <tr key={`skeleton-${index}`}><td colSpan={9}><span className="table-skeleton" /></td></tr>
                  ))
                : rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.business_date)}</td>
                      <td>{row.shift === 'MORNING' ? 'Morning' : 'Evening'}</td>
                      <td>{row.customers?.name ?? '—'}</td>
                      <td>{milkTxt(Number(row.milk_quantity))}</td>
                      <td>{row.fat === null ? '—' : `${row.fat}%`}</td>
                      <td>{row.pricing_type === 'FIXED_PER_LITRE' ? 'Fixed/L' : 'Fat'}</td>
                      <td>{money(Number(row.applied_rate))}</td>
                      <td>{money(Number(row.calculated_amount))}</td>
                      <td>
                        <button type="button" className="date-chip" onClick={() => openEdit(row)}>Edit</button>{' '}
                        <button type="button" className="date-chip danger-text" onClick={() => setPendingDelete(row)}>Delete</button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!listQuery.isPending && !listQuery.isError && !rows.length && (
          <div className="empty milk-entry-empty"><b>No milk entries found</b><span>Try changing the date range or filters.</span></div>
        )}

        {!listQuery.isError && (
          <div className="milk-entry-pagination">
            <span>
              {listQuery.isPending
                ? 'Loading entries…'
                : `Showing ${total ? (page - 1) * MILK_ENTRY_PAGE_SIZE + 1 : 0}–${Math.min(page * MILK_ENTRY_PAGE_SIZE, total)} of ${total}`}
            </span>
            {pageCount > 1 && (
              <nav aria-label="Milk entry pages">
                <button type="button" className="date-chip" disabled={page <= 1 || listQuery.isFetching} onClick={() => setFilter('page', String(page - 1))}>Previous</button>
                {compactMilkEntryPages(page, pageCount).map((value, index) =>
                  value === 'ellipsis' ? (
                    <span className="page-ellipsis" key={`ellipsis-${index}`}>…</span>
                  ) : (
                    <button
                      type="button"
                      key={value}
                      className={`date-chip page-number ${value === page ? 'current' : ''}`}
                      aria-current={value === page ? 'page' : undefined}
                      onClick={() => setFilter('page', String(value))}
                    >
                      {value}
                    </button>
                  ),
                )}
                <button type="button" className="date-chip" disabled={page >= pageCount || listQuery.isFetching} onClick={() => setFilter('page', String(page + 1))}>Next</button>
              </nav>
            )}
          </div>
        )}
        <p className="kpi-foot">Entries are database-paginated. Deleted rows remain in audit history and their pool movement is reversed.</p>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => { if (!open && !updateMutation.isPending) setEditing(null); }} labelledBy="edit-entry-title" className="entry-edit-dialog">
        {editing && (
          <form onSubmit={saveEdit} noValidate>
            <div className="dialog-header">
              <div>
                <p className="eyebrow">MILK ENTRY</p>
                <h2 className="dialog-title" id="edit-entry-title">Edit entry</h2>
                <p className="dialog-description">{formatDate(editing.business_date)} · {editing.customers?.name ?? 'Customer'}</p>
              </div>
              <button className="dialog-close" type="button" onClick={() => setEditing(null)} disabled={updateMutation.isPending}>×</button>
            </div>
            <div className="grid three dialog-form-grid">
              <div className="field"><label htmlFor="edit-entry-date">Business date</label><input id="edit-entry-date" type="date" value={editing.business_date} onChange={(event) => setEditing({ ...editing, business_date: event.target.value })} />{editErrors.business_date && <small className="field-error">{editErrors.business_date}</small>}</div>
              <div className="field"><label htmlFor="edit-entry-shift">Shift</label><select id="edit-entry-shift" value={editing.shift} onChange={(event) => setEditing({ ...editing, shift: event.target.value as MilkEntryShift })}><option value="MORNING">Morning</option><option value="EVENING">Evening</option></select></div>
              <div className="field"><label htmlFor="edit-entry-customer">Customer</label><select id="edit-entry-customer" value={editing.customer_id} onChange={(event) => setEditing({ ...editing, customer_id: event.target.value })}><option value="">Select customer</option>{(customersQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{editErrors.customer_id && <small className="field-error">{editErrors.customer_id}</small>}</div>
            </div>
            <div className={`grid ${editing.pricing_type === 'FAT_BASED' ? 'three' : 'two'} dialog-form-grid`}>
              <div className="field"><label htmlFor="edit-milk-quantity">Milk (L)</label><input id="edit-milk-quantity" type="number" min="0.001" step="0.001" value={editing.milk_quantity} onChange={(event) => setEditing({ ...editing, milk_quantity: event.target.value })} />{editErrors.milk_quantity && <small className="field-error">{editErrors.milk_quantity}</small>}</div>
              {editing.pricing_type === 'FAT_BASED' && <div className="field"><label htmlFor="edit-milk-fat">Fat (%)</label><input id="edit-milk-fat" type="number" min="0" max="20" step="0.01" value={editing.fat} onChange={(event) => setEditing({ ...editing, fat: event.target.value })} />{editErrors.fat && <small className="field-error">{editErrors.fat}</small>}</div>}
              <div className="field"><label htmlFor="edit-milk-rate">Applied rate · ₹</label><input id="edit-milk-rate" type="number" min="0.01" step="0.01" value={editing.applied_rate} onChange={(event) => setEditing({ ...editing, applied_rate: event.target.value })} />{editErrors.applied_rate && <small className="field-error">{editErrors.applied_rate}</small>}</div>
              <div className="field"><label htmlFor="edit-pricing-type">Pricing type</label><select id="edit-pricing-type" value={editing.pricing_type} onChange={(event) => setEditing({ ...editing, pricing_type: event.target.value as PricingType, fat: '' })}><option value="FIXED_PER_LITRE">Fixed per litre</option><option value="FAT_BASED">Fat based</option></select></div>
            </div>
            <div className="field"><label htmlFor="edit-entry-notes">Notes (optional)</label><textarea id="edit-entry-notes" value={editing.notes} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} rows={2} /></div>
            <p className="kpi-foot edit-original">Original: {editing._original.milk_quantity} L · {editing._original.fat ?? 'no fat'} · {editing._original.pricing_type} · ₹{editing._original.applied_rate} · {money(editing._original.calculated_amount)}</p>
            <div className="dialog-footer"><button type="button" className="btn secondary" onClick={() => setEditing(null)} disabled={updateMutation.isPending}>Cancel</button><button disabled={updateMutation.isPending} className="btn">{updateMutation.isPending ? 'Saving…' : 'Save changes'}</button></div>
          </form>
        )}
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setPendingDelete(null); }} labelledBy="delete-entry-title" className="delete-dialog">
        {pendingDelete && (
          <>
            <div className="dialog-header">
              <div><h2 className="dialog-title" id="delete-entry-title">Delete milk entry?</h2><p className="dialog-description">The sale is soft-deleted and its active pool movement is reversed for audit-safe reconciliation.</p></div>
              <button className="dialog-close" type="button" onClick={() => setPendingDelete(null)} disabled={deleteMutation.isPending}>×</button>
            </div>
            <div className="delete-summary"><b>{pendingDelete.customers?.name ?? 'Customer'}</b><span>{formatDate(pendingDelete.business_date)} · {pendingDelete.shift}</span><span>{milkTxt(Number(pendingDelete.milk_quantity))} · {money(Number(pendingDelete.calculated_amount))}</span></div>
            <div className="dialog-footer"><button type="button" className="btn secondary" onClick={() => setPendingDelete(null)} disabled={deleteMutation.isPending}>Cancel</button><button type="button" className="btn destructive" onClick={() => void confirmDelete()} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Deleting…' : 'Delete entry'}</button></div>
          </>
        )}
      </Dialog>
    </AppShell>
  );
}
