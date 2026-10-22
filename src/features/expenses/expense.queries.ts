import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { buffaloQueryKeys } from '@/features/buffaloes/buffalo.query-keys';
import type { ExpenseRow, ExpensePayment } from './types';
export type { ExpensePayment } from './types';

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
        queryClient.invalidateQueries({ queryKey: ['feed-inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['feed-cost-analytics'] }),
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
        .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
        .order('category_group').order('name');
      if (error) throw new Error(error.message);

      // Prefer farm-owned categories when older data already contains an override.
      const byName = new Map<string, NonNullable<typeof data>[number]>();
      for (const category of data ?? []) {
        const key = category.name.trim().toLocaleLowerCase();
        const existing = byName.get(key);
        if (!existing || (existing.owner_id == null && category.owner_id === ownerId)) {
          byName.set(key, category);
        }
      }
      return [...byName.values()];
    },
  });
}

export type ExpenseHistoryFilters = {
  page: number;
  pageSize: number;
  from: string;
  to: string;
  category: string;
  group: string;
  vendor: string;
  status: string;
  method: string;
  buffalo: string;
  outstandingOnly: boolean;
  search: string;
  sort: string;
  sortDirection: 'asc' | 'desc';
};

export function useExpenseHistoryExportQuery(filters: ExpenseHistoryFilters, enabled = true) {
  return useQuery({
    queryKey: [...expenseQueryKeys.list(), 'export', {
      from: filters.from, to: filters.to, category: filters.category, group: filters.group,
      vendor: filters.vendor, status: filters.status, method: filters.method, buffalo: filters.buffalo,
      outstandingOnly: filters.outstandingOnly, search: filters.search, sort: filters.sort,
      sortDirection: filters.sortDirection,
    }] as const,
    enabled,
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const chunkSize = 500;
      const rows: ExpenseRow[] = [];
      for (let offset = 0; ; offset += chunkSize) {
        let query = supabase.from('expenses').select('*').is('deleted_at', null);
        if (filters.from) query = query.gte('business_date', filters.from);
        if (filters.to) query = query.lte('business_date', filters.to);
        if (filters.category) query = query.eq('category_id', filters.category);
        if (filters.group) query = query.eq('category_group_snapshot', filters.group);
        if (filters.vendor) query = query.eq('vendor_id', filters.vendor);
        if (filters.status) query = query.eq('payment_status', filters.status);
        if (filters.method) query = query.eq('payment_method', filters.method);
        if (filters.buffalo) query = query.eq('buffalo_id', filters.buffalo);
        if (filters.outstandingOnly) query = query.gt('pending_amount', 0);
        const term = filters.search.trim().replace(/[(),]/g, ' ').replace(/[%_]/g, '');
        if (term) query = query.or(`category_name_snapshot.ilike.%${term}%,vendor_name_snapshot.ilike.%${term}%,description.ilike.%${term}%`);
        const sortColumn = filters.sort === 'amount' ? 'total_amount' : filters.sort === 'pending' ? 'pending_amount' : filters.sort === 'category' ? 'category_name_snapshot' : 'business_date';
        const { data, error } = await query
          .order(sortColumn, { ascending: filters.sortDirection === 'asc' })
          .order('id', { ascending: true })
          .range(offset, offset + chunkSize - 1);
        if (error) throw new Error(error.message);
        const batch = (data ?? []) as ExpenseRow[];
        rows.push(...batch);
        if (batch.length < chunkSize) break;
      }
      return rows;
    },
  });
}

