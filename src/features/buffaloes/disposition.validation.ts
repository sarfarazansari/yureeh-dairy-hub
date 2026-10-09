import { z } from 'zod';
import { BUFFALO_PAYMENT_METHODS } from './types';

const validDate = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} is required.`)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, `Enter a valid ${label.toLowerCase()}.`);

const requiredMoney = (label: string) =>
  z.string().trim().min(1, `${label} is required.`)
    .refine((value) => Number.isFinite(Number(value)), `${label} must be a valid number.`)
    .transform(Number);

export const buffaloSaleSchema = z.object({
  sale_date: validDate('Sale date'),
  buyer_name: z.string().trim().min(1, 'Buyer name is required.'),
  buyer_mobile: z.string().optional(),
  buyer_location: z.string().optional(),
  sale_price: requiredMoney('Sale price').refine((value) => value > 0, 'Sale price must be greater than ₹0.'),
  initial_payment: requiredMoney('Initial payment').refine((value) => value >= 0, 'Initial payment cannot be negative.'),
  payment_method: z.enum(BUFFALO_PAYMENT_METHODS).optional(),
  payment_date: z.string().optional(),
  payment_due_date: z.string().optional(),
  payment_terms: z.string().optional(),
  transaction_reference: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((value, context) => {
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
