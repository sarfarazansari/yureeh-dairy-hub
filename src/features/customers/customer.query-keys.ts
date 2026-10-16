export const customerQueryKeys = {
  all: ['customers'] as const,
  directory: () => [...customerQueryKeys.all, 'directory'] as const,
  details: () => [...customerQueryKeys.all, 'detail'] as const,
  detail: (customerId: string) => [...customerQueryKeys.details(), customerId] as const,
};
