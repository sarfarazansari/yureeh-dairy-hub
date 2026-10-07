export type FeedCategory = 'CONCENTRATE' | 'FODDER' | 'SUPPLEMENT' | 'MINERAL' | 'OTHER';

export const FEED_CATEGORIES: FeedCategory[] = [
  'CONCENTRATE',
  'FODDER',
  'SUPPLEMENT',
  'MINERAL',
  'OTHER',
];

export const FEED_UNITS = [
  'KG',
  'GRAM',
  'LITRE',
  'ML',
  'PIECE',
  'BAG',
  'TON',
  'OTHER',
] as const;

export type FeedItem = {
  id: string;
  user_id: string;
  name: string;
  category: FeedCategory;
  base_unit: string;
  purchase_unit: string;
  purchase_unit_quantity: number | string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
