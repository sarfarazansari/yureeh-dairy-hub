export type DietPlanStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED';

export type DietPlanFeedItem = {
  id: string;
  feed_item_id: string;
  feed_item_name: string;
  base_unit: string;
  morning_quantity: number;
  evening_quantity: number;
};

export type DietPlanBuffalo = {
  id: string;
  buffalo_code: string;
  name: string | null;
};

export type DietPlanListRow = {
  id: string;
  name: string;
  notes: string | null;
  start_date: string;
  end_date: string | null;
  status: DietPlanStatus;
  created_at: string;
  buffalo_count: number;
  feed_count: number;
};

export type DietPlanDetails = {
  id: string;
  name: string;
  notes: string | null;
  start_date: string;
  end_date: string | null;
  status: DietPlanStatus;
  items: DietPlanFeedItem[];
  buffaloes: DietPlanBuffalo[];
};

export type DietPlanFormValues = {
  name: string;
  notes: string;
  startDate: string;
  endDate: string;
  status: DietPlanStatus;
  items: { feedItemId: string; morningQuantity: number; eveningQuantity: number }[];
  buffaloIds: string[];
};

export type DietBuffaloOption = {
  id: string;
  buffalo_code: string;
  name: string | null;
  current_status: string;
};
