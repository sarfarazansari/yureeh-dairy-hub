'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { normalizeDateKey } from '@/lib/date-key';

type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  max?: string;
  className?: string;
  ariaLabel?: string;
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
  return date ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : '';
}

export function DateRangePicker({ from, to, onChange, max, className = '', ariaLabel = 'Choose date range' }: DateRangePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const selected = parseDateKey(from);
    const current = selected ?? new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;
    const selected = parseDateKey(from);
    const current = selected ?? new Date();
    setVisibleMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    setAnchor('');
  }, [open, from]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
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
  const previousDisabled = !!from && !!max && from > max && toDateKey(new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0)) < from;
  const nextDisabled = !!max && toDateKey(nextMonth) > max;
  const label = from && to ? `${dateLabel(from)} – ${dateLabel(to)}` : from ? `${dateLabel(from)} – Choose end date` : 'Choose date range';

  function chooseDate(date: Date) {
    const key = toDateKey(date);
    if (max && key > max) return;
    if (!anchor) {
      setAnchor(key);
      return;
    }
    const start = key < anchor ? key : anchor;
    const end = key < anchor ? anchor : key;
    onChange({ from: start, to: end });
    setAnchor('');
    setOpen(false);
  }

  return (
    <div className={`shadcn-date-picker shadcn-date-range-picker ${className}`} ref={rootRef}>
      <button type="button" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} className="shadcn-date-trigger" onClick={() => setOpen((current) => !current)}>
        <CalendarDays size={16} aria-hidden="true" />
        <span className={from ? 'shadcn-date-value' : 'shadcn-date-placeholder'}>{label}</span>
        {(from || to) && <span className="shadcn-range-clear" onClick={(event) => { event.stopPropagation(); onChange({ from: '', to: '' }); setAnchor(''); setOpen(false); }} role="button" aria-label="Clear date range" tabIndex={0}><X size={14} /></span>}
      </button>
      {open && (
        <div className="shadcn-calendar-popover shadcn-range-calendar" role="dialog" aria-label="Choose date range">
          <div className="shadcn-calendar-header">
            <button type="button" className="shadcn-calendar-nav" aria-label="Previous month" disabled={previousDisabled} onClick={() => setVisibleMonth(previousMonth)}><ChevronLeft size={16} /></button>
            <strong aria-live="polite">{monthLabel(visibleMonth)}</strong>
            <button type="button" className="shadcn-calendar-nav" aria-label="Next month" disabled={nextDisabled} onClick={() => setVisibleMonth(nextMonth)}><ChevronRight size={16} /></button>
          </div>
          <div className="shadcn-calendar-grid" role="grid" aria-label={monthLabel(visibleMonth)}>
            {WEEKDAYS.map((day) => <span key={day} className="shadcn-calendar-weekday" role="columnheader">{day}</span>)}
            {days.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} className="shadcn-calendar-empty" aria-hidden="true" />;
              const key = toDateKey(day);
              const disabled = !!max && key > max;
              const start = anchor || from;
              const end = anchor ? '' : to;
              const selected = !!start && !!end && key >= start && key <= end;
              const endpoint = key === start || key === end || key === anchor;
              const today = key === toDateKey(new Date());
              return <button key={key} type="button" role="gridcell" className={`shadcn-calendar-day ${endpoint ? 'selected' : selected ? 'range-middle' : ''} ${today ? 'today' : ''}`} aria-label={new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' }).format(day)} aria-pressed={selected || endpoint} disabled={disabled} onClick={() => chooseDate(day)}>{day.getDate()}</button>;
            })}
          </div>
          <div className="shadcn-calendar-footer">
            <span className="shadcn-range-hint">{anchor ? `Start: ${dateLabel(anchor)}. Select end date.` : 'Select start and end dates'}</span>
            <button type="button" className="shadcn-calendar-today" onClick={() => { onChange({ from: '', to: '' }); setAnchor(''); setOpen(false); }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
