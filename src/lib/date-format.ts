import dayjs from 'dayjs';

/** Format database date values consistently for human-facing UI. */
export function formatDate(value: string | Date | null | undefined, pattern = 'D MMM YYYY') {
  if (!value) return '—';
  // Treat SQL DATE values as calendar dates in local time to avoid UTC shifts.
  const normalized =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const parsed = dayjs(normalized);
  return parsed.isValid() ? parsed.format(pattern) : '—';
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, 'D MMM YYYY, h:mm A');
}
