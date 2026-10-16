'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useDietPlanScheduleQuery, useRetryDietFeedingRunMutation, useSaveDietPlanScheduleMutation, type FeedingRun } from '@/features/diet-plans/diet-plan-schedule.queries';

export default function DietPlanSchedulePage() {
  const [morningTime, setMorningTime] = useState('');
  const [eveningTime, setEveningTime] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const scheduleQuery = useDietPlanScheduleQuery();
  const saveMutation = useSaveDietPlanScheduleMutation();
  const retryMutation = useRetryDietFeedingRunMutation();
  const runs = scheduleQuery.data?.runs ?? [];
  const loading = scheduleQuery.isPending;
  const saving = saveMutation.isPending;
  const retryingId = retryMutation.isPending ? retryMutation.variables?.id ?? null : null;

  useEffect(() => {
    if (!scheduleQuery.data) return;
    setMorningTime(scheduleQuery.data.settings?.morning_time?.slice(0, 5) ?? '');
    setEveningTime(scheduleQuery.data.settings?.evening_time?.slice(0, 5) ?? '');
  }, [scheduleQuery.data]);

  useEffect(() => {
    if (scheduleQuery.error) setToast({ message: scheduleQuery.error.message, type: 'error' });
  }, [scheduleQuery.error]);

  async function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!morningTime || !eveningTime) {
      setToast({ message: 'Set both morning and evening feeding times.', type: 'error' });
      return;
    }
    if (morningTime === eveningTime) {
      setToast({ message: 'Morning and evening times must be different.', type: 'error' });
      return;
    }
    try {
      await saveMutation.mutateAsync({ morningTime, eveningTime });
      setToast({ message: 'Feeding schedule saved.', type: 'success' });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not save feeding schedule.', type: 'error' });
    }
  }

  async function retryRun(run: FeedingRun) {
    if (retryMutation.isPending || run.status !== 'FAILED') return;
    try {
      await retryMutation.mutateAsync(run);
      setToast({ message: 'Retry requested. The scheduler will process this run shortly.', type: 'success' });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Could not retry feeding run.', type: 'error' });
    }
  }

  return (
    <AppShell title="Feeding schedule" subtitle="Configure automatic feeding times and review posting history">
      <div className="management-stack">
        <Toast message={toast?.message ?? ''} type={toast?.type} onDismiss={() => setToast(null)} />
        <div className="card">
          <div className="row">
            <h2 className="section-title">Farm feeding times</h2>
            <Button variant="outline" size="sm" asChild><Link href="/feeds/diet-plans">Back to diet plans</Link></Button>
          </div>
          <p className="sub">Times use Asia/Kolkata. Automatic runs are created by the database scheduler; this page does not run a browser timer.</p>
          <form onSubmit={saveSchedule}>
            <div className="expense-form-grid">
              <div className="field">
                <Label htmlFor="diet-morning-time">Morning feeding time</Label>
                <Input id="diet-morning-time" type="time" required value={morningTime} onChange={(event) => setMorningTime(event.target.value)} />
              </div>
              <div className="field">
                <Label htmlFor="diet-evening-time">Evening feeding time</Label>
                <Input id="diet-evening-time" type="time" required value={eveningTime} onChange={(event) => setEveningTime(event.target.value)} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save feeding times'}</Button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 className="section-title">Recent feeding runs</h2>
          <p className="sub">Failed runs are never posted automatically after the scheduled minute. Review stock, then use Retry explicitly.</p>
          {loading ? <div className="empty">Loading feeding history…</div> : scheduleQuery.error ? <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm">{scheduleQuery.error.message}<Button className="ml-3" type="button" size="sm" variant="outline" onClick={() => void scheduleQuery.refetch()}>Retry load</Button></div> : (
            <>
              <div className="w-full min-w-0 overflow-x-auto rounded-md border border-[var(--line)]"><Table className="min-w-[850px]"><TableHeader><TableRow><TableHead>DATE / SLOT</TableHead><TableHead>PLAN</TableHead><TableHead>STATUS</TableHead><TableHead>DETAILS</TableHead><TableHead>ACTION</TableHead></TableRow></TableHeader><TableBody>
                {runs.map((run) => <TableRow key={run.id}><TableCell>{run.feeding_date}<div className="text-xs text-muted-foreground">{run.shift === 'MORNING' ? 'Morning' : 'Evening'} · {new Date(run.scheduled_for).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</div></TableCell><TableCell>{run.diet_plans?.name ?? 'Diet plan'}</TableCell><TableCell><Badge variant={run.status === 'POSTED' ? 'secondary' : run.status === 'FAILED' ? 'destructive' : 'outline'}>{run.status}</Badge></TableCell><TableCell>{run.failure_reason ?? (run.status === 'POSTED' ? 'Inventory posted' : run.status === 'SKIPPED' ? 'No eligible buffaloes or plan inactive' : '—')}</TableCell><TableCell>{run.status === 'FAILED' ? <Button type="button" variant="outline" size="sm" disabled={retryingId !== null} onClick={() => void retryRun(run)}>{retryingId === run.id ? 'Retrying…' : 'Retry'}</Button> : '—'}</TableCell></TableRow>)}
              </TableBody></Table></div>
              {!runs.length && <div className="empty">No feeding runs recorded yet. Configure the feeding times and activate a diet plan.</div>}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
