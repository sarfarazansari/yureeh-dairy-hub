'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/feed-types';
import type { ExpenseVendor } from '@/lib/expense-types';
import type { FeedPurchaseListRow } from '@/lib/feed-purchase-types';
import { todayLocal } from '../../expenses/shared';
import { FeedPurchaseForm } from './components/FeedPurchaseForm';
import { FeedPurchaseTable } from './components/FeedPurchaseTable';
import { createFeedPurchase, fetchFeedPurchases } from './services';
import type { FeedPurchaseFormValues } from './schema';

const PAGE_SIZE = 20;

export default function FeedPurchasesPage() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [vendors, setVendors] = useState<Pick<ExpenseVendor, 'id' | 'name'>[]>([]);
  const [rows, setRows] = useState<FeedPurchaseListRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [feedFilter, setFeedFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    try {
      const [feeds, vendorResult, purchases] = await Promise.all([
        supabase.from('feed_items').select('*').eq('is_active', true).order('name'),
        supabase.from('expense_vendors').select('id,name').eq('is_active', true).order('name'),
        fetchFeedPurchases(supabase, page, PAGE_SIZE, { from, to, feedItemId: feedFilter, vendorId: vendorFilter, paymentStatus: paymentFilter }),
      ]);
      if (feeds.error) throw feeds.error;
      if (vendorResult.error) throw vendorResult.error;
      setFeedItems(feeds.data ?? []);
      setVendors(vendorResult.data ?? []);
      setRows(purchases.rows);
      setCount(purchases.count);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load feed purchases.');
    }
  }, [page, from, to, feedFilter, vendorFilter, paymentFilter]);

  useEffect(() => { void load(); }, [load]);

  async function save(values: FeedPurchaseFormValues) {
    if (!supabase) return 'Supabase is not configured.';
    setBusy(true);
    setMessage('');
    try {
      await createFeedPurchase(supabase, values);
      await load();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not record feed purchase.';
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Feed purchases" subtitle="Record feed stock-in and supplier purchases">
      <div className="management-stack">
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <FeedPurchaseForm feedItems={feedItems} vendors={vendors} onSave={save} busy={busy} message="" />
        <div className="card">
          <div className="row"><h2 className="section-title">Purchase filters</h2><button type="button" className="date-chip" onClick={() => { setFrom(''); setTo(''); setFeedFilter(''); setVendorFilter(''); setPaymentFilter(''); setPage(0); }}>Clear</button></div>
          <div className="expense-form-grid">
            <div className="field"><label>From</label><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} /></div>
            <div className="field"><label>To</label><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} /></div>
            <div className="field"><label>Feed</label><select value={feedFilter} onChange={(e) => { setFeedFilter(e.target.value); setPage(0); }}><option value="">All feeds</option>{feedItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
            <div className="field"><label>Vendor</label><select value={vendorFilter} onChange={(e) => { setVendorFilter(e.target.value); setPage(0); }}><option value="">All vendors</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></div>
            <div className="field"><label>Payment status</label><select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(0); }}><option value="">All statuses</option><option value="PAID">Paid</option><option value="PARTIAL">Partial</option><option value="CREDIT">Credit</option></select></div>
          </div>
        </div>
        <FeedPurchaseTable rows={rows} count={count} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </AppShell>
  );
}