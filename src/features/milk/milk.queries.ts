import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import {
  getActiveCustomersForMilkEntry,
  getCustomerPricingForDate,
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
  getMilkDeliveryContext,
  recordMilkPoolMovement,
  type RecordMilkPoolMovementInput,
} from './services/milk-pool.service';
import type { MilkEntryFormValues } from '@/lib/milk-entry-validation';

export const milkQueryKeys = {
  all: ['milk'] as const,
  entries: (filters: MilkEntryFilters, pagination: MilkEntryPagination) =>
    [...milkQueryKeys.all, 'entries', filters, pagination] as const,
  customers: () => [...milkQueryKeys.all, 'customers'] as const,
  activeCustomers: () => [...milkQueryKeys.all, 'active-customers'] as const,
  customerPricing: (customerId: string, businessDate: string) =>
    [...milkQueryKeys.all, 'customer-pricing', customerId, businessDate] as const,
  duplicate: (input: {
    customerId: string;
    businessDate: string;
    shift: 'MORNING' | 'EVENING';
    excludeEntryId?: string;
  }) => [...milkQueryKeys.all, 'duplicate', input] as const,
  pool: (from: string, to: string) => [...milkQueryKeys.all, 'pool', from, to] as const,
  deliveryContext: (businessDate: string, shift: 'MORNING' | 'EVENING') =>
    [...milkQueryKeys.all, 'delivery-context', businessDate, shift] as const,
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

export function useActiveMilkEntryCustomersQuery() {
  return useQuery<CustomerOption[], Error>({
    queryKey: milkQueryKeys.activeCustomers(),
    queryFn: () => getActiveCustomersForMilkEntry(requireSupabase()),
  });
}

export function useMilkEntryCustomersQuery() {
  return useQuery<CustomerOption[], Error>({
    queryKey: milkQueryKeys.customers(),
    queryFn: () => getMilkEntryCustomers(requireSupabase()),
  });
}

export function useCustomerPricingQuery(customerId: string, businessDate: string) {
  return useQuery({
    queryKey: milkQueryKeys.customerPricing(customerId, businessDate),
    queryFn: () => getCustomerPricingForDate(requireSupabase(), customerId, businessDate),
    enabled: Boolean(customerId && businessDate),
  });
}

export function useMilkEntryDuplicateQuery(input: {
  customerId: string;
  businessDate: string;
  shift: 'MORNING' | 'EVENING';
  excludeEntryId?: string;
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

export function useMilkDeliveryContextQuery(
  businessDate: string,
  shift: 'MORNING' | 'EVENING',
) {
  return useQuery({
    queryKey: milkQueryKeys.deliveryContext(businessDate, shift),
    queryFn: () => getMilkDeliveryContext(requireSupabase(), businessDate, shift),
    enabled: Boolean(businessDate && shift),
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
