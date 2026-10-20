'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { normalizeDateKey } from '@/lib/date-key';
import { formatDate } from '@/lib/date-format';
import { cn } from '@/lib/utils';

type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  max?: string;
  className?: string;
  ariaLabel?: string;
};

function parseDateKey(value: string) {
  const normalized = normalizeDateKey(value);
  if (!normalized) return undefined;
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateLabel(value: string) {
  const date = parseDateKey(value);
  return date ? formatDate(date) : '';
}

export function DateRangePicker({ from, to, onChange, max, className = '', ariaLabel = 'Choose date range' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const selectedFrom = parseDateKey(from);
  const selectedTo = parseDateKey(to);
  const maxDate = parseDateKey(max ?? '');

  useEffect(() => {
    if (!open) return;
    setDraft(selectedFrom ? { from: selectedFrom, to: selectedTo } : undefined);
  }, [open, from, to]);

  function selectRange(nextRange: DateRange | undefined) {
    setDraft(nextRange);
    if (nextRange?.from && nextRange.to) {
      const start = nextRange.from <= nextRange.to ? nextRange.from : nextRange.to;
      const end = nextRange.from <= nextRange.to ? nextRange.to : nextRange.from;
      onChange({ from: toDateKey(start), to: toDateKey(end) });
      setOpen(false);
    }
  }

  const label = selectedFrom && selectedTo
    ? `${dateLabel(from)} – ${dateLabel(to)}`
    : selectedFrom
      ? `${dateLabel(from)} – Choose end date`
      : 'Choose date range';

  return (
    <div className={cn('shadcn-date-picker shadcn-date-range-picker min-w-0', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative flex min-w-0 items-center">
          <PopoverTrigger asChild>
            <Button variant="outline" type="button" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} className={cn("shadcn-date-trigger min-w-0 w-full", (from || to) && "pr-10")}>
              <CalendarDays size={16} aria-hidden="true" />
              <span className={cn('min-w-0 flex-1 truncate text-left', selectedFrom ? 'shadcn-date-value' : 'shadcn-date-placeholder')}>{label}</span>
            </Button>
          </PopoverTrigger>
          {(from || to) && (
            <Button variant="ghost" size="icon" type="button" className="shadcn-date-clear absolute right-2 top-1/2 -translate-y-1/2 p-0" aria-label="Clear date range" onClick={() => { onChange({ from: '', to: '' }); setDraft(undefined); setOpen(false); }}>
              <X size={14} aria-hidden="true" />
            </Button>
          )}
        </div>
        <PopoverContent align="start" sideOffset={6} className="w-[340px] max-w-[calc(100vw-2rem)] p-2">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={selectRange}
            defaultMonth={draft?.from ?? selectedFrom}
            disabled={maxDate ? { after: maxDate } : undefined}
            numberOfMonths={1}
            autoFocus
          />
          <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-2">
            <span className="text-xs text-[var(--muted)]">{draft?.from && !draft.to ? `Start: ${format(draft.from, 'd MMM yyyy')}. Choose end date.` : 'Select start and end dates'}</span>
            <Button variant="ghost" size="sm" type="button" className="shadcn-calendar-today" onClick={() => { onChange({ from: '', to: '' }); setDraft(undefined); setOpen(false); }}>Clear</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
