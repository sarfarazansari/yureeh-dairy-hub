import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { customerQueryKeys } from './customer.query-keys';

export { customerQueryKeys } from './customer.query-keys';
import {
  createCustomer,
  getCustomerDetails,
  getCustomerDirectory,
  getCustomerPayments,
  getCustomerEntryHistoryPage,
  getCustomerPaymentsPage,
  recordCustomerPayment,
  setCustomerActive,
  updateCustomer,
  updateCustomerPricing,
} from './services/customer.service';
import type { CustomerEntry, CustomerFinancialSummary, CustomerPayment, CustomerSummary } from './types';

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
  return useQuery<{
    customer: CustomerSummary | null;
    entries: CustomerEntry[];
    financialSummary: CustomerFinancialSummary;
  }, Error>({
    queryKey: customerQueryKeys.detail(customerId),
    queryFn: () => getCustomerDetails(requireSupabase(), customerId),
    enabled: Boolean(customerId),
  });
}

export function useCustomerPaymentsQuery(customerId: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: [...customerQueryKeys.payments(customerId), page, pageSize],
    queryFn: () => getCustomerPaymentsPage(requireSupabase(), customerId, page, pageSize),
    enabled: Boolean(customerId),
  });
}

export function useCustomerEntryHistoryQuery(customerId: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: [...customerQueryKeys.detail(customerId), 'entry-history', page, pageSize],
    queryFn: () => getCustomerEntryHistoryPage(requireSupabase(), customerId, page, pageSize),
    enabled: Boolean(customerId),
  });
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; name: string; pricingType: Parameters<typeof createCustomer>[1]['pricingType']; defaultRate: number }) =>
      createCustomer(requireSupabase(), input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: customerQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['milk'] }),
      ]);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: customerQueryKeys.detail(variables.customerId) }),
        queryClient.invalidateQueries({ queryKey: ['milk'] }),
      ]);
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
      await queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
      await queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
      await queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
