'use client';

import { money, milkTxt } from '@/lib/farm-format';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { type PricingType } from '@/lib/analytics';
import { milkEntrySchema } from '@/lib/milk-entry-validation';
import { Dialog } from '@/app/dialog';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { deleteMilkEntry, updateMilkEntry } from './services/milk-entry.service';
import {
  getMilkEntryCustomers,
  type CustomerOption,
} from '@/features/customers/services/customer.service';
import { formatDate } from '@/lib/date-format';
import {
  getMilkEntryList,
  getMilkEntryListUrl,
  getMilkEntryPresetRange,
  isValidBusinessDate,
  localDateKey,
  type MilkEntryDatePreset,
  type MilkEntryListRow,
  type MilkEntryShift,
} from '@/lib/milk-entry-list';
const MILK_ENTRY_PAGE_SIZE = 20;
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
function isMilkEntryPreset(value: string | null): value is MilkEntryDatePreset {
  return (
    value === 'current-month' ||
    value === 'last-7-days' ||
    value === 'last-15-days' ||
    value === 'custom'
  );
}
const compactMilkEntryPages = (current: number, last: number) => {
  const pages: (number | 'ellipsis')[] = [];
  for (let page = 1; page <= last; page += 1) {
    if (page === 1 || page === last || Math.abs(page - current) <= 1) pages.push(page);
    else if (pages[pages.length - 1] !== 'ellipsis') pages.push('ellipsis');
  }
  return pages;
};
export default function EntriesPage() {
  const pathname = usePathname(),
    router = useRouter(),
    searchParams = useSearchParams(),
    paramsText = searchParams.toString();
  const paramsRef = useRef(paramsText);
  useEffect(() => {
    paramsRef.current = paramsText;
  }, [paramsText]);
  const [rows, setRows] = useState<MilkEntryListRow[]>([]),
    [customers, setCustomers] = useState<CustomerOption[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(Boolean(supabase)),
    [error, setError] = useState(''),
    [customerLoadError, setCustomerLoadError] = useState(''),
    [customerSearch, setCustomerSearch] = useState(() => searchParams.get('q') ?? ''),
    [editing, setEditing] = useState<EditableMilkEntry | null>(null),
    [pendingDelete, setPendingDelete] = useState<MilkEntryListRow | null>(null),
    [busy, setBusy] = useState(false),
    [deletingId, setDeletingId] = useState(''),
    [editErrors, setEditErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(''),
    [reloadToken, setReloadToken] = useState(0);
  const saving = useRef(false);
  const rawRange = searchParams.get('range'),
    range: MilkEntryDatePreset = isMilkEntryPreset(rawRange) ? rawRange : 'current-month';
  const fallbackRange = getMilkEntryPresetRange('current-month');
  const today = localDateKey();
  const presetRange = range === 'custom' ? null : getMilkEntryPresetRange(range);
  const from =
    range === 'custom' ? (searchParams.get('from') ?? fallbackRange.from) : presetRange!.from;
  const to = range === 'custom' ? (searchParams.get('to') ?? today) : presetRange!.to;
  const pageValue = Number(searchParams.get('page') ?? '1'),
    page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const customerId = searchParams.get('customer') ?? '',
    rawShift = searchParams.get('shift') ?? '',
    shift: MilkEntryShift | '' = rawShift === 'MORNING' || rawShift === 'EVENING' ? rawShift : '';
  const rawPricing = searchParams.get('pricing') ?? '',
    pricing: PricingType | '' =
      rawPricing === 'FAT_BASED' || rawPricing === 'FIXED_PER_LITRE' ? rawPricing : '';
  const querySearch = (searchParams.get('q') ?? '').trim().slice(0, 100),
    pageCount = Math.max(1, Math.ceil(total / MILK_ENTRY_PAGE_SIZE));
  function replaceParams(next: URLSearchParams) {
    const value = next.toString();
    paramsRef.current = value;
    router.replace(getMilkEntryListUrl(pathname, next), { scroll: false });
  }
  function updateParams(update: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(paramsRef.current);
    update(next);
    replaceParams(next);
  }
  function setFilter(key: string, value: string) {
    updateParams((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
      if (key !== 'page') params.set('page', '1');
    });
  }
  useEffect(() => {
    const task = window.setTimeout(() => setCustomerSearch(searchParams.get('q') ?? ''), 0);
    return () => window.clearTimeout(task);
  }, [paramsText]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(paramsRef.current),
        current = (next.get('q') ?? '').trim(),
        value = customerSearch.trim().slice(0, 100);
      if (current === value) return;
      if (value) next.set('q', value);
      else next.delete('q');
      next.set('page', '1');
      replaceParams(next);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [customerSearch]);
  useEffect(() => {
    let active = true;
    async function loadCustomers() {
      if (!supabase) return;
      try {
        const options = await getMilkEntryCustomers(supabase);
        if (active) setCustomers(options);
      } catch (loadError) {
        if (active)
          setCustomerLoadError(
            loadError instanceof Error ? loadError.message : 'Could not load customers.',
          );
      }
    }
    const task = window.setTimeout(() => void loadCustomers(), 0);
    return () => {
      window.clearTimeout(task);
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (!supabase) return;
    if (!isValidBusinessDate(from) || !isValidBusinessDate(to) || from > to) {
      const task = window.setTimeout(() => {
        setRows([]);
        setTotal(0);
        setError('');
        setLoading(false);
      }, 0);
      return () => {
        window.clearTimeout(task);
        active = false;
      };
    }
    const task = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void getMilkEntryList(
        supabase!,
        { from, to, customerSearch: querySearch, customerId, shift, pricingType: pricing },
        { page, pageSize: MILK_ENTRY_PAGE_SIZE },
      )
        .then((result) => {
          if (!active) return;
          const lastPage = Math.max(1, Math.ceil(result.total / MILK_ENTRY_PAGE_SIZE));
          setTotal(result.total);
          if (page > lastPage) {
            const next = new URLSearchParams(paramsRef.current);
            if (lastPage === 1) next.delete('page');
            else next.set('page', String(lastPage));
            replaceParams(next);
            return;
          }
          setRows(result.rows);
          setLoading(false);
        })
        .catch((caught) => {
          if (!active) return;
          setRows([]);
          setTotal(0);
          setError(
            caught instanceof Error
              ? caught.message
              : 'Unable to load milk entries. Please try again.',
          );
          setLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(task);
      active = false;
    };
  }, [from, to, querySearch, customerId, shift, pricing, page, reloadToken]);
  const dateError =
    range === 'custom' && (!isValidBusinessDate(from) || !isValidBusinessDate(to) || from > to);
  function selectPreset(value: MilkEntryDatePreset) {
    updateParams((params) => {
      params.set('range', value);
      params.set('page', '1');
      if (value === 'custom') {
        const current = range === 'custom' ? { from, to } : (presetRange ?? fallbackRange);
        if (!params.has('from')) params.set('from', current.from);
        if (!params.has('to')) params.set('to', current.to);
      } else {
        params.delete('from');
        params.delete('to');
      }
    });
  }
  function clearFilters() {
    setCustomerSearch('');
    const next = new URLSearchParams();
    next.set('range', 'current-month');
    replaceParams(next);
  }
  function openEdit(row: MilkEntryListRow) {
    setEditErrors({});
    setEditing({
      ...row,
      _original: {
        milk_quantity: Number(row.milk_quantity),
        fat: row.fat,
        pricing_type: row.pricing_type,
        applied_rate: Number(row.applied_rate),
        calculated_amount: Number(row.calculated_amount),
      },
      milk_quantity: String(row.milk_quantity),
      fat: row.fat == null ? '' : String(row.fat),
      applied_rate: String(row.applied_rate),
      notes: row.notes ?? '',
    });
  }
  function updateEditing(
    key:
      | 'business_date'
      | 'shift'
      | 'milk_quantity'
      | 'fat'
      | 'applied_rate'
      | 'pricing_type'
      | 'notes',
    value: string,
  ) {
    setEditing((current) => (current ? { ...current, [key]: value } : current));
    setEditErrors((current) => ({ ...current, [key]: '' }));
  }
  function chooseEditCustomer(id: string) {
    const selected = customers.find((c) => c.id === id);
    setEditing((current) =>
      current
        ? {
            ...current,
            customer_id: id,
            pricing_type: selected?.pricing_type ?? current.pricing_type,
            applied_rate: selected ? String(selected.default_rate) : current.applied_rate,
            fat: '',
          }
        : current,
    );
    setEditErrors((current) => ({
      ...current,
      customer_id: '',
      pricing_type: '',
      applied_rate: '',
      fat: '',
    }));
  }
  async function loadCurrentPage() {
    setReloadToken((value) => value + 1);
  }
  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving.current || !supabase) return;
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
    saving.current = true;
    setBusy(true);
    setEditErrors({});
    setMessage('');
    try {
      await updateMilkEntry(supabase, editing.id, parsed.data);
      setMessage('Milk entry updated.');
      setEditing(null);
      await loadCurrentPage();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not update milk entry.');
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }
  async function confirmDelete() {
    if (!pendingDelete || !supabase || deletingId) return;
    setDeletingId(pendingDelete.id);
    setMessage('');
    try {
      await deleteMilkEntry(supabase, pendingDelete.id);
      setPendingDelete(null);
      setMessage('Milk entry deleted.');
      await loadCurrentPage();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not delete milk entry.');
    } finally {
      setDeletingId('');
    }
  }
  const editHasFat = editing?.pricing_type === 'FAT_BASED',
    clearable =
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
              {(
                [
                  ['current-month', 'Current Month'],
                  ['last-7-days', 'Last 7 Days'],
                  ['last-15-days', 'Last 15 Days'],
                  ['custom', 'Custom Range'],
                ] as const
              ).map(([value, label]) => (
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
            <input
              id="entries-search"
              type="search"
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Customer name"
              maxLength={100}
            />
          </div>
          <div className="field">
            <label htmlFor="entries-customer">Customer</label>
            <select
              id="entries-customer"
              value={customerId}
              onChange={(event) => setFilter('customer', event.target.value)}
            >
              <option value="">All customers</option>
              {customers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.is_active ? '' : ' · inactive'}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="entries-shift">Shift</label>
            <select
              id="entries-shift"
              value={shift}
              onChange={(event) => setFilter('shift', event.target.value)}
            >
              <option value="">All shifts</option>
              <option value="MORNING">Morning</option>
              <option value="EVENING">Evening</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="entries-pricing">Pricing model</label>
            <select
              id="entries-pricing"
              value={pricing}
              onChange={(event) => setFilter('pricing', event.target.value)}
            >
              <option value="">All models</option>
              <option value="FIXED_PER_LITRE">Fixed per litre</option>
              <option value="FAT_BASED">Fat based</option>
            </select>
          </div>
          {clearable && (
            <button type="button" className="filter-reset" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
        {range === 'custom' && (
          <div className="custom-date-range">
            <div className="field">
              <label htmlFor="entries-from">From</label>
              <input
                id="entries-from"
                type="date"
                value={from}
                max={to}
                onChange={(event) => setFilter('from', event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="entries-to">To</label>
              <input
                id="entries-to"
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(event) => setFilter('to', event.target.value)}
              />
            </div>
          </div>
        )}
        {dateError && (
          <p className="field-error" role="alert">
            Choose a valid start and end date; the start must not be after the end.
          </p>
        )}
        {customerLoadError && (
          <p className="field-error" role="status">
            Customer options could not be loaded: {customerLoadError}
          </p>
        )}
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        {error && (
          <div className="list-error" role="alert">
            <span>Unable to load milk entries: {error}</span>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        )}
        <div className="table-wrap" aria-busy={loading}>
          <table className="table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>SHIFT</th>
                <th>CUSTOMER</th>
                <th>MILK</th>
                <th>FAT</th>
                <th>PRICING</th>
                <th>RATE</th>
                <th>AMOUNT</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }, (_, index) => (
                    <tr key={`skeleton-${index}`}>
                      <td colSpan={9}>
                        <span className="table-skeleton" />
                      </td>
                    </tr>
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
                        <button type="button" className="date-chip" onClick={() => openEdit(row)}>
                          Edit
                        </button>{' '}
                        <button
                          type="button"
                          className="date-chip danger-text"
                          onClick={() => setPendingDelete(row)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && !rows.length && (
          <div className="empty milk-entry-empty">
            <b>No milk entries found</b>
            <span>Try changing the date range or filters.</span>
          </div>
        )}
        {!error && (
          <div className="milk-entry-pagination">
            <span>
              {loading
                ? 'Loading entries…'
                : `Showing ${total ? (page - 1) * MILK_ENTRY_PAGE_SIZE + 1 : 0}–${Math.min(page * MILK_ENTRY_PAGE_SIZE, total)} of ${total}`}
            </span>
            {pageCount > 1 && (
              <nav aria-label="Milk entry pages">
                <button
                  type="button"
                  className="date-chip"
                  disabled={page <= 1 || loading}
                  onClick={() => setFilter('page', String(page - 1))}
                >
                  Previous
                </button>
                {compactMilkEntryPages(page, pageCount).map((value, index) =>
                  value === 'ellipsis' ? (
                    <span className="page-ellipsis" key={`ellipsis-${index}`}>
                      …
                    </span>
                  ) : (
                    <button
                      type="button"
                      key={value}
                      className={`date-chip page-number ${value === page ? 'current' : ''}`}
                      aria-current={value === page ? 'page' : undefined}
                      disabled={loading}
                      onClick={() => setFilter('page', String(value))}
                    >
                      {value}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="date-chip"
                  disabled={page >= pageCount || loading}
                  onClick={() => setFilter('page', String(page + 1))}
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        )}
        <p className="kpi-foot">
          Entries are filtered and paginated at the database. Deleted rows remain in the audit
          history.
        </p>
      </div>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(null);
        }}
        labelledBy="edit-entry-title"
        className="entry-edit-dialog"
      >
        {editing && (
          <form onSubmit={saveEdit} noValidate>
            <div className="dialog-header">
              <div>
                <p className="eyebrow">MILK ENTRY</p>
                <h2 className="dialog-title" id="edit-entry-title">
                  Edit entry
                </h2>
                <p className="dialog-description">
                  {formatDate(editing.business_date)} ·{' '}
                  {customers.find((item) => item.id === editing.customer_id)?.name ??
                    editing.customers?.name ??
                    'Customer'}
                </p>
              </div>
              <button
                className="dialog-close"
                type="button"
                aria-label="Close edit dialog"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                ×
              </button>
            </div>
            <div className="grid three dialog-form-grid">
              <div className="field">
                <label htmlFor="edit-entry-date">Business date</label>
                <input
                  id="edit-entry-date"
                  type="date"
                  value={editing.business_date}
                  onChange={(event) => updateEditing('business_date', event.target.value)}
                  aria-invalid={!!editErrors.business_date}
                />
                {editErrors.business_date && (
                  <small className="field-error">{editErrors.business_date}</small>
                )}
              </div>
              <div className="field">
                <label htmlFor="edit-entry-shift">Shift</label>
                <select
                  id="edit-entry-shift"
                  value={editing.shift}
                  onChange={(event) => updateEditing('shift', event.target.value)}
                >
                  <option value="MORNING">Morning</option>
                  <option value="EVENING">Evening</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="edit-entry-customer">Customer</label>
                <select
                  id="edit-entry-customer"
                  value={editing.customer_id}
                  onChange={(event) => chooseEditCustomer(event.target.value)}
                  aria-invalid={!!editErrors.customer_id}
                >
                  <option value="">Select customer</option>
                  {customers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.is_active ? '' : ' · inactive'}
                    </option>
                  ))}
                </select>
                {editErrors.customer_id && (
                  <small className="field-error">{editErrors.customer_id}</small>
                )}
              </div>
            </div>
            <div className={`grid ${editHasFat ? 'three' : 'two'} dialog-form-grid`}>
              <div className="field">
                <label htmlFor="edit-milk-quantity">Milk (L)</label>
                <input
                  id="edit-milk-quantity"
                  autoFocus
                  type="number"
                  min="0.001"
                  step="0.001"
                  inputMode="decimal"
                  value={editing.milk_quantity}
                  onChange={(event) => updateEditing('milk_quantity', event.target.value)}
                  aria-invalid={!!editErrors.milk_quantity}
                />
                {editErrors.milk_quantity && (
                  <small className="field-error">{editErrors.milk_quantity}</small>
                )}
              </div>
              {editHasFat && (
                <div className="field">
                  <label htmlFor="edit-milk-fat">Fat (%)</label>
                  <input
                    id="edit-milk-fat"
                    type="number"
                    min="0"
                    max="20"
                    step="0.01"
                    inputMode="decimal"
                    value={editing.fat}
                    onChange={(event) => updateEditing('fat', event.target.value)}
                    aria-invalid={!!editErrors.fat}
                  />
                  {editErrors.fat && <small className="field-error">{editErrors.fat}</small>}
                </div>
              )}
              <div className="field">
                <label htmlFor="edit-milk-rate">Applied rate · ₹</label>
                <input
                  id="edit-milk-rate"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={editing.applied_rate}
                  onChange={(event) => updateEditing('applied_rate', event.target.value)}
                  aria-invalid={!!editErrors.applied_rate}
                />
                {editErrors.applied_rate && (
                  <small className="field-error">{editErrors.applied_rate}</small>
                )}
              </div>
              <div className="field">
                <label htmlFor="edit-pricing-type">Pricing type</label>
                <select
                  id="edit-pricing-type"
                  value={editing.pricing_type}
                  onChange={(event) => updateEditing('pricing_type', event.target.value)}
                >
                  <option value="FIXED_PER_LITRE">Fixed per litre</option>
                  <option value="FAT_BASED">Fat based</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="edit-entry-notes">Notes (optional)</label>
              <textarea
                id="edit-entry-notes"
                value={editing.notes}
                onChange={(event) => updateEditing('notes', event.target.value)}
                rows={2}
              />
            </div>
            <p className="kpi-foot edit-original">
              Original: {editing._original.milk_quantity} L · {editing._original.fat ?? 'no fat'} ·{' '}
              {editing._original.pricing_type} · ₹{editing._original.applied_rate} ·{' '}
              {money(editing._original.calculated_amount)}
            </p>
            <div className="dialog-footer">
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button disabled={busy} className="btn">
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </Dialog>
      <Dialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deletingId) setPendingDelete(null);
        }}
        labelledBy="delete-entry-title"
        className="delete-dialog"
      >
        {pendingDelete && (
          <>
            <div className="dialog-header">
              <div>
                <h2 className="dialog-title" id="delete-entry-title">
                  Delete milk entry?
                </h2>
                <p className="dialog-description">
                  This entry will be removed from active records but retained in the audit history.
                </p>
              </div>
              <button
                className="dialog-close"
                type="button"
                aria-label="Close delete dialog"
                onClick={() => setPendingDelete(null)}
                disabled={!!deletingId}
              >
                ×
              </button>
            </div>
            <div className="delete-summary">
              <b>{pendingDelete.customers?.name ?? 'Customer'}</b>
              <span>
                {formatDate(pendingDelete.business_date)} · {pendingDelete.shift}
              </span>
              <span>
                {milkTxt(Number(pendingDelete.milk_quantity))} ·{' '}
                {money(Number(pendingDelete.calculated_amount))}
              </span>
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                className="btn secondary"
                disabled={!!deletingId}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn destructive"
                disabled={!!deletingId}
                onClick={confirmDelete}
              >
                {deletingId ? 'Deleting…' : 'Delete entry'}
              </button>
            </div>
          </>
        )}
      </Dialog>
    </AppShell>
  );
}