export function useExpenseHistoryQuery(filters: ExpenseHistoryFilters, enabled = true) {
  return useQuery({
    queryKey: [...expenseQueryKeys.list(), filters] as const,
    enabled,
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const offset = (filters.page - 1) * filters.pageSize;
      let query = supabase.from('expenses').select('*', { count: 'exact' }).is('deleted_at', null);
      if (filters.from) query = query.gte('business_date', filters.from);
      if (filters.to) query = query.lte('business_date', filters.to);
      if (filters.category) query = query.eq('category_id', filters.category);
      if (filters.group) query = query.eq('category_group_snapshot', filters.group);
      if (filters.vendor) query = query.eq('vendor_id', filters.vendor);
      if (filters.status) query = query.eq('payment_status', filters.status);
      if (filters.method) query = query.eq('payment_method', filters.method);
      if (filters.buffalo) query = query.eq('buffalo_id', filters.buffalo);
      if (filters.outstandingOnly) query = query.gt('pending_amount', 0);
      const term = filters.search.trim().replace(/[(),]/g, ' ').replace(/[%_]/g, '');
      if (term) query = query.or(`category_name_snapshot.ilike.%${term}%,vendor_name_snapshot.ilike.%${term}%,description.ilike.%${term}%`);
      const sortColumn = filters.sort === 'amount' ? 'total_amount' : filters.sort === 'pending' ? 'pending_amount' : filters.sort === 'category' ? 'category_name_snapshot' : 'business_date';
      query = query.order(sortColumn, { ascending: filters.sortDirection === 'asc' }).range(offset, offset + filters.pageSize - 1);
      const [expenses, categories, vendors, buffaloes] = await Promise.all([
        query,
        supabase.from('expense_categories').select('id,name,category_group').order('name'),
        supabase.from('expense_vendors').select('id,name').order('name'),
        supabase.from('buffaloes').select('id,name,buffalo_code').order('buffalo_code'),
      ]);
      const initialError = expenses.error ?? categories.error ?? vendors.error ?? buffaloes.error;
      if (initialError) throw new Error(initialError.message);
      const rows = expenses.data ?? [];
      const ids = rows.map((row) => row.id);
      let ledgerExpenseIds: string[] = [];
      let feedPurchaseExpenseIds: string[] = [];
      if (ids.length) {
        const [payments, purchases] = await Promise.all([
          supabase.from('expense_payments').select('expense_id').in('expense_id', ids),
          supabase.from('feed_purchases').select('expense_id').eq('status', 'ACTIVE').in('expense_id', ids),
        ]);
        const relatedError = payments.error ?? purchases.error;
        if (relatedError) throw new Error(relatedError.message);
        ledgerExpenseIds = (payments.data ?? []).map((row) => row.expense_id);
        feedPurchaseExpenseIds = (purchases.data ?? []).map((row) => row.expense_id).filter((id): id is string => Boolean(id));
      }
      return {
        rows: rows as ExpenseRow[],
        totalCount: expenses.count ?? 0,
        categories: categories.data ?? [],
        vendors: vendors.data ?? [],
        buffaloes: buffaloes.data ?? [],
        ledgerExpenseIds,
        feedPurchaseExpenseIds,
      };
    },
  });
}

export function useNewExpenseOptionsQuery(ownerId: string, enabled = true) {
  return useQuery({
    queryKey: [...expenseQueryKeys.all, 'new-expense-options', ownerId] as const,
    enabled: Boolean(ownerId && enabled),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [categories, vendors, buffaloes] = await Promise.all([
        supabase.from('expense_categories').select('*')
          .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
          .order('name'),
        supabase.from('expense_vendors').select('id,name').eq('is_active', true).order('name'),
        supabase.from('buffaloes').select('id,buffalo_code,name').order('buffalo_code'),
      ]);
      const error = categories.error ?? vendors.error ?? buffaloes.error;
      if (error) throw new Error(error.message);
      // Resolve overrides before filtering active rows. An inactive farm-owned
      // category intentionally hides the shared default with the same name.
      const categoryByName = new Map<string, NonNullable<typeof categories.data>[number]>();
      for (const category of categories.data ?? []) {
        const key = category.name.trim().toLocaleLowerCase();
        const existing = categoryByName.get(key);
        if (!existing || (existing.owner_id == null && category.owner_id === ownerId)) {
          categoryByName.set(key, category);
        }
      }
      return {
        // Generic expenses are for non-feed costs only. Feed purchases must use
        // the dedicated purchase workflow so inventory and accounting stay linked.
        categories: [...categoryByName.values()]
          .filter((category) => category.is_active && category.category_group !== 'FEED')
          .sort((a, b) => a.name.localeCompare(b.name)),
        vendors: vendors.data ?? [],
        buffaloes: buffaloes.data ?? [],
      };
    },
  });
}

