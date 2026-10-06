import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import {
  getMilkEntryCustomers,
  type CustomerOption,
} from '@/features/customers/services/customer.service';
import {
  createMilkEntry,
  deleteMilkEntry,
  hasDuplicateMilkEntry,
  updateMilkEntry,
} from './services/milk-entry.service';
import {
  getMilkEntryList,
  type MilkEntryFilters,
  type MilkEntryListResult,
  type MilkEntryPagination,
} from '@/lib/milk-entry-list';
import {
  getMilkPoolReconciliation,
  recordMilkPoolMovement,
  type RecordMilkPoolMovementInput,
} from './services/milk-pool.service';
import type { MilkEntryFormValues } from '@/lib/milk-entry-validation';

export const milkQueryKeys = {
  all: ['milk'] as const,
  entries: (filters: MilkEntryFilters, pagination: MilkEntryPagination) =>
    [...milkQueryKeys.all, 'entries', filters, pagination] as const,
  customers: () => [...milkQueryKeys.all, 'customers'] as const,
  duplicate: (input: {
    customerId: string;
    businessDate: string;
    shift: 'MORNING' | 'EVENING';
  }) => [...milkQueryKeys.all, 'duplicate', input] as const,
  pool: (from: string, to: string) => [...milkQueryKeys.all, 'pool', from, to] as const,
};

const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

export function useMilkEntryListQuery(
  filters: MilkEntryFilters,
  pagination: MilkEntryPagination,
) {
  return useQuery<MilkEntryListResult, Error>({
    queryKey: milkQueryKeys.entries(filters, pagination),
    queryFn: () => getMilkEntryList(requireSupabase(), filters, pagination),
  });
}

export function useMilkEntryCustomersQuery() {
  return useQuery<CustomerOption[], Error>({
    queryKey: milkQueryKeys.customers(),
    queryFn: () => getMilkEntryCustomers(requireSupabase()),
  });
}

export function useMilkEntryDuplicateQuery(input: {
  customerId: string;
  businessDate: string;
  shift: 'MORNING' | 'EVENING';
}) {
  return useQuery<boolean, Error>({
    queryKey: milkQueryKeys.duplicate(input),
    enabled: Boolean(input.customerId && input.businessDate),
    queryFn: () => hasDuplicateMilkEntry(requireSupabase(), input),
  });
}

export function useCreateMilkEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: MilkEntryFormValues) => createMilkEntry(requireSupabase(), entry),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: milkQueryKeys.all });
    },
  });
}

export function useUpdateMilkEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, entry }: { entryId: string; entry: MilkEntryFormValues }) =>
      updateMilkEntry(requireSupabase(), entryId, entry),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: milkQueryKeys.all });
    },
  });
}

export function useDeleteMilkEntryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => deleteMilkEntry(requireSupabase(), entryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: milkQueryKeys.all });
    },
  });
}

export function useMilkPoolReconciliationQuery(from: string, to: string) {
  return useQuery({
    queryKey: milkQueryKeys.pool(from, to),
    queryFn: () => getMilkPoolReconciliation(requireSupabase(), from, to),
    enabled: Boolean(from && to && from <= to),
  });
}

export function useRecordMilkPoolMovementMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordMilkPoolMovementInput) =>
      recordMilkPoolMovement(requireSupabase(), input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: milkQueryKeys.all });
    },
  });
}
