'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/Toast';
import { FeedPurchaseForm } from '../components/FeedPurchaseForm';
import { useCreateFeedPurchaseMutation, useFeedPurchaseFormOptionsQuery } from '@/features/feed-purchases/feed-purchases.queries';
import type { FeedPurchaseFormValues } from '@/features/feed-purchases/feed-purchases.schema';

export default function NewFeedPurchasePage() {
  const createMutation = useCreateFeedPurchaseMutation();
  const optionsQuery = useFeedPurchaseFormOptionsQuery();
  const feedItems = optionsQuery.data?.feedItems ?? [];
  const vendors = optionsQuery.data?.vendors ?? [];
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);
  const requestKey = useRef<{ fingerprint: string; key: string } | null>(null);

  async function save(values: FeedPurchaseFormValues) {
    setBusy(true);
    setToast(null);
    try {
      const fingerprint = JSON.stringify(values);
      if (requestKey.current?.fingerprint !== fingerprint) {
        requestKey.current = { fingerprint, key: crypto.randomUUID() };
      }
      await createMutation.mutateAsync({ values, idempotencyKey: requestKey.current!.key });
      requestKey.current = null;
      setToast({ message: 'Feed purchase recorded successfully.', type: 'success' });
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not record feed purchase.';
      setToast({ message, type: 'error' });
      return message;
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="New feed purchase" subtitle="Record feed stock-in and supplier purchase">
      <div className="management-stack">
        <div className="row">
          <Button asChild variant="outline"><Link href="/feeds/purchases">← Back to purchases</Link></Button>
        </div>
        <Toast message={toast?.message ?? optionsQuery.error?.message ?? ''} type={toast?.type ?? (optionsQuery.isError ? 'error' : undefined)} onDismiss={() => setToast(null)} />
        <FeedPurchaseForm feedItems={feedItems} vendors={vendors} onSave={save} busy={busy} />
      </div>
    </AppShell>
  );
}
