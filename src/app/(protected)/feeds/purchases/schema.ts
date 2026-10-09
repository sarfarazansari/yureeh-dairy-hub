import { z } from 'zod';

export const feedPurchaseSchema = z.object({
  feedItemId: z.string().uuid('Select a feed item.'),
  vendorId: z.string().uuid().optional().or(z.literal('')),
  businessDate: z.string().min(1, 'Business date is required.'),
  purchaseQuantity: z.coerce.number().positive('Quantity must be greater than zero.'),
  rate: z.coerce.number().positive('Rate must be greater than zero.'),
  paymentStatus: z.enum(['PAID', 'PARTIAL', 'CREDIT']),
  paidAmount: z.coerce.number().min(0, 'Paid amount cannot be negative.'),
  paymentMethod: z.string().min(1),
  dueDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
}).superRefine((value, ctx) => {
  const total = Math.round(value.purchaseQuantity * value.rate * 100) / 100;
  if (value.paidAmount > total) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paidAmount'], message: 'Paid amount cannot exceed total.' });
  }
  if (value.paymentStatus === 'PAID' && value.paidAmount !== total) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paidAmount'], message: 'Paid amount must equal total.' });
  }
  if (value.paymentStatus === 'CREDIT' && value.paidAmount !== 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paidAmount'], message: 'Credit purchases must have zero paid amount.' });
  }
  if (value.paymentStatus === 'PARTIAL' && (value.paidAmount <= 0 || value.paidAmount >= total)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paidAmount'], message: 'Partial payment must be between zero and total.' });
  }
});

export type FeedPurchaseFormValues = z.infer<typeof feedPurchaseSchema>;