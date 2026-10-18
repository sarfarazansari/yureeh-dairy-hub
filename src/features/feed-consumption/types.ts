export type FeedConsumption = {
  id: string;
  user_id: string;
  feed_item_id: string;
  movement_type: 'CONSUMPTION';
  quantity: number | string;
  unit_cost: number | string | null;
  source_type: string | null;
  source_id: string | null;
  occurred_at: string;
  notes: string | null;
  reversal_of_movement_id: string | null;
  created_at: string;
};

export type FeedConsumptionListRow = FeedConsumption & {
  feed_item_name: string;
  base_unit: string;
  can_edit_delete: boolean;
};