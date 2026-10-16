import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { ExpenseRow } from '@/lib/expense-types';

export type ExpensePayment = {
  id: string;
  payment_date: string;
  amount: number | string;
  payment_method: string;
  transaction_reference: string | null;
  notes: string | null;
  created_at: string;
};

export const expenseQueryKeys = {
  all: ['expenses'] as const,
  list: () => [...expenseQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...expenseQueryKeys.all, 'detail', id] as const,
  payments: (id: string) => [...expenseQueryKeys.all, 'payments', id] as const,
  categories: () => ['expense-categories'] as const,
  vendors: () => ['expense-vendors'] as const,
};

async function getExpenseDetail(client: SupabaseClient, expenseId: string) {
  const [expenseResult, paymentsResult] = await Promise.all([
    client.from('expenses').select('*').eq('id', expenseId).is('deleted_at', null).maybeSingle(),
    client.from('expense_payments')
      .select('id,payment_date,amount,payment_method,transaction_reference,notes,created_at')
      .eq('expense_id', expenseId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);
  if (expenseResult.error || paymentsResult.error) {
    throw new Error((expenseResult.error ?? paymentsResult.error)?.message ?? 'Could not load expense details.');
  }
  return {
    row: (expenseResult.data ?? null) as ExpenseRow | null,
    payments: (paymentsResult.data ?? []) as ExpensePayment[],
  };
}

export function useExpenseDetailQuery(expenseId: string) {
  return useQuery({
    queryKey: expenseQueryKeys.detail(expenseId),
    enabled: Boolean(expenseId),
    queryFn: () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return getExpenseDetail(supabase, expenseId);
    },
  });
}

async function recordExpensePayment(
  client: SupabaseClient,
  input: {
    expenseId: string;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    transactionReference: string | null;
    notes: string | null;
  },
) {
  const { error } = await client.rpc('record_expense_payment', {
    p_expense_id: input.expenseId,
    p_payment_date: input.paymentDate,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_transaction_reference: input.transactionReference,
    p_notes: input.notes,
  });
  if (error) throw new Error(error.message);
}

export function useRecordExpensePaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      expenseId: string;
      paymentDate: string;
      amount: number;
      paymentMethod: string;
      transactionReference: string | null;
      notes: string | null;
    }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      return recordExpensePayment(supabase, input);
    },
    onSuccess: async (_data, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: expenseQueryKeys.vendors() }),
        queryClient.invalidateQueries({ queryKey: expenseQueryKeys.categories() }),
        queryClient.invalidateQueries({ queryKey: ['feed-purchases'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}

export const expenseDashboardQueryKeys = {
  range: (from: string, to: string) => [...expenseQueryKeys.all, 'dashboard', from, to] as const,
};

export function useExpenseDashboardQuery(from: string, to: string) {
  return useQuery({
    queryKey: expenseDashboardQueryKeys.range(from, to),
    enabled: Boolean(from && to && from <= to),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [period, open] = await Promise.all([
        supabase.from('expenses').select('*').gte('business_date', from).lte('business_date', to)
          .is('deleted_at', null).order('business_date', { ascending: false }),
        supabase.from('expenses').select('*').gt('pending_amount', 0).is('deleted_at', null)
          .order('due_date', { ascending: true }).limit(500),
      ]);
      if (period.error || open.error) throw new Error((period.error ?? open.error)?.message ?? 'Could not load expenses.');
      return {
        rows: (period.data ?? []) as ExpenseRow[],
        outstandingRows: (open.data ?? []) as ExpenseRow[],
      };
    },
  });
}

export function useExpenseVendorDirectoryQuery() {
  return useQuery({
    queryKey: expenseQueryKeys.vendors(),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [vendors, summaries] = await Promise.all([
        supabase.from('expense_vendors').select('*').order('name'),
        supabase.rpc('get_expense_vendor_directory_summaries'),
      ]);
      if (vendors.error || summaries.error) {
        throw new Error((vendors.error ?? summaries.error)?.message ?? 'Could not load vendor directory.');
      }
      const summaryRows = (summaries.data ?? []) as unknown as Array<{
        vendor_id: string;
        expense_count: number | string | null;
        total_amount: number | string | null;
        paid_amount: number | string | null;
        pending_amount: number | string | null;
      }>;
      const byVendor = new Map(summaryRows.map((summary) => [summary.vendor_id, summary]));
      return (vendors.data ?? []).map((vendor) => {
        const summary = byVendor.get(vendor.id);
        return {
          ...vendor,
          count: Number(summary?.expense_count ?? 0),
          total: Number(summary?.total_amount ?? 0),
          paid: Number(summary?.paid_amount ?? 0),
          pending: Number(summary?.pending_amount ?? 0),
        };
      });
    },
  });
}

export function useExpenseCategoriesQuery(ownerId: string, enabled = true) {
  return useQuery({
    queryKey: [...expenseQueryKeys.categories(), ownerId] as const,
    enabled: Boolean(ownerId && enabled),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.from('expense_categories').select('*')
        .eq('owner_id', ownerId).order('category_group').order('name');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
