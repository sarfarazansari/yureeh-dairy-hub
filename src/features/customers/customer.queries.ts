import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import {
  createCustomer,
  getCustomerDetails,
  getCustomerDirectory,
  getCustomerPayments,
  recordCustomerPayment,
  setCustomerActive,
  updateCustomer,
  updateCustomerPricing,
  type CustomerEntry,
  type CustomerFinancialSummary,
  type CustomerPayment,
  type CustomerSummary,
} from './services/customer.service';

export const customerQueryKeys = {
  all: ['customers'] as const,
  directory: () => [...customerQueryKeys.all, 'directory'] as const,
  detail: (customerId: string) => [...customerQueryKeys.all, 'detail', customerId] as const,
};

const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

export function useCustomerDirectoryQuery() {
  return useQuery({
    queryKey: customerQueryKeys.directory(),
    queryFn: () => getCustomerDirectory(requireSupabase()),
  });
}

export function useCustomerDetailQuery(customerId: string) {
  return useQuery<{ customer: CustomerSummary | null; entries: CustomerEntry[]; financialSummary: CustomerFinancialSummary }, Error>({
    queryKey: customerQueryKeys.detail(customerId),
    queryFn: () => getCustomerDetails(requireSupabase(), customerId),
    enabled: Boolean(customerId),
  });
}

export function useCustomerPaymentsQuery(customerId: string) {
  return useQuery<CustomerPayment[], Error>({
    queryKey: [...customerQueryKeys.detail(customerId), 'payments'],
    queryFn: () => getCustomerPayments(requireSupabase(), customerId),
    enabled: Boolean(customerId),
  });
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; name: string; pricingType: Parameters<typeof createCustomer>[1]['pricingType']; defaultRate: number }) =>
      createCustomer(requireSupabase(), input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.all });
    },
  });
}

export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      customerId: string;
      name: string;
      phone?: string | null;
      address?: string | null;
      notes?: string | null;
    }) =>
      updateCustomer(requireSupabase(), input.customerId, {
        name: input.name,
        phone: input.phone,
        address: input.address,
        notes: input.notes,
      }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.detail(variables.customerId) });
    },
  });
}

export function useRecordCustomerPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      customerId: string;
      payment: Parameters<typeof recordCustomerPayment>[2];
    }) => recordCustomerPayment(requireSupabase(), input.customerId, input.payment),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.detail(variables.customerId) });
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.directory() });
    },
  });
}

export function useUpdateCustomerPricingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { customerId: string; defaultRate: number; pricingType: Parameters<typeof updateCustomerPricing>[3] }) =>
      updateCustomerPricing(requireSupabase(), input.customerId, input.defaultRate, input.pricingType),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['milk'] });
    },
  });
}

export function useSetCustomerActiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { customerId: string; active: boolean }) =>
      setCustomerActive(requireSupabase(), input.customerId, input.active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: customerQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['milk'] });
    },
  });
}
