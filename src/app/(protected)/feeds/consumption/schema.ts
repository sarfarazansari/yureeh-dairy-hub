import { z } from 'zod';
import { dateKeySchema, todayDateKey } from '@/lib/date-input';

export const feedConsumptionSchema = z.object({
  feedItemId: z.string().uuid('Select a feed item.'),
  businessDate: dateKeySchema('Consumption date').refine((value) => value <= todayDateKey(), 'Consumption date must be today or earlier.'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero.').max(999999999),
  notes: z.string().max(1000).optional(),
});

export type FeedConsumptionFormValues = z.infer<typeof feedConsumptionSchema>;