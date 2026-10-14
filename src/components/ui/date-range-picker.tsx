'use client';

import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  max?: string;
  className?: string;
  ariaLabel?: string;
};

function parseDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date | undefined) {
  return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
}

export function DateRangePicker({ from, to, onChange, max, className, ariaLabel = 'Choose date range' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => ({ from: parseDate(from), to: parseDate(to) }), [from, to]);
  const label = from && to
    ? `${format(parseDate(from)!, 'd MMM yyyy')} – ${format(parseDate(to)!, 'd MMM yyyy')}`
    : from ? `${format(parseDate(from)!, 'd MMM yyyy')} – Choose end date` : 'Choose date range';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={ariaLabel} aria-expanded={open} className={cn('flex h-10 min-w-0 w-full items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 text-left text-sm text-[#23392e] hover:bg-[#f7f9f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]', className)}>
          <CalendarDays className="size-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-3">
        <Calendar
          mode="range"
          numberOfMonths={1}
          selected={selected}
          disabled={max ? { after: parseDate(max)! } : undefined}
          onSelect={(range) => {
            const nextFrom = toDateKey(range?.from);
            const nextTo = toDateKey(range?.to);
            if (nextFrom && nextTo) {
              onChange({ from: nextFrom, to: nextTo });
              setOpen(false);
            }
          }}
        />
        <div className="flex items-center justify-between border-t border-[var(--line)] pt-2">
          <span className="text-xs text-[var(--muted)]">Select start and end dates</span>
          <button type="button" className="text-xs font-medium text-[var(--green)] hover:underline" onClick={() => { onChange({ from: '', to: '' }); setOpen(false); }}>Clear</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
