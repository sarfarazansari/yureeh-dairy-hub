'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/feed-types';
import type { FeedInventoryStock } from '@/lib/feed-inventory-types';
import { FeedConsumptionForm } from '../../components/FeedConsumptionForm';
import type { FeedConsumptionFormValues } from '../../schema';
import { editFeedConsumption, fetchFeedConsumptionForEdit, fetchFeedItems, fetchFeedStock } from '../../services';

export default function EditFeedConsumptionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [stock, setStock] = useState<FeedInventoryStock[]>([]);
  const [initialValues, setInitialValues] = useState<FeedConsumptionFormValues | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !id) return;
    try {
      const [feeds, inventory, consumption] = await Promise.all([
        fetchFeedItems(supabase, false),
        fetchFeedStock(supabase),
        fetchFeedConsumptionForEdit(supabase, id),
      ]);
      setFeedItems(feeds);
      setStock(inventory);
      setInitialValues({
        feedItemId: consumption.feed_item_id,
        businessDate: consumption.occurred_at.slice(0, 10),
        quantity: Number(consumption.quantity),
        notes: consumption.notes ?? '',
      });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not load feed consumption.', type: 'error' });
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function save(values: FeedConsumptionFormValues) {
    if (!supabase) return 'Supabase is not configured.';
    setBusy(true);
    try {
      await editFeedConsumption(supabase, id, values);
      setToast({ message: 'Feed consumption updated successfully.', type: 'success' });
      router.push('/feeds/consumption');
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not update feed consumption.';
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Edit feed consumption" subtitle="Correct a consumption record when inventory activity allows it">
      <div className="management-stack">
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />
        <Link className="date-chip" href="/feeds/consumption">← Back to consumption archive</Link>
        {initialValues ? (
          <FeedConsumptionForm
            feedItems={feedItems}
            stock={stock}
            onSave={save}
            busy={busy}
            initialValues={initialValues}
            submitLabel="Save changes"
          />
        ) : (
          <div className="card"><div className="empty">Loading consumption…</div></div>
        )}
      </div>
    </AppShell>
  );
}
