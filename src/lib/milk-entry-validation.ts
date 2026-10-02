import { z } from 'zod';
import type { PricingType } from './analytics';

const positiveNumber = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((value) => Number.isFinite(Number(value)), `${label} must be a valid number.`)
    .transform(Number)
    .refine((value) => value > 0, `${label} must be greater than zero.`);

export const milkEntrySchema = z
  .object({
    business_date: z
      .string()
      .min(1, 'Business date is required.')
      .refine((value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const parsed = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
      }, 'Enter a valid business date.'),
    shift: z.enum(['MORNING', 'EVENING']),
    customer_id: z.string().trim().min(1, 'Choose a customer.'),
    milk_quantity: positiveNumber('Milk quantity'),
    fat: z.string().optional().default(''),
    pricing_type: z.enum(['FIXED_PER_LITRE', 'FAT_BASED']),
    applied_rate: positiveNumber('Applied rate'),
    notes: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.pricing_type === 'FAT_BASED') {
      if (!value.fat?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fat'],
          message: 'Fat is required for fat-based pricing.',
        });
        return;
      }
      const fat = Number(value.fat);
      if (!Number.isFinite(fat) || fat < 0 || fat > 20) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fat'],
          message: 'Fat must be between 0 and 20%.',
        });
      }
    }
  })
  .transform((value) => ({
    ...value,
    fat: value.pricing_type === 'FAT_BASED' ? Number(value.fat) : null,
    pricing_type: value.pricing_type as PricingType,
  }));

export type MilkEntryForm = z.input<typeof milkEntrySchema>;
export type MilkEntryFormValues = z.output<typeof milkEntrySchema>;
