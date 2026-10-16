export const buffaloQueryKeys = {
  all: ['buffaloes'] as const,
  directory: () => [...buffaloQueryKeys.all, 'directory'] as const,
  detail: (id: string) => [...buffaloQueryKeys.all, 'detail', id] as const,
  payments: (buffaloId: string) => [...buffaloQueryKeys.all, 'payments', buffaloId] as const,
  statusHistory: (buffaloId: string) => [...buffaloQueryKeys.all, 'status-history', buffaloId] as const,
  sale: (buffaloId: string) => [...buffaloQueryKeys.all, 'sale', buffaloId] as const,
  salePayments: (buffaloId: string) => [...buffaloQueryKeys.all, 'sale-payments', buffaloId] as const,
  disposal: (buffaloId: string) => [...buffaloQueryKeys.all, 'disposal', buffaloId] as const,
  salesArchive: (page: number, pageSize: number, filters: { from?: string; to?: string; search?: string }) =>
    [...buffaloQueryKeys.all, 'sales-archive', page, pageSize, filters] as const,
  acquisitionCosts: (buffaloId: string) => [...buffaloQueryKeys.all, 'acquisition-costs', buffaloId] as const,
  acquisitionCostExpenses: (buffaloId: string) => [...buffaloQueryKeys.all, 'acquisition-cost-expenses', buffaloId] as const,
};
