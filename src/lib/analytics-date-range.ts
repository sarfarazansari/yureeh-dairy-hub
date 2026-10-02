import dayjs from 'dayjs';

export type AnalyticsDatePreset = 'today' | 'yesterday' | '7days' | 'week' | 'month' | 'previous';

export function getAnalyticsDateRange(preset: AnalyticsDatePreset, now: Date = new Date()) {
  const today = dayjs(now);
  let from = today;
  let to = today;

  if (preset === 'yesterday') {
    from = today.subtract(1, 'day');
    to = from;
  } else if (preset === '7days') {
    from = today.subtract(6, 'day');
  } else if (preset === 'week') {
    from = today.subtract((today.day() + 6) % 7, 'day');
  } else if (preset === 'month') {
    from = today.startOf('month');
  } else if (preset === 'previous') {
    from = today.subtract(1, 'month').startOf('month');
    to = today.startOf('month').subtract(1, 'day');
  }

  return { from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') };
}
