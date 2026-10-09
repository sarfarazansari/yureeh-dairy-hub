import { z } from 'zod';

export const dietPlanSchema = z.object({
  name: z.string().trim().min(1, 'Plan name is required.').max(120),
  notes: z.string().max(1000).default(''),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().default(''),
  status: z.enum(['ACTIVE', 'PAUSED', 'STOPPED']),
  items: z.array(z.object({
    feedItemId: z.string().uuid('Select a feed item.'),
    morningQuantity: z.coerce.number().min(0).max(999999999),
    eveningQuantity: z.coerce.number().min(0).max(999999999),
  })).min(1, 'Add at least one feed item.'),
  buffaloIds: z.array(z.string().uuid()).min(1, 'Select at least one buffalo.'),
}).superRefine((value, ctx) => {
  if (value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date cannot be earlier than start date.' });
  }
  const feedIds = value.items.map((item) => item.feedItemId);
  if (new Set(feedIds).size !== feedIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'A feed item can only be added once.' });
  }
  value.items.forEach((item, index) => {
    if (item.morningQuantity === 0 && item.eveningQuantity === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'morningQuantity'], message: 'Enter a quantity for morning or evening.' });
    }
    if ([item.morningQuantity, item.eveningQuantity].some((quantity) => !Number.isFinite(quantity) || Number(quantity.toFixed(3)) !== quantity)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'morningQuantity'], message: 'Quantities support up to 3 decimal places.' });
    }
  });
  if (new Set(value.buffaloIds).size !== value.buffaloIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['buffaloIds'], message: 'Buffalo selection contains duplicates.' });
  }
});

export type DietPlanFormInput = z.input<typeof dietPlanSchema>;
export type DietPlanFormValues = z.output<typeof dietPlanSchema>;
