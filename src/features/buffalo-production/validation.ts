import { z } from 'zod';

export const buffaloMilkQuantitySchema = z
  .string()
  .trim()
  .min(1, 'Enter a milk quantity or leave the field blank.')
  .refine((value) => /^\\d+(\\.\\d{1,3})?$/.test(value), 'Enter a non-negative quantity with at most 3 decimal places.')
  .transform(Number)
  .refine((value) => Number.isFinite(value) && value >= 0, 'Milk quantity must be zero or greater.');
