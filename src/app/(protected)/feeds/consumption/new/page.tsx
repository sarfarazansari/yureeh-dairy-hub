'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/feed-types';
import type { FeedInventoryStock } from '@/lib/feed-inventory-types';
import { FeedConsumptionForm } from '../components/FeedConsumptionForm';
import type { FeedConsumptionFormValues } from '../schema';
import { fetchFeedItems, fetchFeedStock } from '../services';
import { useCreateFeedConsumptionMutation } from '../queries';

export default function NewFeedConsumptionPage() {
  const router = useRouter();
  const createMutation = useCreateFeedConsumptionMutation();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [stock, setStock] = useState<FeedInventoryStock[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    try {
      const [feeds, inventory] = await Promise.all([fetchFeedItems(supabase), fetchFeedStock(supabase)]);
      setFeedItems(feeds); setStock(inventory);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not load feed inventory.', type: 'error' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(values: FeedConsumptionFormValues) {
    if (!supabase) return 'Supabase is not configured.';
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
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />
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