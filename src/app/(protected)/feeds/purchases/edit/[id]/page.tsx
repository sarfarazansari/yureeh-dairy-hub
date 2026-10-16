'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/Toast';
import { FeedPurchaseForm } from '@/features/feed-purchases/components/FeedPurchaseForm';
import { useEditFeedPurchaseMutation, useFeedPurchaseForEditQuery } from '@/features/feed-purchases/feed-purchases.queries';
import type { FeedPurchaseFormValues } from '@/features/feed-purchases/feed-purchases.schema';

export default function EditFeedPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const editMutation = useEditFeedPurchaseMutation();
  const editQuery = useFeedPurchaseForEditQuery(id);
  const feedItems = editQuery.data?.feedItems ?? [];
  const vendors = editQuery.data?.vendors ?? [];
  const existing = editQuery.data?.existing;
  const initialValues: FeedPurchaseFormValues | null = existing ? {
    feedItemId: existing.purchase.feed_item_id,
    vendorId: existing.purchase.vendor_id ?? '',
    businessDate: existing.purchase.business_date,
    purchaseQuantity: Number(existing.purchase.purchase_quantity),
    rate: Number(existing.purchase.rate_per_purchase_unit),
    paymentStatus: existing.paymentStatus,
    paidAmount: existing.paidAmount,
    paymentMethod: existing.paymentMethod,
    dueDate: existing.dueDate,
    notes: existing.purchase.notes ?? '',
  } : null;
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function save(values: FeedPurchaseFormValues) {
    setBusy(true);
    setToast(null);

    try {
      await editMutation.mutateAsync({ purchaseId: id, values });
      setToast({ message: 'Feed purchase updated successfully.', type: 'success' });
      setCompleted(true);
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update feed purchase.';
      setToast({ message, type: 'error' });
      return message;
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Edit feed purchase" subtitle="Update a purchase while its stock is still untouched">
      <div className="management-stack">
        <div className="row">
          <Button asChild variant="outline"><Link href="/feeds/purchases">← Back to purchases</Link></Button>
        </div>

        <Toast message={toast?.message ?? editQuery.error?.message ?? ''} type={toast?.type ?? (editQuery.isError ? 'error' : undefined)} onDismiss={() => setToast(null)} />

        {completed ? (
          <div className="card">
            <h2 className="section-title">Purchase updated</h2>
            <p>The purchase has been updated and the inventory ledger has been adjusted safely.</p>
          </div>
        ) : initialValues ? (
          <FeedPurchaseForm
            feedItems={feedItems}
            vendors={vendors}
            initialValues={initialValues}
            onSave={save}
            busy={busy}
            submitLabel="Save changes"
          />
        ) : (
          <div className="card"><p>Loading purchase…</p></div>
        )}
      </div>
    </AppShell>
  );
}
