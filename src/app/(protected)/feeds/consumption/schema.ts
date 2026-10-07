import { z } from 'zod';

export const feedConsumptionSchema = z.object({
  feedItemId: z.string().uuid('Select a feed item.'),
  businessDate: z.string().min(1, 'Consumption date is required.'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero.').max(999999999),
  notes: z.string().max(1000).optional(),
});

export type FeedConsumptionFormValues = z.infer<typeof feedConsumptionSchema>;