export type CreateExpenseInput = {
  userId: string;
  businessDate: string;
  categoryId: string;
  vendorId: string | null;
  buffaloId: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  totalAmount: number;
  paymentStatus: string;
  paidAmount: number;
  paymentMethod: string;
  dueDate: string | null;
  notes: string | null;
  receiptReference: string | null;
};

export function useCreateExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('expenses').insert({
        user_id: input.userId,
        business_date: input.businessDate,
        category_id: input.categoryId,
        vendor_id: input.vendorId,
        buffalo_id: input.buffaloId,
        description: input.description,
        quantity: input.quantity,
        unit: input.unit,
        rate: input.rate,
        total_amount: input.totalAmount,
        payment_status: input.paymentStatus,
        paid_amount: input.paidAmount,
        payment_method: input.paymentMethod,
        due_date: input.dueDate,
        notes: input.notes,
        receipt_reference: input.receiptReference,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: expenseQueryKeys.vendors() }),
        queryClient.invalidateQueries({ queryKey: expenseQueryKeys.categories() }),
        queryClient.invalidateQueries({ queryKey: ['feed-purchases'] }),
        queryClient.invalidateQueries({ queryKey: ['feed-inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['feed-cost-analytics'] }),
        queryClient.invalidateQueries({ queryKey: buffaloQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['financial-reports'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}

async function invalidateExpenseDirectories(
  queryClient: ReturnType<typeof useQueryClient>,
  includeBuffaloes = false,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: expenseQueryKeys.categories() }),
    queryClient.invalidateQueries({ queryKey: expenseQueryKeys.vendors() }),
    queryClient.invalidateQueries({ queryKey: ['feed-items'] }),
    queryClient.invalidateQueries({ queryKey: ['feed-purchases'] }),
    queryClient.invalidateQueries({ queryKey: ['feed-consumption'] }),
    queryClient.invalidateQueries({ queryKey: ['diet-plans'] }),
    ...(includeBuffaloes ? [queryClient.invalidateQueries({ queryKey: buffaloQueryKeys.all })] : []),
    queryClient.invalidateQueries({ queryKey: ['financial-reports'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
}

export function useSaveExpenseCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      ownerId: string;
      values: { name: string; category_group: string; default_unit: string | null; is_quantity_based: boolean; description: string | null };
    }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const result = input.id
        ? await supabase.from('expense_categories').update(input.values).eq('id', input.id).eq('owner_id', input.ownerId)
        : await supabase.from('expense_categories').insert({ ...input.values, owner_id: input.ownerId });
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: () => invalidateExpenseDirectories(queryClient),
  });
}

export function useToggleExpenseCategoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; ownerId: string; isActive: boolean }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('expense_categories').update({ is_active: input.isActive })
        .eq('id', input.id).eq('owner_id', input.ownerId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateExpenseDirectories(queryClient),
  });
}

export function useSaveExpenseVendorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      values: { name: string; mobile: string | null; city: string | null; address: string | null };
    }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error(userError?.message ?? 'Session expired. Sign in again.');
      const result = input.id
        ? await supabase.from('expense_vendors').update(input.values).eq('id', input.id).eq('user_id', user.id)
        : await supabase.from('expense_vendors').insert({ ...input.values, user_id: user.id });
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: () => invalidateExpenseDirectories(queryClient),
  });
}

export function useToggleExpenseVendorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error(userError?.message ?? 'Session expired. Sign in again.');
      const { error } = await supabase.from('expense_vendors').update({ is_active: input.isActive })
        .eq('id', input.id).eq('user_id', user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateExpenseDirectories(queryClient),
  });
}

export function useUpdateExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      expenseId: string;
      values: {
        business_date: string;
        category_id: string;
        vendor_id: string | null;
        buffalo_id: string | null;
        description: string | null;
        quantity: number | null;
        unit: string | null;
        rate: number | null;
        total_amount: number;
        paid_amount: number;
        payment_status: string;
        payment_method: string;
        due_date: string | null;
        notes: string | null;
        receipt_reference: string | null;
      };
    }) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('expenses').update(input.values).eq('id', input.expenseId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateExpenseDirectories(queryClient, true),
  });
}

export function useSoftDeleteExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expenseId: string) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const { error } = await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', expenseId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateExpenseDirectories(queryClient, true),
  });
}
