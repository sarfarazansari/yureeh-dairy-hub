'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import type { DietBuffaloOption, DietPlanFormValues } from '@/lib/diet-plan-types';
import { DietPlanForm } from '../components/DietPlanForm';
import { fetchActiveFeedItems, fetchEligibleBuffaloes, saveDietPlan } from '../services';

type FeedOption = { id: string; name: string; base_unit: string; category: string };

export default function NewDietPlanPage() {
  const router = useRouter();
  const [feeds, setFeeds] = useState<FeedOption[]>([]);
  const [buffaloes, setBuffaloes] = useState<DietBuffaloOption[]>([]);
  const [buffaloDate, setBuffaloDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadFeeds = useCallback(async () => {
    if (!supabase) return;
    try { setFeeds(await fetchActiveFeedItems(supabase) as FeedOption[]); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : 'Could not load feed items.', type: 'error' }); }
  }, []);

  useEffect(() => { void loadFeeds(); }, [loadFeeds]);

  const loadBuffaloes = useCallback(async (date: string) => {
    if (!supabase || !date) return;
    try { setBuffaloes(await fetchEligibleBuffaloes(supabase, date)); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : 'Could not load eligible buffaloes.', type: 'error' }); }
  }, []);

  useEffect(() => { if (buffaloDate) void loadBuffaloes(buffaloDate); }, [buffaloDate, loadBuffaloes]);

  async function save(values: DietPlanFormValues) {
    if (!supabase) return 'Supabase is not configured.';
    setBusy(true);
    try {
      await saveDietPlan(supabase, null, values);
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
        <Link className="date-chip" href="/feeds/diet-plans">← Back to diet plans</Link>
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />
        <DietPlanForm feeds={feeds} buffaloes={buffaloes} onDateChange={setBuffaloDate} onSave={save} busy={busy} />
      </div>
    </AppShell>
  );
}
