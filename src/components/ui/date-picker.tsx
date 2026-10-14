'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { normalizeDateKey } from '@/lib/date-key';
import { cn } from '@/lib/utils';

export type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  clearable?: boolean;
  className?: string;
  'aria-describedby'?: string;
};

function parseDateKey(value: string): Date | undefined {
  const normalized = normalizeDateKey(value);
  if (!normalized) return undefined;

  const [year, month, day] = normalized.split('-').map(Number);
  // Treat YYYY-MM-DD as a local business date, never as a UTC instant.
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isWithinBounds(date: Date, min?: Date, max?: Date): boolean {
  return (!min || date >= min) && (!max || date <= max);
}

export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  disabled = false,
  placeholder = 'Pick a date',
  ariaLabel = 'Choose date',
  clearable = false,
  className,
  'aria-describedby': ariaDescribedBy,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateKey(value);
  const minDate = parseDateKey(min ?? '');
  const maxDate = parseDateKey(max ?? '');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (minDate && maxDate && minDate > maxDate && open) {
      setOpen(false);
    }
  }, [min, max, minDate, maxDate, open]);

  const effectiveMin = minDate && maxDate && minDate > maxDate ? maxDate : minDate;
  const effectiveMax = maxDate && minDate && minDate > maxDate ? minDate : maxDate;

  return (
    <div className={cn('shadcn-date-picker min-w-0', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative flex min-w-0 flex-1 items-center">
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              disabled={disabled}
              aria-label={ariaLabel}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-describedby={ariaDescribedBy}
              className={cn(
                'shadcn-date-trigger flex min-w-0 items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-left text-sm text-[#26382f] transition-colors hover:border-[#aab8ad] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] disabled:cursor-not-allowed disabled:opacity-50',
                clearable && value && 'pr-10',
              )}
            >
              <CalendarDays size={16} aria-hidden="true" className="shrink-0 text-[#66756b]" />
              <span className={cn('min-w-0 flex-1 truncate', value ? 'shadcn-date-value' : 'shadcn-date-placeholder')}>
                {selectedDate ? format(selectedDate, 'd MMM yyyy') : placeholder}
              </span>
            </button>
          </PopoverTrigger>
          {clearable && value && !disabled && (
            <button
              type="button"
              className="shadcn-date-clear absolute right-2 top-1/2 inline-grid size-6 -translate-y-1/2 place-items-center rounded-md text-[#66756b] hover:bg-[#f1f4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]"
              aria-label={`Clear ${ariaLabel.toLowerCase()}`}
              onClick={() => onChange('')}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <PopoverContent
          align="start"
          sideOffset={6}
          aria-label={ariaLabel}
          className="w-auto max-w-[calc(100vw-1.5rem)] p-2"
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (!date || !isWithinBounds(date, effectiveMin, effectiveMax)) return;
              onChange(toDateKey(date));
              setOpen(false);
            }}
            defaultMonth={selectedDate ?? effectiveMin ?? effectiveMax ?? today}
            disabled={(date) => !isWithinBounds(date, effectiveMin, effectiveMax)}
            captionLayout="label"
            autoFocus
          />
          <div className="flex justify-end border-t border-[var(--line)] px-2 pt-2">
            <button
              type="button"
              className="rounded-md px-2 py-1.5 text-xs font-semibold text-[var(--green)] hover:bg-[#edf5ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isWithinBounds(today, effectiveMin, effectiveMax)}
              onClick={() => {
                if (!isWithinBounds(today, effectiveMin, effectiveMax)) return;
                onChange(toDateKey(today));
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
