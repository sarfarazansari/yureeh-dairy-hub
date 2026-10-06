import type { BuffaloPaymentType } from './types';

export function getBuffaloPaymentType(price: number, advance: number): BuffaloPaymentType {
  if (price > 0 && advance >= price) return 'PAID_IN_FULL';
  return advance > 0 ? 'PARTIAL_CREDIT' : 'FULL_CREDIT';
}
