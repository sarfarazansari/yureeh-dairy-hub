'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { FeedConsumptionForm } from '../../components/FeedConsumptionForm';
import type { FeedConsumptionFormValues } from '@/features/feed-consumption/feed-consumption.schema';
import { useEditFeedConsumptionMutation, useFeedConsumptionForEditQuery } from '@/features/feed-consumption/feed-consumption.queries';

export default function EditFeedConsumptionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const editMutation = useEditFeedConsumptionMutation();
  const id = params.id;
  const editQuery = useFeedConsumptionForEditQuery(id);
  const feedItems = editQuery.data?.feedItems ?? [];
  const consumption = editQuery.data?.consumption;
  const stock = (editQuery.data?.stock ?? []).map((item) => item.feed_item_id === consumption?.feed_item_id ? { ...item, quantity_on_hand: Number(item.quantity_on_hand) + Number(consumption.quantity) } : item);
  const initialValues: FeedConsumptionFormValues | null = consumption ? {
    feedItemId: consumption.feed_item_id,
    businessDate: consumption.occurred_at.slice(0, 10),
    quantity: Number(consumption.quantity),
    notes: consumption.notes ?? '',
  } : null;
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  async function save(values: FeedConsumptionFormValues) {
    setBusy(true);
    try {
      await editMutation.mutateAsync({ movementId: id, values });
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
        <Toast message={toast?.message ?? editQuery.error?.message ?? ''} type={toast?.type ?? (editQuery.isError ? 'error' : undefined)} onDismiss={() => setToast(null)} />
        <Button variant="outline" size="sm" asChild><Link href="/feeds/consumption">← Back to consumption archive</Link></Button>
        {initialValues ? (
          <FeedConsumptionForm
            feedItems={feedItems}
            stock={stock}
            onSave={save}
            onError={(message) => setToast({ message, type: 'error' })}
            busy={busy}
            initialValues={initialValues}
            submitLabel="Save changes"
            lockFeedItem
          />
        ) : (
          <div className="card"><div className="empty">Loading consumption…</div></div>
        )}
      </div>
    </AppShell>
  );
}
