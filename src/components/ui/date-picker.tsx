'use client';

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { normalizeDateKey } from '@/lib/date-key';
import { cn } from '@/lib/utils';

type DatePickerProps = {
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
  className = '',
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateKey(value);
  const minDate = parseDateKey(min ?? '');
  const maxDate = parseDateKey(max ?? '');

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className={cn('shadcn-date-picker min-w-0', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative flex min-w-0 items-center gap-1">
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              className="shadcn-date-trigger min-w-0 w-full"
              disabled={disabled}
              aria-label={ariaLabel}
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <CalendarDays size={16} aria-hidden="true" />
              <span className={cn('min-w-0 flex-1 truncate text-left', value ? 'shadcn-date-value' : 'shadcn-date-placeholder')}>
                {selected ? format(selected, 'd MMM yyyy') : placeholder}
              </span>
            </button>
          </PopoverTrigger>
          {clearable && value && !disabled && (
            <button type="button" className="shadcn-date-clear shrink-0" aria-label="Clear date" onClick={() => onChange('')}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <PopoverContent align="start" sideOffset={6} className="w-auto max-w-[calc(100vw-2rem)] p-2">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={(date) => Boolean((minDate && date < minDate) || (maxDate && date > maxDate))}
            onSelect={(date) => {
              if (!date) return;
              onChange(toDateKey(date));
              setOpen(false);
            }}
            autoFocus
          />
          <div className="flex justify-end border-t border-[var(--line)] pt-2">
            <button type="button" className="shadcn-calendar-today" disabled={Boolean((minDate && new Date() < minDate) || (maxDate && new Date() > maxDate))} onClick={() => { onChange(toDateKey(new Date())); setOpen(false); }}>Today</button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
