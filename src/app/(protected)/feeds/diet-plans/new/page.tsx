'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import type { DietPlanFormValues } from '@/features/diet-plans/diet-plan.schema';
import { DietPlanForm } from '@/features/diet-plans/components/DietPlanForm';
import { useActiveDietFeedItemsQuery, useEligibleDietBuffaloesQuery, useSaveDietPlanMutation } from '@/features/diet-plans/diet-plan.queries';

type FeedOption = { id: string; name: string; base_unit: string; category: string };

export default function NewDietPlanPage() {
  const router = useRouter();
  const saveMutation = useSaveDietPlanMutation();
  const feedsQuery = useActiveDietFeedItemsQuery();
  const feeds = (feedsQuery.data ?? []) as FeedOption[];
  const [buffaloDate, setBuffaloDate] = useState('');
  const buffaloesQuery = useEligibleDietBuffaloesQuery(buffaloDate);
  const buffaloes = buffaloesQuery.data ?? [];
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  async function save(values: DietPlanFormValues) {
    setBusy(true);
    try {
      await saveMutation.mutateAsync({ id: null, values });
      setToast({ message: 'Diet plan created successfully.', type: 'success' });
      router.push('/feeds/diet-plans');
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save diet plan.';
      setToast({ message, type: 'error' });
      return message;
    } finally { setBusy(false); }
  }

  return (
    <AppShell title="New diet plan" subtitle="Create a recurring feed plan for a buffalo group">
      <div className="management-stack">
        <Button variant="outline" size="sm" asChild><Link href="/feeds/diet-plans">← Back to diet plans</Link></Button>
        <Toast message={toast?.message ?? feedsQuery.error?.message ?? buffaloesQuery.error?.message ?? ''} type={toast?.type ?? (feedsQuery.isError || buffaloesQuery.isError ? 'error' : undefined)} onDismiss={() => setToast(null)} />
        <DietPlanForm feeds={feeds} buffaloes={buffaloes} onDateChange={setBuffaloDate} onSave={save} busy={busy} />
      </div>
    </AppShell>
  );
}
