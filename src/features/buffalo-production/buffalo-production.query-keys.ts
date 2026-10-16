export const buffaloProductionQueryKeys = {
  all: ['buffalo-production'] as const,
  sheet: (businessDate: string, shift: string) =>
    [...buffaloProductionQueryKeys.all, 'sheet', businessDate, shift] as const,
  range: (from: string, to: string) =>
    [...buffaloProductionQueryKeys.all, 'range', from, to] as const,
  fatRange: (from: string, to: string) =>
    [...buffaloProductionQueryKeys.all, 'fat-range', from, to] as const,
  history: (buffaloId: string) =>
    [...buffaloProductionQueryKeys.all, 'history', buffaloId] as const,
  producingBuffaloes: () => [...buffaloProductionQueryKeys.all, 'producing-buffaloes'] as const,
};
