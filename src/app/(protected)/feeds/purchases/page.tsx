'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
              <label>From</label>
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
            </div>
            <div className="field">
              <label>To</label>
              <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
            </div>
            <div className="field">
              <label>Feed</label>
              <select value={feedFilter} onChange={(e) => { setFeedFilter(e.target.value); setPage(0); }}>
                <option value="">All feeds</option>
                {feedItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Vendor</label>
              <select value={vendorFilter} onChange={(e) => { setVendorFilter(e.target.value); setPage(0); }}>
                <option value="">All vendors</option>
                {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Payment status</label>
              <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(0); }}>
                <option value="">All statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="CREDIT">Credit</option>
              </select>
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
