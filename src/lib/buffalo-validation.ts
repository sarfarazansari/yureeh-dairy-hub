export { buffaloMilkQuantitySchema, buffaloPaymentType, buffaloPaymentTypes, buffaloPurchaseSchema } from '@/features/buffaloes/validation';
export type { BuffaloPaymentType, BuffaloPurchaseForm, BuffaloPurchaseFormValues } from '@/features/buffaloes/validation';


export const buffaloPaymentTypes = ['PAID_IN_FULL', 'PARTIAL_CREDIT', 'FULL_CREDIT'] as const;
export type BuffaloPaymentType = (typeof buffaloPaymentTypes)[number];

const requiredNumber = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((value) => Number.isFinite(Number(value)), `${label} must be a valid number.`)
    .transform(Number);

export const buffaloMilkQuantitySchema = z
  .string()
  .trim()
  .min(1, 'Enter a milk quantity or leave the field blank.')
  .refine(
    (value) => /^\d+(\.\d{1,3})?$/.test(value),
    'Enter a non-negative quantity with at most 3 decimal places.',
  )
  .transform(Number)
  .refine(
    (value) => Number.isFinite(value) && value >= 0,
    'Milk quantity must be zero or greater.',
  );

export const buffaloPurchaseSchema = z
  .object({
    buffalo_code: z
      .string()
      .trim()
      .min(1, 'Buffalo code is required.')
      .transform((value) => value.toUpperCase()),
    breed: z.string().trim().min(1, 'Breed is required.'),
    purchase_date: z
      .string()
      .min(1, 'Purchase date is required.')
      .refine((value) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const parsed = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
      }, 'Enter a valid purchase date.'),
    purchase_price: requiredNumber('Purchase price').refine(
      (value) => value > 0,
      'Purchase price must be greater than ₹0.',
    ),
    advance_paid: requiredNumber('Advance paid').refine(
      (value) => value >= 0,
      'Advance paid must be zero or greater.',
    ),
    payment_type: z.enum(buffaloPaymentTypes),
    payment_due_date: z.string().optional(),
    payment_terms: z.string().optional(),
    buffalo_name: z.string().optional(),
    vendor_name: z.string().optional(),
    vendor_location: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.advance_paid > value.purchase_price) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['advance_paid'],
        message: 'Advance paid cannot be greater than purchase price.',
      });
    }
    const expectedType: BuffaloPaymentType =
      value.advance_paid === value.purchase_price
        ? 'PAID_IN_FULL'
        : value.advance_paid > 0
          ? 'PARTIAL_CREDIT'
          : 'FULL_CREDIT';
    if (value.payment_type !== expectedType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payment_type'],
        message: 'Payment type must match the purchase price and advance paid.',
      });
    }
    if (expectedType !== 'PAID_IN_FULL' && !value.payment_due_date) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payment_due_date'],
        message: 'Udhaar due date is required when a balance is due.',
      });
    }
    if (value.vendor_location?.trim() && !value.vendor_name?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vendor_name'],
        message: 'Enter a vendor name to save its location.',
      });
    }
  });

export type BuffaloPurchaseForm = z.input<typeof buffaloPurchaseSchema>;

export function buffaloPaymentType(price: number, advance: number): BuffaloPaymentType {
  if (price > 0 && advance >= price) return 'PAID_IN_FULL';
  return advance > 0 ? 'PARTIAL_CREDIT' : 'FULL_CREDIT';
}

export type BuffaloPurchaseFormValues = z.output<typeof buffaloPurchaseSchema>;
