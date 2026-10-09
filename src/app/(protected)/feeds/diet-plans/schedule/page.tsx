'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

type ScheduleSettings = { morning_time: string | null; evening_time: string | null };
type FeedingRun = {
  id: string;
  plan_id: string;
  feeding_date: string;
  shift: 'MORNING' | 'EVENING';
  scheduled_for: string;
  status: 'PENDING' | 'PROCESSING' | 'POSTED' | 'FAILED' | 'SKIPPED';
  failure_reason: string | null;
  retry_count: number;
  diet_plans: { name: string } | null;
};

export default function DietPlanSchedulePage() {
  const [morningTime, setMorningTime] = useState('');
  const [eveningTime, setEveningTime] = useState('');
  const [runs, setRuns] = useState<FeedingRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [{ data: settings, error: settingsError }, { data: runRows, error: runsError }] = await Promise.all([
        supabase.from('diet_plan_schedule_settings').select('morning_time,evening_time').maybeSingle(),
        supabase.from('diet_feeding_runs')
          .select('id,plan_id,feeding_date,shift,scheduled_for,status,failure_reason,retry_count,diet_plans!inner(name)')
          .order('scheduled_for', { ascending: false }).limit(50),
      ]);
      if (settingsError) throw settingsError;
      if (runsError) throw runsError;
      const current = settings as ScheduleSettings | null;
      setMorningTime(current?.morning_time?.slice(0, 5) ?? '');
      setEveningTime(current?.evening_time?.slice(0, 5) ?? '');
      setRuns((runRows ?? []) as unknown as FeedingRun[]);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not load feeding schedule.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || saving) return;
    if (!morningTime || !eveningTime) {
      setToast({ message: 'Set both morning and evening feeding times.', type: 'error' });
      return;
    }
    if (morningTime === eveningTime) {
      setToast({ message: 'Morning and evening times must be different.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('save_diet_plan_schedule_settings', {
        p_morning_time: morningTime,
        p_evening_time: eveningTime,
      });
      if (error) throw error;
      setToast({ message: 'Feeding schedule saved.', type: 'success' });
      await load();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not save feeding schedule.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function retryRun(run: FeedingRun) {
    if (!supabase || retryingId) return;
    setRetryingId(run.id);
    try {
      const { error } = await supabase.rpc('retry_diet_feeding_run', { p_run_id: run.id });
      if (error) throw error;
      setToast({ message: 'Retry requested. The scheduler will process this run shortly.', type: 'success' });
      await load();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not retry feeding run.', type: 'error' });
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <AppShell title="Feeding schedule" subtitle="Configure automatic feeding times and review posting history">
      <div className="management-stack">
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />
        <div className="card">
          <div className="row">
            <h2 className="section-title">Farm feeding times</h2>
            <Link className="date-chip" href="/feeds/diet-plans">Back to diet plans</Link>
          </div>
          <p className="sub">Times use Asia/Kolkata. Automatic runs are created by the database scheduler; this page does not run a browser timer.</p>
          <form onSubmit={saveSchedule}>
            <div className="expense-form-grid">
              <div className="field">
                <label htmlFor="diet-morning-time">Morning feeding time</label>
                <input id="diet-morning-time" type="time" required value={morningTime} onChange={(event) => setMorningTime(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="diet-evening-time">Evening feeding time</label>
                <input id="diet-evening-time" type="time" required value={eveningTime} onChange={(event) => setEveningTime(event.target.value)} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save feeding times'}</button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Recent feeding runs</h2>
          <p className="sub">Failed runs are never posted automatically after the scheduled minute. Review stock, then use Retry explicitly.</p>
          {loading ? <div className="empty">Loading feeding history…</div> : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>DATE / SLOT</th><th>PLAN</th><th>STATUS</th><th>DETAILS</th><th>ACTION</th></tr></thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id}>
                        <td>{run.feeding_date}<div className="sub">{run.shift === 'MORNING' ? 'Morning' : 'Evening'} · {new Date(run.scheduled_for).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</div></td>
                        <td>{run.diet_plans?.name ?? 'Diet plan'}</td>
                        <td><span className="tag">{run.status}</span></td>
                        <td>{run.failure_reason ?? (run.status === 'POSTED' ? 'Inventory posted' : run.status === 'SKIPPED' ? 'No eligible buffaloes or plan inactive' : '—')}</td>
                        <td>{run.status === 'FAILED' ? <button type="button" className="date-chip" disabled={retryingId !== null} onClick={() => void retryRun(run)}>{retryingId === run.id ? 'Retrying…' : 'Retry'}</button> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!runs.length && <div className="empty">No feeding runs recorded yet. Configure the feeding times and activate a diet plan.</div>}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
