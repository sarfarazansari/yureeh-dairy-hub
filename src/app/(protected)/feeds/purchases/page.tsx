'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/feed-types';
import type { ExpenseVendor } from '@/lib/expense-types';
import type { FeedPurchaseListRow } from '@/lib/feed-purchase-types';
import { FeedPurchaseTable } from './components/FeedPurchaseTable';
import { deleteFeedPurchase, fetchFeedPurchases } from './services';

const PAGE_SIZE = 20;

export default function FeedPurchasesPage() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [vendors, setVendors] = useState<Pick<ExpenseVendor, 'id' | 'name'>[]>([]);
  const [rows, setRows] = useState<FeedPurchaseListRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [feedFilter, setFeedFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;

    try {
      const [feeds, vendorResult, purchases] = await Promise.all([
        supabase.from('feed_items').select('*').eq('is_active', true).order('name'),
        supabase.from('expense_vendors').select('id,name').eq('is_active', true).order('name'),
        fetchFeedPurchases(supabase, page, PAGE_SIZE, {
          from,
          to,
          feedItemId: feedFilter,
          vendorId: vendorFilter,
          paymentStatus: paymentFilter,
        }),
      ]);

      if (feeds.error) throw feeds.error;
      if (vendorResult.error) throw vendorResult.error;

      setFeedItems(feeds.data ?? []);
      setVendors(vendorResult.data ?? []);
      setRows(purchases.rows);
      setCount(purchases.count);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Could not load feed purchases.',
        type: 'error',
      });
    }
  }, [page, from, to, feedFilter, vendorFilter, paymentFilter]);

  useEffect(() => { void load(); }, [load]);

  async function handleDelete(purchaseId: string) {
    if (!supabase) return;

    try {
      await deleteFeedPurchase(supabase, purchaseId);
      setToast({ message: 'Feed purchase deleted successfully.', type: 'success' });
      await load();
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Could not delete feed purchase.',
        type: 'error',
      });
    }
  }

  function clearFilters() {
    setFrom('');
    setTo('');
    setFeedFilter('');
    setVendorFilter('');
    setPaymentFilter('');
    setPage(0);
  }

  return (
    <AppShell title="Feed purchase archive" subtitle="View feed stock-in history with filters and pagination">
      <div className="management-stack">
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />

        <div className="card">
          <div className="row">
            <h2 className="section-title">Purchase archive</h2>
            <Link className="btn" href="/feeds/purchases/new">New purchase</Link>
          </div>

          <div className="expense-form-grid">
            <div className="field">
              <Label>From</Label>
              <DatePicker clearable value={from} max={to || new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)} onChange={(value) => { setFrom(value); setPage(0); }} ariaLabel="From date" />
            </div>
            <div className="field">
              <Label>To</Label>
              <DatePicker clearable value={to} min={from} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)} onChange={(value) => { setTo(value); setPage(0); }} ariaLabel="To date" />
            </div>
            <div className="field">
              <Label>Feed</Label>
              <Select value={feedFilter || 'all'} onValueChange={(value) => { setFeedFilter(value === 'all' ? '' : value); setPage(0); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All feeds</SelectItem>{feedItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="field">
              <Label>Vendor</Label>
              <Select value={vendorFilter || 'all'} onValueChange={(value) => { setVendorFilter(value === 'all' ? '' : value); setPage(0); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All vendors</SelectItem>{vendors.map((vendor) => <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="field">
              <Label>Payment status</Label>
              <Select value={paymentFilter || 'all'} onValueChange={(value) => { setPaymentFilter(value === 'all' ? '' : value); setPage(0); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="PAID">Paid</SelectItem><SelectItem value="PARTIAL">Partial</SelectItem><SelectItem value="CREDIT">Credit</SelectItem></SelectContent></Select>
            </div>
            <div className="field" style={{ alignSelf: 'end' }}>
              <button type="button" className="date-chip" onClick={clearFilters}>Clear filters</button>
            </div>
          </div>
        </div>

        <FeedPurchaseTable
          rows={rows}
          count={count}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          onDelete={handleDelete}
        />
      </div>
    </AppShell>
  );
}
