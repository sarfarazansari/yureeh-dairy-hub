import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type ScheduleSettings = { morning_time: string | null; evening_time: string | null };
export type FeedingRun = {
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

export const dietPlanScheduleQueryKeys = {
  all: ['diet-plan-schedule'] as const,
  settings: () => [...dietPlanScheduleQueryKeys.all, 'settings'] as const,
  runs: () => [...dietPlanScheduleQueryKeys.all, 'runs'] as const,
};

export function useDietPlanScheduleQuery() {
  return useQuery({
    queryKey: dietPlanScheduleQueryKeys.all,
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [{ data: settings, error: settingsError }, { data: runRows, error: runsError }] = await Promise.all([
        supabase.from('diet_plan_schedule_settings').select('morning_time,evening_time').maybeSingle(),
        supabase.from('diet_feeding_runs')
          .select('id,plan_id,feeding_date,shift,scheduled_for,status,failure_reason,retry_count,diet_plans!inner(name)')
          .order('scheduled_for', { ascending: false }).limit(50),
      ]);
      if (settingsError || runsError) throw new Error((settingsError ?? runsError)?.message ?? 'Could not load feeding schedule.');
      return {
        settings: (settings as ScheduleSettings | null) ?? null,
        runs: (runRows ?? []) as unknown as FeedingRun[],
      };
    },
  });
}

export function useSaveDietPlanScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { morningTime: string; eveningTime: string }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.rpc('save_diet_plan_schedule_settings', {
        p_morning_time: input.morningTime,
        p_evening_time: input.eveningTime,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dietPlanScheduleQueryKeys.all });
    },
  });
}

export function useRetryDietFeedingRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (run: FeedingRun) => {
      if (run.status !== 'FAILED') throw new Error('Only failed feeding runs can be retried.');
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.rpc('retry_diet_feeding_run', { p_run_id: run.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dietPlanScheduleQueryKeys.all });
    },
  });
}
