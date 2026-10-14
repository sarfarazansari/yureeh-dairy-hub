'use client';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DatePicker } from '@/components/ui/date-picker';
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
import { calculateEntryAmount, type PricingType } from '@/lib/analytics';
import { milkEntrySchema } from '@/lib/milk-entry-validation';

import {
  useDeleteMilkEntryMutation,
  useMilkDeliveryContextQuery,
  useMilkEntryCustomersQuery,
  useMilkEntryDuplicateQuery,
  useMilkEntryListQuery,
  useMilkEntryExportQuery,
  useUpdateMilkEntryMutation,
} from './milk.queries';

type EditableMilkEntry = Omit<
  MilkEntryListRow,
  'milk_quantity' | 'fat' | 'applied_rate' | 'notes'
> & {
  milk_quantity: string;
  fat: string;
  applied_rate: string;
  notes: string;
  _original: {
    business_date: string;
    shift: MilkEntryShift;
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
  const rawPageSize = Number(searchParams.get('pageSize') ?? '20');
  const pageSize = [10, 20, 50, 100].includes(rawPageSize) ? rawPageSize : 20;
  const customerId = searchParams.get('customer') ?? '';
  const querySearch = (searchParams.get('q') ?? '').trim().slice(0, 100);
  const rawShift = searchParams.get('shift');
  const shift: MilkEntryShift | '' =
    rawShift === 'MORNING' || rawShift === 'EVENING' ? rawShift : '';
  const rawPricing = searchParams.get('pricing');
  const pricing: PricingType | '' =
    rawPricing === 'FAT_BASED' || rawPricing === 'FIXED_PER_LITRE' ? rawPricing : '';

  const filters: MilkEntryFilters = {
    from,
    to,
    customerSearch: querySearch,
    customerId,
    shift,
    pricingType: pricing,
  };
  const pagination = useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const dateError =
    range === 'custom' && (!isValidBusinessDate(from) || !isValidBusinessDate(to) || from > to);

  const listQuery = useMilkEntryListQuery(filters, pagination);
  const exportQuery = useMilkEntryExportQuery(filters);
  const customersQuery = useMilkEntryCustomersQuery();
  const updateMutation = useUpdateMilkEntryMutation();
  const deleteMutation = useDeleteMilkEntryMutation();

  const rows = listQuery.data?.rows ?? [];
  const total = listQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const allFilteredRows = exportQuery.data ?? [];
  const totalMilkLitres = allFilteredRows.reduce((sum, row) => sum + Number(row.milk_quantity), 0);
  const totalSalesAmount = allFilteredRows.reduce((sum, row) => sum + Number(row.calculated_amount), 0);

  const [customerSearch, setCustomerSearch] = useState(querySearch);
  const [editing, setEditing] = useState<EditableMilkEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MilkEntryListRow | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  function downloadPdf() {
    if (exportQuery.isPending || exportQuery.isError) {
      setMessage(exportQuery.isError ? 'Could not prepare the PDF. Please retry.' : 'Preparing the PDF…');
      if (exportQuery.isError) void exportQuery.refetch();
      return;
    }
    const safe = (value: unknown) => String(value ?? '').replace(/[&<>"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
    })[character] ?? character);
    const detailRows = allFilteredRows.map((row) => `<tr>
      <td>${safe(formatDate(row.business_date))}</td>
      <td>${safe(row.shift === 'MORNING' ? 'Morning' : 'Evening')}</td>
      <td>${safe(row.customers?.name ?? '—')}</td>
      <td class="num">${safe(Number(row.milk_quantity).toFixed(3))} L</td>
      <td class="num">${safe(row.fat == null ? '—' : `${row.fat}%`)}</td>
      <td>${safe(row.pricing_type === 'FIXED_PER_LITRE' ? 'Fixed per litre' : 'Fat based')}</td>
      <td class="num">${safe(money(Number(row.applied_rate)))}</td>
      <td class="num">${safe(money(Number(row.calculated_amount)))}</td>
    </tr>`).join('');
    const customerName = customerId
      ? (customersQuery.data ?? []).find((customer) => customer.id === customerId)?.name ?? 'Selected customer'
      : 'All customers';
    const popup = window.open('', '_blank', 'width=1000,height=800');
    if (!popup) {
      setMessage('Allow pop-ups to generate the PDF, then try again.');
      return;
    }
    popup.document.write(`<!doctype html><html><head><title>Milk sales report</title><style>
      body{font:12px Arial,sans-serif;color:#24352f;padding:28px}h1{font-size:22px;margin:0 0 5px}
      .muted{color:#64756d}.summary{display:flex;gap:14px;margin:22px 0}.tile{border:1px solid #dce5df;border-radius:8px;padding:12px;flex:1}
      .tile strong{display:block;font-size:18px;margin-top:6px}table{width:100%;border-collapse:collapse}
      th,td{padding:9px 6px;border-bottom:1px solid #e2e8e4;text-align:left}th{font-size:10px;color:#64756d}
      .num{text-align:right;white-space:nowrap}.total{font-weight:bold}@media print{body{padding:0}.no-print{display:none}}
    </style></head><body><h1>Yureeh Farm — Milk Sales Report</h1>
    <div class="muted">${safe(customerName)} · ${safe(from)} to ${safe(to)} · Generated ${safe(new Date().toLocaleDateString('en-IN'))}</div>
    <div class="summary"><div class="tile">Total milk<strong>${safe(milkTxt(totalMilkLitres))}</strong></div>
    <div class="tile">Total sales<strong>${safe(money(totalSalesAmount))}</strong></div>
    <div class="tile">Entries<strong>${allFilteredRows.length}</strong></div></div>
    <table><thead><tr><th>Date</th><th>Shift</th><th>Customer</th><th class="num">Milk</th><th class="num">Fat</th><th>Pricing</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
    <tbody>${detailRows}<tr class="total"><td colspan="3">TOTAL</td><td class="num">${safe(milkTxt(totalMilkLitres))}</td><td colspan="3"></td><td class="num">${safe(money(totalSalesAmount))}</td></tr></tbody></table>
    <p class="muted">This report summarizes recorded milk sales for the selected filters. It is not a tax invoice or a payment receipt.</p>
    <button class="no-print" onclick="window.print()">Print / Save as PDF</button></body></html>`);
    popup.document.close();
    popup.focus();
    popup.setTimeout(() => popup.print(), 300);
  }

  const editDuplicateQuery = useMilkEntryDuplicateQuery({
    customerId: editing?.customer_id ?? '',
    businessDate: editing?.business_date ?? '',
    shift: editing?.shift ?? 'MORNING',
    excludeEntryId: editing?.id,
  });

  const editDeliveryContextQuery = useMilkDeliveryContextQuery(
    editing?.business_date ?? '',
    editing?.shift ?? 'MORNING',
  );
  const editAvailablePoolLitres = editing && editDeliveryContextQuery.data
    ? Number(editDeliveryContextQuery.data.availablePoolLitres) +
      (editing.business_date === editing._original.business_date &&
      editing.shift === editing._original.shift
        ? editing._original.milk_quantity
        : 0)
    : 0;


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
        business_date: row.business_date,
        shift: row.shift,
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

    if (editDeliveryContextQuery.isPending) {
      setMessage('Checking herd production for the selected date and shift…');
      return;
    }
    if (editDeliveryContextQuery.isError) {
      setEditErrors((current) => ({ ...current, form: editDeliveryContextQuery.error.message }));
      setMessage(editDeliveryContextQuery.error.message);
      return;
    }
    if (!editDeliveryContextQuery.data?.herdEntryExists) {
      const errorMessage = 'Herd entry is required before a customer delivery can use this date and shift.';
      setEditErrors((current) => ({ ...current, form: errorMessage }));
      setMessage(errorMessage);
      return;
    }

    if (editDuplicateQuery.isPending) {
      setMessage('Checking for an existing delivery…');
      return;
    }
    if (editDuplicateQuery.data) {
      setEditErrors((current) => ({
        ...current,
        form: 'Another milk entry already exists for this customer, date, and shift.',
      }));
      setMessage('Another milk entry already exists for this customer, date, and shift.');
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
            <Label htmlFor="entries-search">Search customer</Label>
            <div className="row">
              <Input
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
            <Label htmlFor="entries-customer">Customer</Label>
            <Select value={customerId || 'all'} onValueChange={(value) => setFilter('customer', value === 'all' ? '' : value)}><SelectTrigger id="entries-customer"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All customers</SelectItem>{(customersQuery.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}{item.is_active ? '' : ' · inactive'}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="field">
            <Label htmlFor="entries-shift">Shift</Label>
            <Select value={shift || 'all'} onValueChange={(value) => setFilter('shift', value === 'all' ? '' : value)}><SelectTrigger id="entries-shift"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All shifts</SelectItem><SelectItem value="MORNING">Morning</SelectItem><SelectItem value="EVENING">Evening</SelectItem></SelectContent></Select>
          </div>
          <div className="field">
            <Label htmlFor="entries-pricing">Pricing model</Label>
            <Select value={pricing || 'all'} onValueChange={(value) => setFilter('pricing', value === 'all' ? '' : value)}><SelectTrigger id="entries-pricing"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All models</SelectItem><SelectItem value="FIXED_PER_LITRE">Fixed per litre</SelectItem><SelectItem value="FAT_BASED">Fat based</SelectItem></SelectContent></Select>
          </div>
          {clearable && (
            <button type="button" className="filter-reset" onClick={clearFilters}>Clear filters</button>
          )}
        </div>

        {range === 'custom' && <DateRangePicker from={from} to={to} max={today} onChange={({ from: nextFrom, to: nextTo }) => { const next = new URLSearchParams(searchParams.toString()); if (nextFrom) next.set('from', nextFrom); else next.delete('from'); if (nextTo) next.set('to', nextTo); else next.delete('to'); next.set('page', '1'); replaceParams(next); }} className="max-w-[22rem]"  />}

        {dateError && <p className="field-error">Choose a valid start and end date; the start must not be after the end.</p>}
        {customersQuery.isError && <p className="field-error">Customer options could not be loaded: {customersQuery.error.message}</p>}
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        {listQuery.isError && (
          <div className="list-error" role="alert">
            <span>Unable to load milk entries: {listQuery.error.message}</span>
            <button type="button" className="btn secondary" onClick={() => void listQuery.refetch()}>Retry</button>
          </div>
        )}

        <div className="milk-entry-summary" aria-live="polite">
          <div className="milk-entry-summary-card"><span>Total milk sold</span><strong>{exportQuery.isPending ? 'Calculating…' : milkTxt(totalMilkLitres)}</strong></div>
          <div className="milk-entry-summary-card"><span>Total sales amount</span><strong>{exportQuery.isPending ? 'Calculating…' : money(totalSalesAmount)}</strong></div>
          <div className="milk-entry-summary-card"><span>Matching entries</span><strong>{exportQuery.isPending ? '…' : allFilteredRows.length}</strong></div>
          <div className="milk-entry-summary-actions">
            <button type="button" className="btn" onClick={downloadPdf} disabled={exportQuery.isPending || exportQuery.isError || !allFilteredRows.length}>
              {exportQuery.isPending ? 'Preparing…' : 'Export PDF'}
            </button>
            {exportQuery.isError && <button type="button" className="btn secondary" onClick={() => void exportQuery.refetch()}>Retry summary</button>}
          </div>
        </div>
        {exportQuery.isError && <p className="field-error">Summary and PDF data could not be loaded: {exportQuery.error.message}</p>}
        <div className="table-wrap" aria-busy={listQuery.isFetching}>
          <Table className="[&_tbody_tr:nth-child(even)]:bg-[#f7f9f6]">
            <TableHeader>
              <TableRow>
                <TableHead>DATE</TableHead><TableHead>SHIFT</TableHead><TableHead>CUSTOMER</TableHead><TableHead>MILK</TableHead><TableHead>FAT</TableHead>
                <TableHead>PRICING</TableHead><TableHead>RATE</TableHead><TableHead>AMOUNT</TableHead><TableHead>ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isPending
                ? Array.from({ length: 5 }, (_, index) => (
                    <TableRow key={`skeleton-${index}`}><TableCell colSpan={9}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                  ))
                : rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.business_date)}</TableCell>
                      <TableCell><Badge variant="outline">{row.shift === 'MORNING' ? 'Morning' : 'Evening'}</Badge></TableCell>
                      <TableCell>{row.customers?.name ?? '—'}</TableCell>
                      <TableCell>{milkTxt(Number(row.milk_quantity))}</TableCell>
                      <TableCell>{row.fat === null ? '—' : `${row.fat}%`}</TableCell>
                      <TableCell><Badge variant="secondary">{row.pricing_type === 'FIXED_PER_LITRE' ? 'Fixed/L' : 'Fat'}</Badge></TableCell>
                      <TableCell>{money(Number(row.applied_rate))}</TableCell>
                      <TableCell>{money(Number(row.calculated_amount))}</TableCell>
                      <TableCell>
                        <button type="button" className="date-chip" onClick={() => openEdit(row)}>Edit</button>{' '}
                        <button type="button" className="date-chip danger-text" onClick={() => setPendingDelete(row)}>Cancel</button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>

        {!listQuery.isPending && !listQuery.isError && !rows.length && (
          <div className="empty milk-entry-empty"><b>No milk entries found</b><span>Try changing the date range or filters.</span></div>
        )}

        {!listQuery.isError && (
          <div className="milk-entry-pagination">
            <Label className="page-size-control">Rows per page
              <Select value={String(pageSize)} onValueChange={(value) => { const next = new URLSearchParams(searchParams.toString()); next.set('pageSize', value); next.set('page', '1'); replaceParams(next); }}><SelectTrigger aria-label="Rows per page"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent></Select>
            </Label>
            <span>
              {listQuery.isPending
                ? 'Loading entries…'
                : `Showing ${total ? (page - 1) * pageSize + 1 : 0}–${Math.min(page * pageSize, total)} of ${total}`}
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
              <div className="field"><Label htmlFor="edit-entry-date">Business date</Label><DatePicker id="edit-entry-date" value={editing.business_date} max={today} onChange={(value) => setEditing({ ...editing, business_date: value })} ariaLabel="Business date" />{editErrors.business_date && <small className="field-error">{editErrors.business_date}</small>}</div>
              <div className="field"><Label htmlFor="edit-entry-shift">Shift</Label><Select value={editing.shift} onValueChange={(value) => setEditing({ ...editing, shift: value as MilkEntryShift })}><SelectTrigger id="edit-entry-shift"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MORNING">Morning</SelectItem><SelectItem value="EVENING">Evening</SelectItem></SelectContent></Select></div>
              <div className="field"><Label htmlFor="edit-entry-customer">Customer</Label><Select value={editing.customer_id || undefined} onValueChange={(value) => setEditing({ ...editing, customer_id: value })}><SelectTrigger id="edit-entry-customer"><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{(customersQuery.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>{editErrors.customer_id && <small className="field-error">{editErrors.customer_id}</small>}</div>
            </div>
            <div className={`grid ${editing.pricing_type === 'FAT_BASED' ? 'three' : 'two'} dialog-form-grid`}>
              <div className="field"><Label htmlFor="edit-milk-quantity">Milk (L)</Label><Input id="edit-milk-quantity" type="number" min="0.001" step="0.001" value={editing.milk_quantity} onChange={(event) => setEditing({ ...editing, milk_quantity: event.target.value })} />{editErrors.milk_quantity && <small className="field-error">{editErrors.milk_quantity}</small>}</div>
              {editing.pricing_type === 'FAT_BASED' && <div className="field"><Label htmlFor="edit-milk-fat">Fat (%)</Label><Input id="edit-milk-fat" type="number" min="0" max="20" step="0.01" value={editing.fat} onChange={(event) => setEditing({ ...editing, fat: event.target.value })} />{editErrors.fat && <small className="field-error">{editErrors.fat}</small>}</div>}
              <div className="field"><Label htmlFor="edit-milk-rate">Applied rate · ₹</Label><Input id="edit-milk-rate" type="number" min="0.01" step="0.01" value={editing.applied_rate} onChange={(event) => setEditing({ ...editing, applied_rate: event.target.value })} />{editErrors.applied_rate && <small className="field-error">{editErrors.applied_rate}</small>}</div>
              <div className="field"><Label htmlFor="edit-pricing-type">Pricing type</Label><Select value={editing.pricing_type} onValueChange={(value) => setEditing({ ...editing, pricing_type: value as PricingType, fat: '' })}><SelectTrigger id="edit-pricing-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIXED_PER_LITRE">Fixed per litre</SelectItem><SelectItem value="FAT_BASED">Fat based</SelectItem></SelectContent></Select></div>
            </div>
            <div className="field"><Label htmlFor="edit-entry-notes">Notes (optional)</Label><Textarea id="edit-entry-notes" value={editing.notes} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} rows={2} /></div>
            {editDeliveryContextQuery.isError && <p className="field-error">{editDeliveryContextQuery.error.message}</p>}
            {!editDeliveryContextQuery.isError && !editDeliveryContextQuery.isPending && !editDeliveryContextQuery.data?.herdEntryExists && (
              <p className="auth-message" role="alert">Herd entry is required for {editing.business_date} · {editing.shift === 'MORNING' ? 'Morning' : 'Evening'} before this delivery can be saved.</p>
            )}
            {!editDeliveryContextQuery.isError && !editDeliveryContextQuery.isPending && editDeliveryContextQuery.data?.herdEntryExists && (
              <p className="kpi-foot">
                Available milk pool for this shift: <b>{milkTxt(editAvailablePoolLitres)}</b>
                {Number(editing.milk_quantity) > editAvailablePoolLitres
                  ? ' · ⚠️ This exceeds the shift balance; the database will reject this save.'
                  : ''}
              </p>
            )}
            {editDuplicateQuery.data && <p className="field-error">Another milk entry already exists for this customer, date, and shift.</p>}
            {editErrors.form && <p className="field-error">{editErrors.form}</p>}
            <p className="kpi-foot edit-original">Original: {editing._original.milk_quantity} L · {editing._original.fat ?? 'no fat'} · {editing._original.pricing_type} · ₹{editing._original.applied_rate} · {money(editing._original.calculated_amount)}</p>
            <div className="dialog-footer"><button type="button" className="btn secondary" onClick={() => setEditing(null)} disabled={updateMutation.isPending}>Cancel</button><button disabled={updateMutation.isPending} className="btn">{updateMutation.isPending ? 'Saving…' : 'Save changes'}</button></div>
          </form>
        )}
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setPendingDelete(null); }} labelledBy="delete-entry-title" className="delete-dialog">
        {pendingDelete && (
          <>
            <div className="dialog-header">
              <div><h2 className="dialog-title" id="delete-entry-title">Cancel milk delivery?</h2><p className="dialog-description">The delivery will be cancelled, kept in audit history, and its active pool movement will be reversed.</p></div>
              <button className="dialog-close" type="button" onClick={() => setPendingDelete(null)} disabled={deleteMutation.isPending}>×</button>
            </div>
            <div className="delete-summary"><b>{pendingDelete.customers?.name ?? 'Customer'}</b><span>{formatDate(pendingDelete.business_date)} · {pendingDelete.shift}</span><span>{milkTxt(Number(pendingDelete.milk_quantity))} · {money(Number(pendingDelete.calculated_amount))}</span></div>
            <div className="dialog-footer"><button type="button" className="btn secondary" onClick={() => setPendingDelete(null)} disabled={deleteMutation.isPending}>Cancel</button><button type="button" className="btn destructive" onClick={() => void confirmDelete()} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Cancelling…' : 'Cancel delivery'}</button></div>
          </>
        )}
      </Dialog>
    </AppShell>
  );
}
