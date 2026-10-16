'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import type { DietPlanFormValues } from '@/features/diet-plans/diet-plan.schema';
import { DietPlanForm } from '@/features/diet-plans/components/DietPlanForm';
import { useActiveDietFeedItemsQuery, useDietPlanDetailsQuery, useEligibleDietBuffaloesQuery, useSaveDietPlanMutation } from '@/features/diet-plans/diet-plan.queries';

type FeedOption = { id: string; name: string; base_unit: string; category: string };

export default function EditDietPlanPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const saveMutation = useSaveDietPlanMutation();
  const feedsQuery = useActiveDietFeedItemsQuery();
  const feeds = (feedsQuery.data ?? []) as FeedOption[];
  const planQuery = useDietPlanDetailsQuery(id);
  const plan = planQuery.data;
  const [buffaloDate, setBuffaloDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const eligibleDate = buffaloDate || plan?.start_date || '';
  const buffaloesQuery = useEligibleDietBuffaloesQuery(eligibleDate);
  const buffaloes = buffaloesQuery.data ?? [];

  const initialValues: DietPlanFormValues | undefined = plan ? {
    name: plan.name,
    notes: plan.notes ?? '',
    startDate: plan.start_date,
    endDate: plan.end_date ?? '',
    status: plan.status,
    items: plan.items.map((item) => ({ feedItemId: item.feed_item_id, morningQuantity: item.morning_quantity, eveningQuantity: item.evening_quantity })),
    buffaloIds: plan.buffaloes.map((buffalo) => buffalo.id),
  } : undefined;

  async function save(values: DietPlanFormValues) {
    setBusy(true);
    try {
      await saveMutation.mutateAsync({ id, values });
      setToast({ message: 'Diet plan updated successfully.', type: 'success' });
      router.push('/feeds/diet-plans');
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update diet plan.';
      setToast({ message, type: 'error' });
      return message;
    } finally { setBusy(false); }
  }

  return (
    <AppShell title="Edit diet plan" subtitle="Update future feeding configuration without changing posted history">
      <div className="management-stack">
        <Button variant="outline" size="sm" asChild><Link href="/feeds/diet-plans">← Back to diet plans</Link></Button>
        <Toast message={toast?.message ?? planQuery.error?.message ?? feedsQuery.error?.message ?? buffaloesQuery.error?.message ?? ''} type={toast?.type ?? (planQuery.isError || feedsQuery.isError || buffaloesQuery.isError ? 'error' : undefined)} onDismiss={() => setToast(null)} />
        {plan && initialValues ? <DietPlanForm key={plan.id} feeds={feeds} buffaloes={buffaloes} onDateChange={setBuffaloDate} onSave={save} busy={busy} initialValues={initialValues} submitLabel="Save changes" /> : <div className="card"><div className="empty">Loading diet plan…</div></div>}
      </div>
    </AppShell>
  );
}
