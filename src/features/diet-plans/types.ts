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

export type DietBuffaloOption = {
  id: string;
  buffalo_code: string;
  name: string | null;
  current_status: string;
};

export type ScheduleSettings = {
  morning_time: string | null;
  evening_time: string | null;
};

export type FeedingRun = {
  id: string;
  plan_id: string;
  feeding_date: string;
  shift: 'MORNING' | 'EVENING';
  scheduled_for: string;
  status: 'PENDING' | 'PROCESSING' | 'POSTED' | 'FAILED' | 'SKIPPED';
  failure_reason: string | null;
  retry_count: number;
  diet_plans: { name: string } | null;
};
