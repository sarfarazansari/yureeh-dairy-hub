'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { useFeedConsumptionFormOptionsQuery } from '@/features/feed-consumption/feed-consumption.queries';
import { FeedConsumptionForm } from '../components/FeedConsumptionForm';
import type { FeedConsumptionFormValues } from '@/features/feed-consumption/feed-consumption.schema';
import { useCreateFeedConsumptionMutation } from '@/features/feed-consumption/feed-consumption.queries';

export default function NewFeedConsumptionPage() {
  const router = useRouter();
  const createMutation = useCreateFeedConsumptionMutation();
  const optionsQuery = useFeedConsumptionFormOptionsQuery();
  const feedItems = optionsQuery.data?.feedItems ?? [];
  const stock = optionsQuery.data?.stock ?? [];
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  async function save(values: FeedConsumptionFormValues) {
    setBusy(true);
    try {
      await createMutation.mutateAsync(values);
      setToast({ message: 'Feed consumption recorded successfully.', type: 'success' });
      router.push('/feeds/consumption');
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not record feed consumption.';
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="New feed consumption" subtitle="Record feed usage against available inventory">
      <div className="management-stack">
        <Toast message={toast?.message ?? optionsQuery.error?.message ?? ''} type={toast?.type ?? (optionsQuery.isError ? 'error' : undefined)} onDismiss={() => setToast(null)} />
        <Button variant="outline" size="sm" asChild><Link href="/feeds/consumption">← Back to consumption archive</Link></Button>
        <FeedConsumptionForm
          feedItems={feedItems}
          stock={stock}
          onSave={save}
          onError={(message) => setToast({ message, type: 'error' })}
          busy={busy}
        />
      </div>
    </AppShell>
  );
}