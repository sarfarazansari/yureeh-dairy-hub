import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

import type { Shift } from '@/lib/milk-domain';
import type { FeedingRun, ScheduleSettings } from './types';

export const dietPlanScheduleQueryKeys = {
  all: ['diet-plan-schedule'] as const,
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dietPlanScheduleQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['feed-consumption'] }),
        queryClient.invalidateQueries({ queryKey: ['feed-inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['feed-cost-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
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
