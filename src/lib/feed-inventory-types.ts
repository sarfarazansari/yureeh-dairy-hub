import type { FeedCategory } from './feed-types';

export type FeedInventoryMovementType =
  | 'PURCHASE'
  | 'CONSUMPTION'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT';

export const FEED_INVENTORY_MOVEMENT_TYPES: FeedInventoryMovementType[] = [
  'PURCHASE',
  'CONSUMPTION',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
];

export type FeedInventoryMovement = {
  id: string;
  user_id: string;
  feed_item_id: string;
  movement_type: FeedInventoryMovementType;
  quantity: number | string;
  unit_cost: number | string | null;
  source_type: string | null;
  source_id: string | null;
  occurred_at: string;
  notes: string | null;
  reversal_of_movement_id: string | null;
  created_at: string;
};

export type FeedInventoryStock = {
  user_id: string;
  feed_item_id: string;
  feed_item_name: string;
  base_unit: string;
  quantity_on_hand: number | string;
  stock_value: number | string;
  weighted_average_cost: number | string | null;
  low_stock_threshold: number | string;
  category: FeedCategory;
  is_active: boolean;
};
