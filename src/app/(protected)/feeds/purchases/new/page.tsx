'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { TimedNotice } from '@/components/ui/TimedNotice';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/feed-types';
import type { ExpenseVendor } from '@/lib/expense-types';
import { FeedPurchaseForm } from '../components/FeedPurchaseForm';
import { createFeedPurchase } from '../services';
import type { FeedPurchaseFormValues } from '../schema';

export default function NewFeedPurchasePage() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [vendors, setVendors] = useState<Pick<ExpenseVendor, 'id' | 'name'>[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadOptions = useCallback(async () => {
    if (!supabase) return;
    try {
      const [feeds, vendorResult] = await Promise.all([
        supabase.from('feed_items').select('*').eq('is_active', true).order('name'),
        supabase.from('expense_vendors').select('id,name').eq('is_active', true).order('name'),
      ]);
      if (feeds.error) throw feeds.error;
      if (vendorResult.error) throw vendorResult.error;
      setFeedItems(feeds.data ?? []);
      setVendors(vendorResult.data ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load purchase options.');
    }
  }, []);

  useEffect(() => { void loadOptions(); }, [loadOptions]);

  async function save(values: FeedPurchaseFormValues) {
    if (!supabase) return 'Supabase is not configured.';
    setBusy(true);
    setMessage('');
    try {
      await createFeedPurchase(supabase, values);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not record feed purchase.';
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="New feed purchase" subtitle="Record feed stock-in and supplier purchase">
      <div className="management-stack">
        {message && <TimedNotice message={message} onDismiss={() => setMessage('')} />}
        <FeedPurchaseForm feedItems={feedItems} vendors={vendors} onSave={save} busy={busy} message="" />
      </div>
    </AppShell>
  );
}
