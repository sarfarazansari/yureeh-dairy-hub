import { z } from 'zod';
import { BUFFALO_PAYMENT_METHODS } from './types';
import { dateKeySchema, optionalDateKeySchema, todayDateKey } from '@/lib/date-input';

const validDate = (label: string) =>
  dateKeySchema(label).refine((value) => value <= todayDateKey(), `${label} cannot be in the future.`);

const requiredMoney = (label: string) =>
  z.string().trim().min(1, `${label} is required.`)
    .refine((value) => Number.isFinite(Number(value)), `${label} must be a valid number.`)
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), `${label} can have at most two decimal places.`)
    .transform(Number);

export const buffaloSaleSchema = z.object({
  sale_date: validDate('Sale date'),
  buyer_name: z.string().trim().min(1, 'Buyer name is required.'),
  buyer_mobile: z.string().optional(),
  buyer_location: z.string().optional(),
  sale_price: requiredMoney('Sale price').refine((value) => value > 0, 'Sale price must be greater than ₹0.'),
  initial_payment: requiredMoney('Initial payment').refine((value) => value >= 0, 'Initial payment cannot be negative.'),
  payment_method: z.enum(BUFFALO_PAYMENT_METHODS).optional(),
  payment_date: optionalDateKeySchema('Payment date').refine((value) => !value || value <= todayDateKey(), 'Payment date cannot be in the future.'),
  payment_due_date: optionalDateKeySchema('Payment due date'),
  payment_terms: z.string().optional(),
  transaction_reference: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((value, context) => {
  if (value.payment_due_date && value.payment_due_date < value.sale_date) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_due_date'], message: 'Due date cannot be earlier than the sale date.' });
  }
  if (value.initial_payment > value.sale_price) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['initial_payment'], message: 'Initial payment cannot exceed sale price.' });
  }
  if (value.initial_payment > 0 && !value.payment_method) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_method'], message: 'Payment method is required when money is received.' });
  }
  if (value.initial_payment > 0 && !value.payment_date) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_date'], message: 'Payment date is required when money is received.' });
  }
  if (value.initial_payment < value.sale_price && !value.payment_due_date) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_due_date'], message: 'Due date is required while sale proceeds remain outstanding.' });
  }
});

export const buffaloSalePaymentSchema = z.object({
  payment_date: validDate('Payment date'),
  amount: requiredMoney('Payment amount').refine((value) => value > 0, 'Payment amount must be greater than ₹0.'),
  payment_method: z.enum(BUFFALO_PAYMENT_METHODS),
  transaction_reference: z.string().optional(),
  notes: z.string().optional(),
});

export const buffaloDisposalSchema = z.object({
  disposal_type: z.enum(['DEATH', 'TRANSFER_OUT', 'OTHER']),
  effective_date: validDate('Disposal date'),
  reason: z.string().trim().min(1, 'A disposal reason is required.'),
  notes: z.string().optional(),
});

export type BuffaloSaleFormValues = z.output<typeof buffaloSaleSchema>;
export type BuffaloSalePaymentFormValues = z.output<typeof buffaloSalePaymentSchema>;
export type BuffaloDisposalFormValues = z.output<typeof buffaloDisposalSchema>;
