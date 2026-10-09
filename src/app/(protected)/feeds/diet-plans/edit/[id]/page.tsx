'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import type { DietBuffaloOption, DietPlanFormValues, DietPlanDetails } from '@/lib/diet-plan-types';
import { DietPlanForm } from '../../components/DietPlanForm';
import { fetchActiveFeedItems, fetchDietPlanForEdit, fetchEligibleBuffaloes, saveDietPlan } from '../../services';

type FeedOption = { id: string; name: string; base_unit: string; category: string };

export default function EditDietPlanPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [feeds, setFeeds] = useState<FeedOption[]>([]);
  const [buffaloes, setBuffaloes] = useState<DietBuffaloOption[]>([]);
  const [plan, setPlan] = useState<DietPlanDetails | null>(null);
  const [buffaloDate, setBuffaloDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !id) return;
    try {
      const [feedOptions, details] = await Promise.all([fetchActiveFeedItems(supabase), fetchDietPlanForEdit(supabase, id)]);
      setFeeds(feedOptions as FeedOption[]);
      setPlan(details);
      setBuffaloDate(details.start_date);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not load diet plan.', type: 'error' });
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const loadBuffaloes = useCallback(async (date: string) => {
    if (!supabase || !date) return;
    try {
      const eligible = await fetchEligibleBuffaloes(supabase, date);
      setBuffaloes(eligible);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not load eligible buffaloes.', type: 'error' });
    }
  }, []);

  useEffect(() => { if (buffaloDate) void loadBuffaloes(buffaloDate); }, [buffaloDate, loadBuffaloes]);

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
    if (!supabase) return 'Supabase is not configured.';
    setBusy(true);
    try {
      await saveDietPlan(supabase, id, values);
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
        <Link className="date-chip" href="/feeds/diet-plans">← Back to diet plans</Link>
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />
        {plan && initialValues ? <DietPlanForm key={plan.id} feeds={feeds} buffaloes={buffaloes} onDateChange={setBuffaloDate} onSave={save} busy={busy} initialValues={initialValues} submitLabel="Save changes" /> : <div className="card"><div className="empty">Loading diet plan…</div></div>}
      </div>
    </AppShell>
  );
}
