'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { normalizeDateKey } from '@/lib/date-key';

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

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseDateKey(value: string) {
  const normalized = normalizeDateKey(value);
  if (!normalized) return null;

  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date);
}

function dateLabel(value: string) {
  const date = parseDateKey(value);
  return date
    ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
    : '';
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selected = parseDateKey(value);
    return selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });

  useEffect(() => {
    if (open) {
      const selected = parseDateKey(value);
      if (selected) setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null as Date | null),
      ...Array.from({ length: count }, (_, index) => new Date(year, month, index + 1)),
    ];
  }, [visibleMonth]);

  const previousMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  const previousDisabled = !!min && toDateKey(new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0)) < min;
  const nextDisabled = !!max && toDateKey(nextMonth) > max;

  function chooseDate(date: Date) {
    const key = toDateKey(date);
    if ((min && key < min) || (max && key > max)) return;
    onChange(key);
    setOpen(false);
  }

  return (
    <div className={`shadcn-date-picker ${className}`} ref={rootRef}>
      <button
        id={id}
        type="button"
        className="shadcn-date-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarDays size={16} aria-hidden="true" />
        <span className={value ? 'shadcn-date-value' : 'shadcn-date-placeholder'}>{value ? dateLabel(value) : placeholder}</span>
      </button>
      {clearable && value && !disabled && (
        <button
          type="button"
          className="shadcn-date-clear"
          aria-label="Clear date"
          onClick={() => onChange('')}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
      {open && (
        <div className="shadcn-calendar-popover" role="dialog" aria-label="Calendar">
          <div className="shadcn-calendar-header">
            <button type="button" className="shadcn-calendar-nav" aria-label="Previous month" disabled={previousDisabled} onClick={() => setVisibleMonth(previousMonth)}>
              <ChevronLeft size={16} />
            </button>
            <strong aria-live="polite">{monthLabel(visibleMonth)}</strong>
            <button type="button" className="shadcn-calendar-nav" aria-label="Next month" disabled={nextDisabled} onClick={() => setVisibleMonth(nextMonth)}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="shadcn-calendar-grid" role="grid" aria-label={monthLabel(visibleMonth)}>
            {WEEKDAYS.map((day) => <span key={day} className="shadcn-calendar-weekday" role="columnheader">{day}</span>)}
            {days.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} className="shadcn-calendar-empty" aria-hidden="true" />;
              const key = toDateKey(day);
              const isDisabled = (!!min && key < min) || (!!max && key > max);
              const isSelected = key === (normalizeDateKey(value) ?? value);
              const isToday = key === toDateKey(new Date());
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  className={`shadcn-calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  aria-label={new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' }).format(day)}
                  aria-pressed={isSelected}
                  disabled={isDisabled}
                  onClick={() => chooseDate(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="shadcn-calendar-footer">
            <button type="button" className="shadcn-calendar-today" disabled={Boolean((min && toDateKey(new Date()) < min) || (max && toDateKey(new Date()) > max))} onClick={() => chooseDate(new Date())}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}
