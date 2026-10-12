import { z } from 'zod';

export const feedConsumptionSchema = z.object({
  feedItemId: z.string().uuid('Select a feed item.'),
  businessDate: z.string().min(1, 'Consumption date is required.').refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10), 'Consumption date must be today or earlier.'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero.').max(999999999),
  notes: z.string().max(1000).optional(),
});

export type FeedConsumptionFormValues = z.infer<typeof feedConsumptionSchema>;